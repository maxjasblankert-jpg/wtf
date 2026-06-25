import express from 'express';
import { createInitialState, processAction } from './gameEngine.js';
import { getObservation, getLegalActions } from './mlHelpers.js';
import { GameState } from '../shared/types.js';

const app = express();
app.use(express.json());

// In-memory multi-environment storage
const envs = new Map<string, GameState>();

// Helper to determine who needs to act next
function getNextActingPlayerId(state: GameState): string | null {
  if (state.phase === 'end') return null;

  // 1. Barbarian attack downgrades resolution
  if (state.phase === 'barbarian_attack' && state.pendingDowngrades.length > 0) {
    return state.pendingDowngrades[0];
  }

  // 2. Discarding cards checking (during a 7 roll resolution)
  if (state.turnPhase === 'post_roll') {
    for (const p of state.players) {
      const limit = 7 + 2 * p.cityWallCount;
      const total = Object.values(p.resources).reduce((a, b) => a + b, 0) +
                    Object.values(p.commodities).reduce((a, b) => a + b, 0);
      if (total > limit) {
        return p.id;
      }
    }

    // Active player robber movements / stealing
    if (state.pendingRobberMove || state.pendingStealFrom.length > 0) {
      return state.turnOrder[state.currentPlayerIndex];
    }
  }

  // 3. Regular active player
  if (state.phase === 'setup') {
    const orderLen = state.turnOrder.length;
    let idx = state.currentPlayerIndex;
    if (idx >= orderLen) {
      idx = 2 * orderLen - 1 - idx;
    }
    return state.turnOrder[idx];
  }

  return state.turnOrder[state.currentPlayerIndex];
}

// GET /state
app.get('/state', (req, res) => {
  const envId = (req.query.envId as string) || 'default';
  const state = envs.get(envId);
  
  if (!state) {
    return res.status(404).json({ error: `Environment '${envId}' not found. Call /reset first.` });
  }

  const actingPlayerId = getNextActingPlayerId(state);
  const done = state.phase === 'end' || state.winnerId !== null;
  const legalActions = actingPlayerId && !done ? getLegalActions(state, actingPlayerId) : [];
  const observation = getObservation(state);

  const playerVPs: Record<string, number> = {};
  for (const p of state.players) {
    playerVPs[p.id] = p.victoryPoints;
  }

  res.json({
    envId,
    observation,
    legalActions,
    actingPlayerId,
    done,
    winnerId: state.winnerId,
    playerVPs,
    phase: state.phase,
    turnPhase: state.turnPhase
  });
});

