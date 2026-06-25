import sys
import json
import urllib.request
import urllib.error
import random
import re
import time

# -------------------------------------------------------------
# 0. DEPENDENCY CHECK
# -------------------------------------------------------------
try:
    import torch
    import torch.nn as nn
    import torch.optim as optim
    import numpy as np
except ImportError:
    print("\n" + "="*70)
    print("[ERROR] PyTorch and NumPy are required to run self-play training!")
    print("Please install them by running:")
    print("    pip install torch numpy")
    print("="*70 + "\n")
    sys.exit(1)

# -------------------------------------------------------------
# 1. ACTION REPRESENTATION ENCODING
# -------------------------------------------------------------
ACTION_TYPES = {
    'ROLL_DICE': 1, 'BUILD': 2, 'BUY_IMPROVEMENT': 3, 'TRADE_OFFER': 4,
    'ACTIVATE_KNIGHT': 5, 'UPGRADE_KNIGHT': 6, 'RECRUIT_KNIGHT': 7, 'END_TURN': 8,
    'PLAY_PROGRESS_CARD': 9, 'MOVE_ROBBER': 10, 'STEAL_CARD': 11, 'DISCARD_CARDS': 12,
    'DOWNGRADE_CITY': 13, 'SELECT_ALCHEMIST_DICE': 14
}

BUILD_TYPES = {
    'road': 1, 'settlement': 2, 'city': 3, 'city_wall': 4
}

CARD_NAMES = {
    'alchemist': 1, 'bishop': 2, 'crane': 3, 'deserter': 4, 'diplomat': 5,
    'engineer': 6, 'intrigue': 7, 'inventor': 8, 'irrigation': 9, 'medicine': 10,
    'merchant': 11, 'merchant_fleet': 12, 'mining': 13, 'resource_monopoly': 14,
    'commodity_monopoly': 15, 'master_merchant': 16, 'spy': 17, 'smith': 18,
    'saboteur': 19, 'wedding': 20, 'warlord': 21, 'constitution': 22, 'printer': 23
}

def extract_number(s):
    if not s:
        return 0.0
    nums = re.findall(r'\d+', str(s))
    return float(nums[0]) if nums else 0.0

def encode_action(action):
    """
    Encodes a dynamic game action object into a fixed-size 24-dimensional feature vector.
    """
    feat = [0.0] * 24
    
    # 1. Action Type Index
    act_type = action.get('type', '')
    feat[0] = float(ACTION_TYPES.get(act_type, 0))
    
    # 2. Build Type Index
    b_type = action.get('buildType', '')
    feat[1] = float(BUILD_TYPES.get(b_type, 0))
    
    # 3. Target ID Suffix Number (vertexId, edgeId, hexId)
    target_id = action.get('targetId') or action.get('vertexId') or action.get('edgeId') or action.get('hexId')
    feat[2] = extract_number(target_id)
    
    # 4. Progress Card Type Name Index
    card_id = action.get('cardId', '')
    if card_id:
        for name, idx in CARD_NAMES.items():
            if name in card_id:
                feat[3] = float(idx)
                break
                
    # 5. Alchemist Dice Choices
    feat[4] = float(action.get('white', 0.0))
    feat[5] = float(action.get('red', 0.0))
    
    # 6. Offer details (Resources & Commodities - 8 floats)
    offer = action.get('offer') or {}
    for i, res in enumerate(['lumber', 'brick', 'wool', 'grain', 'ore', 'paper', 'cloth', 'coin']):
        feat[6 + i] = float(offer.get(res, 0.0))
        
    # 7. Request details (Resources & Commodities - 8 floats)
    request = action.get('request') or {}
    for i, res in enumerate(['lumber', 'brick', 'wool', 'grain', 'ore', 'paper', 'cloth', 'coin']):
        feat[14 + i] = float(request.get(res, 0.0))
        
    # 8. Extra parameter targets
    params = action.get('params') or {}
    target_p = action.get('targetPlayerId') or params.get('targetPlayerId')
    if target_p:
        feat[22] = extract_number(target_p)
        
    return feat

