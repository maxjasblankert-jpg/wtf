import json
import urllib.request
import urllib.error
import random
import time

class CatanBridgeEnv:
    """
    A lightweight wrapper that acts like a standard Farama-Foundation Gymnasium environment,
    communicating over HTTP with the local TypeScript game engine.
    """
    def __init__(self, bridge_url="http://localhost:5002", env_id="default"):
        self.bridge_url = bridge_url
        self.env_id = env_id
        self.observation = None
        self.legal_actions = []
        self.acting_player_id = None
        self.done = False

    def _post(self, endpoint, data):
        url = f"{self.bridge_url}{endpoint}"
        req_data = json.dumps(data).encode("utf-8")
        req = urllib.request.Request(
            url, 
            data=req_data, 
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        try:
            with urllib.request.urlopen(req) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            # Extract detailed error message from the server response
            try:
                err_body = e.read().decode("utf-8")
                err_data = json.loads(err_body)
                print(f"\n[SERVER ERROR] {err_data.get('error')}")
            except Exception:
                print(f"\n[HTTP ERROR] {e.code}: {e.reason}")
            raise e
        except urllib.error.URLError as e:
            print(f"\n[CONNECTION ERROR] Failed to connect to bridge at {self.bridge_url}.")
            print("Please make sure you started the bridge server using 'npm run dev:bridge' first!")
            raise e

    def reset(self):
        """
        Initializes the Catan game state on the TypeScript server.
        Returns:
            observation: A flat list of 911 elements representing the board and player states.
            legal_actions: A list of legal action payloads that the active player can perform.
        """
        payload = {"envId": self.env_id}
        res = self._post("/reset", payload)
        self.observation = res["observation"]
        self.legal_actions = res["legalActions"]
        self.acting_player_id = res["actingPlayerId"]
        self.done = res["done"]
        return self.observation, self.legal_actions

    def step(self, action_idx):
        """
        Executes the action index relative to the current legal_actions list.
        Returns:
            observation: The next state observation vector.
            reward: A dictionary indicating the VP change for each player (e.g. {"p1": 0, "p2": 1, "p3": 0}).
            done: Whether the game has completed.
            info: A dictionary containing debugging and tracking information (player VPs, phase, turnPhase, etc.).
        """
        payload = {
            "envId": self.env_id,
            "actionIndex": action_idx
        }
        res = self._post("/step", payload)
        self.observation = res["observation"]
        self.legal_actions = res["legalActions"]
        self.acting_player_id = res["actingPlayerId"]
        self.done = res["done"]
        
        info = {
            "acting_player_id": self.acting_player_id,
            "winner_id": res.get("winnerId"),
            "player_vps": res.get("playerVPs"),
            "phase": res.get("phase"),
            "turn_phase": res.get("turnPhase")
        }
        return self.observation, res["reward"], self.done, info

if __name__ == "__main__":
    print("=== STARTING CATAN GYM BRIDGE PYTHON EXAMPLE ===")
    env = CatanBridgeEnv()
    
    try:
        # 1. Reset Environment
        obs, legal_actions = env.reset()
        print(f"[OK] Environment initialized. Env ID: {env.env_id}")
        print(f"Observation vector size: {len(obs)}")
        
        steps = 0
        max_steps = 1000
        
        while not env.done and steps < max_steps:
            steps += 1
            
            # Simple agent logic: select a random action index from currently legal actions
            action_idx = random.randint(0, len(legal_actions) - 1)
            action_desc = legal_actions[action_idx]
            
            # 2. Step the Environment
            obs, reward, done, info = env.step(action_idx)
            
            # Render a summary status every 10 steps, or on milestones
            if steps % 10 == 0 or done:
                action_summary = action_desc["type"]
                if "buildType" in action_desc:
                    action_summary += f" ({action_desc['buildType']})"
                
                print(f"[Step {steps:03d}] Player {info['acting_player_id']} action: {action_summary} | Standings: {info['player_vps']} | Phase: {info['phase']} ({info['turn_phase']})")
                print(f"  Step Reward: {reward}")
            
            # Update action mask
            legal_actions = env.legal_actions
            
        print("\n--- EPISODE FINISHED ---")
        print(f"Total steps run: {steps}")
        print(f"Done state reached: {env.done}")
        if env.done:
            print(f"Winner is: {info['winner_id']}!")
        
    except Exception as e:
        pass