// POST /reset
app.post('/reset', (req, res) => {
  const envId = req.body.envId || 'default';
  const playersInput = req.body.players || [
    { id: 'p1', name: 'Alice (Bot)', color: 'red' },
    { id: 'p2', name: 'Bob (Bot)', color: 'blue' },
    { id: 'p3', name: 'Charlie (Bot)', color: 'green' }
  ];

  try {
    const state = createInitialState(playersInput, true);
    envs.set(envId, state);

    const actingPlayerId = getNextActingPlayerId(state);
    if (!actingPlayerId) {
      return res.status(500).json({ error: 'Failed to determine initial active player.' });
    }

    const legalActions = getLegalActions(state, actingPlayerId);
    const observation = getObservation(state);

    const playerVPs: Record<string, number> = {};
    for (const p of state.players) {
      playerVPs[p.id] = p.victoryPoints;
    }

    res.json({
      envId,
      observation,
      legalActions,
      actingPlayerId,
      done: false,
      winnerId: null,
      playerVPs,
      phase: state.phase,
      turnPhase: state.turnPhase
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to initialize game state.' });
  }
});

// POST /step
app.post('/step', (req, res) => {
  const envId = req.body.envId || 'default';
  const state = envs.get(envId);

  if (!state) {
    return res.status(404).json({ error: `Environment '${envId}' not found. Call /reset first.` });
  }

  if (state.phase === 'end' || state.winnerId !== null) {
    return res.status(400).json({ error: 'Game has already ended. Call /reset.' });
  }

  const actingPlayerId = getNextActingPlayerId(state);
  if (!actingPlayerId) {
    return res.status(500).json({ error: 'No acting player found.' });
  }

  let legalActions = getLegalActions(state, actingPlayerId);
  
  // Stalling/Hanging detector check (same as server/simulate.ts)
  if (legalActions.length === 0) {
    try {
      let fallbackAction: any = null;
      if (state.turnPhase === 'building') {
        fallbackAction = { type: 'END_TURN' };
      } else if (state.turnPhase === 'pre_roll') {
        fallbackAction = { type: 'ROLL_DICE' };
      } else {
        return res.status(400).json({ 
          error: `Player ${actingPlayerId} has no legal actions and no safe fallback action exists.` 
        });
      }
      
      const nextState = processAction(state, fallbackAction, actingPlayerId);
      envs.set(envId, nextState);
      
      const nextActingPlayerId = getNextActingPlayerId(nextState);
      const done = nextState.phase === 'end' || nextState.winnerId !== null;
      const nextLegalActions = nextActingPlayerId && !done ? getLegalActions(nextState, nextActingPlayerId) : [];
      const observation = getObservation(nextState);
      
      const playerVPs: Record<string, number> = {};
      const reward: Record<string, number> = {};
      for (const p of nextState.players) {
        const oldP = state.players.find(o => o.id === p.id)!;
        playerVPs[p.id] = p.victoryPoints;
        reward[p.id] = p.victoryPoints - oldP.victoryPoints;
      }
      
      return res.json({
        envId,
        observation,
        legalActions: nextLegalActions,
        actingPlayerId: nextActingPlayerId,
        done,
        reward,
        winnerId: nextState.winnerId,
        playerVPs,
        phase: nextState.phase,
        turnPhase: nextState.turnPhase
      });
    } catch (err: any) {
      return res.status(500).json({ error: `Fallback action failure: ${err.message}` });
    }
  }

  // Resolve chosen action
  let chosenAction: any = null;
  const { actionIndex, action } = req.body;

  if (actionIndex !== undefined) {
    const idx = parseInt(actionIndex, 10);
    if (isNaN(idx) || idx < 0 || idx >= legalActions.length) {
      return res.status(400).json({ 
        error: `Invalid actionIndex ${actionIndex}. Legal range: [0, ${legalActions.length - 1}]` 
      });
    }
    chosenAction = legalActions[idx];
  } else if (action !== undefined) {
    chosenAction = action;
  } else {
    return res.status(400).json({ error: 'Must provide either actionIndex or action in the body.' });
  }

  try {
    // Apply progress card discard bypass logic (same as simulate.ts)
    if (chosenAction.type === 'END_TURN') {
      const pState = state.players.find(p => p.id === actingPlayerId)!;
      if (pState.progressCards.length > 4) {
        pState.progressCards.splice(4);
      }
    }

    const nextState = processAction(state, chosenAction, actingPlayerId);
    envs.set(envId, nextState);

    const nextActingPlayerId = getNextActingPlayerId(nextState);
    const done = nextState.phase === 'end' || nextState.winnerId !== null;
    const nextLegalActions = nextActingPlayerId && !done ? getLegalActions(nextState, nextActingPlayerId) : [];
    const observation = getObservation(nextState);

    const playerVPs: Record<string, number> = {};
    const reward: Record<string, number> = {};
    for (const p of nextState.players) {
      const oldP = state.players.find(o => o.id === p.id)!;
      playerVPs[p.id] = p.victoryPoints;
      reward[p.id] = p.victoryPoints - oldP.victoryPoints;
    }

    res.json({
      envId,
      observation,
      legalActions: nextLegalActions,
      actingPlayerId: nextActingPlayerId,
      done,
      reward,
      winnerId: nextState.winnerId,
      playerVPs,
      phase: nextState.phase,
      turnPhase: nextState.turnPhase
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error processing action.' });
  }
});

const PORT = process.env.PORT || 5002;
app.listen(PORT, () => {
  console.log(`🚀 Catan Gym Bridge running at http://localhost:${PORT}`);
});