# -------------------------------------------------------------
# 2. OBSERVATION PERSPECTIVE ROTATION (SYMMETRY)
# -------------------------------------------------------------
def rotate_observation(obs, acting_player_id):
    """
    Rotates the flat 911-float observation vector so that the acting player
    is always mapped to 'Player 0' (Self), preserving spatial ownership perspectives.
    """
    obs = list(obs)
    # Map acting ID to turn index (Static turn configuration: p1=0, p2=1, p3=2)
    acting_idx = {"p1": 0, "p2": 1, "p3": 2}.get(acting_player_id, 0)
    
    # 1. Rotate the 4 player feature segments (21 elements each, index 8 to 91)
    p0 = obs[8:29]
    p1 = obs[29:50]
    p2 = obs[50:71]
    p3 = obs[71:92]
    
    if acting_idx == 0:
        rotated_players = p0 + p1 + p2 + p3
    elif acting_idx == 1:
        rotated_players = p1 + p2 + p0 + p3
    else: # acting_idx == 2
        rotated_players = p2 + p0 + p1 + p3
        
    obs[8:92] = rotated_players
    
    # Helper to rotate ownership float representations: 0.25 (P0), 0.50 (P1), 0.75 (P2)
    def rotate_owner_val(val):
        if val <= 0.01:
            return 0.0
        idx = int(round(val * 4.0)) - 1
        if idx < 0 or idx >= 3:
            return val # leave padding or neutral index 3
            
        if acting_idx == 0:
            new_idx = idx
        elif acting_idx == 1:
            new_idx = {1: 0, 2: 1, 0: 2}[idx]
        else: # acting_idx == 2
            new_idx = {2: 0, 0: 1, 1: 2}[idx]
            
        return (new_idx + 1.0) / 4.0

    # 2. Rotate building ownership (feature index 1) and knight ownership (feature index 4) in 96 Vertices
    for v in range(96):
        start = 203 + v * 6
        obs[start + 1] = rotate_owner_val(obs[start + 1])
        obs[start + 4] = rotate_owner_val(obs[start + 4])
        
    # 3. Rotate road ownership (feature index 0) in 132 Edges
    for e in range(132):
        start = 779 + e
        obs[start] = rotate_owner_val(obs[start])
        
    return obs

# -------------------------------------------------------------
# 3. NEURAL NETWORK DESIGN (ACTION-SCORING HEAD)
# -------------------------------------------------------------
class CatanPolicyNet(nn.Module):
    """
    Action-Scoring Network. Combines 911-state observation embeddings
    with 24-dimensional actions parameters to score dynamic candidate spaces.
    """
    def __init__(self, obs_dim=911, action_feat_dim=24, hidden_dim=128):
        super().__init__()
        # State embedding subnet
        self.obs_embed = nn.Sequential(
            nn.Linear(obs_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, hidden_dim),
            nn.ReLU()
        )
        # Dynamic scorer subnet
        self.scorer = nn.Sequential(
            nn.Linear(hidden_dim + action_feat_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, 1)
        )

    def forward(self, obs_tensor, action_feats_tensor):
        # Embed state
        obs_emb = self.obs_embed(obs_tensor) # [1, hidden_dim]
        # Expand state to align with all legal actions
        num_actions = action_feats_tensor.size(0)
        obs_emb_exp = obs_emb.expand(num_actions, -1) # [num_actions, hidden_dim]
        # Concat embeddings and score
        combined = torch.cat([obs_emb_exp, action_feats_tensor], dim=1) # [num_actions, hidden_dim + action_feat_dim]
        logits = self.scorer(combined).squeeze(1) # [num_actions]
        return logits

# -------------------------------------------------------------
# 4. HTTP CLIENT CONNECTOR
# -------------------------------------------------------------
class CatanBridgeEnv:
    def __init__(self, bridge_url="http://localhost:5002", env_id="default"):
        self.bridge_url = bridge_url
        self.env_id = env_id

    def _post(self, endpoint, data):
        url = f"{self.bridge_url}{endpoint}"
        req_data = json.dumps(data).encode("utf-8")
        req = urllib.request.Request(
            url, data=req_data,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        try:
            with urllib.request.urlopen(req) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            try:
                err_msg = json.loads(e.read().decode("utf-8")).get('error')
                print(f"\n[SERVER ERROR] {err_msg}")
            except Exception:
                print(f"\n[HTTP ERROR] {e.code}: {e.reason}")
            raise e

    def reset(self):
        res = self._post("/reset", {"envId": self.env_id})
        return res["observation"], res["legalActions"], res["actingPlayerId"], res["done"]

    def step(self, action_idx):
        res = self._post("/step", {"envId": self.env_id, "actionIndex": action_idx})
        return res["observation"], res["legalActions"], res["actingPlayerId"], res["done"], res["reward"], res["playerVPs"]

# -------------------------------------------------------------
# 5. SELF-PLAY TRAINING LOOP
# -------------------------------------------------------------
def train_self_play(num_episodes=3, lr=0.001, gamma=0.99):
    print("=== INITIALIZING SELF-PLAY RL TRAINING LOOP ===")
    
    # 1. Instantiate Policy and Optimizer
    policy = CatanPolicyNet()
    optimizer = optim.Adam(policy.parameters(), lr=lr)
    env = CatanBridgeEnv()
    
    # Track statistics
    win_records = {"p1": 0, "p2": 0, "p3": 0}
    
    for episode in range(1, num_episodes + 1):
        print(f"\n--- Episode {episode}/{num_episodes} ---", flush=True)
        
        # Reset game env
        try:
            obs, legal_actions, acting_player_id, done = env.reset()
        except Exception:
            print("Aborting training. Bridge server connection failed.", flush=True)
            return

        # Setup trajectory memory per player
        # Trajectory stores: (rotated_obs_tensor, action_feats_tensor, chosen_idx, reward, log_prob)
        trajectories = {"p1": [], "p2": [], "p3": []}
        step_count = 0
        max_steps_per_episode = 1000
        
        while not done and step_count < max_steps_per_episode:
            step_count += 1
            
            # Align observations to active player perspective
            rot_obs = rotate_observation(obs, acting_player_id)
            
            # Convert to PyTorch tensors
            rot_obs_t = torch.FloatTensor(rot_obs).unsqueeze(0) # [1, 911]
            
            # Encode action space features
            action_feats = [encode_action(a) for a in legal_actions]
            act_feats_t = torch.FloatTensor(action_feats) # [num_actions, 24]
            
            # Query policy scores
            logits = policy(rot_obs_t, act_feats_t)
            probs = torch.softmax(logits, dim=0)
            
            # Sample action
            m = torch.distributions.Categorical(probs)
            action_idx_tensor = m.sample()
            action_idx = action_idx_tensor.item()
            log_prob = m.log_prob(action_idx_tensor)
            
            # Record trajectory before step
            trajectories[acting_player_id].append({
                'obs_t': rot_obs_t,
                'act_feats_t': act_feats_t,
                'idx': action_idx_tensor,
                'log_prob': log_prob,
                'reward': 0.0 # will fill after taking step
            })
            
            # Execute step
            obs, legal_actions, next_acting_player_id, done, reward_dict, player_vps = env.step(action_idx)
            
            # Distribute rewards (VP changes) to active player transition
            # If player i gained VPs, we assign it to their last action
            for p_id, r in reward_dict.items():
                if r != 0.0 and len(trajectories[p_id]) > 0:
                    trajectories[p_id][-1]['reward'] += float(r)
            
            acting_player_id = next_acting_player_id
            
            if step_count % 100 == 0:
                print(f"  Running steps: {step_count} | Standings: {player_vps}", flush=True)
                
        # --- GAME OVER: Compute returns and perform Policy Updates ---
        if done:
            print(f"[OK] Episode {episode} Finished in {step_count} steps. Standings: {player_vps}", flush=True)
        else:
            print(f"[TRUNCATED] Episode {episode} hit max step ceiling of {max_steps_per_episode} steps. Standings: {player_vps}", flush=True)
        
        # Track winners
        winner = max(player_vps, key=player_vps.get)
        win_records[winner] += 1
        
        # Gather losses across all players
        policy_losses = []
        
        for p_id, traj in trajectories.items():
            if len(traj) == 0:
                continue
                
            # Extract rewards and calculate discounted returns G_t
            rewards = [step['reward'] for step in traj]
            
            # Calculate returns G
            G = 0.0
            returns = []
            for r in reversed(rewards):
                G = r + gamma * G
                returns.insert(0, G)
                
            returns = torch.FloatTensor(returns)
            # Normalize returns to stabilize updates
            if returns.std() > 1e-6:
                returns = (returns - returns.mean()) / (returns.std() + 1e-8)
            else:
                returns = returns - returns.mean()
                
            # Accumulate policy gradient losses: -log_prob * G
            for step_data, G_t in zip(traj, returns):
                policy_losses.append(-step_data['log_prob'] * G_t)
                
        if len(policy_losses) > 0:
            # Backpropagate and update parameters
            optimizer.zero_grad()
            total_loss = torch.stack(policy_losses).sum()
            total_loss.backward()
            optimizer.step()
            
            print(f"Loss: {total_loss.item():.4f}", flush=True)
        else:
            print("  No policy updates (no VP changes occurred).", flush=True)
            
    print("\n=== TRAINING CYCLE COMPLETE ===", flush=True)
    print(f"Final Win Records: {win_records}", flush=True)

if __name__ == "__main__":
    train_self_play(num_episodes=3)
