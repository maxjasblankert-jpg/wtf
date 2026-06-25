import { createInitialState, processAction } from './gameEngine';
import { getObservation, getLegalActions } from './mlHelpers';
import { GameState } from '../shared/types';

// Helper to determine who needs to act next
function getNextActingPlayerId(state: GameState): string | null {
  if (state.phase === 'end') return null;

  // 1. Barbarian attack downgrades resolution
  if (state.phase === 'barbarian_attack' && state.pendingDowngrades.length > 0) {
    return state.pendingDowngrades[0];
  }

  // 2. Discarding cards checking (during a 7 roll resolution)
  if (state.turnPhase === 'post_roll') {
    // If someone is over the hand limit, they must act (discard cards)
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

// Main Headless Simulation Runner
export function runSimulation() {
  console.log('🤖 INITIALIZING HEADLESS SIMULATION...');

  const playersConfig = [
    { id: 'p1', name: 'Alice (Bot)', color: 'red' },
    { id: 'p2', name: 'Bob (Bot)', color: 'blue' },
    { id: 'p3', name: 'Charlie (Bot)', color: 'green' }
  ];

  let state = createInitialState(playersConfig, true);
  console.log('🎲 Board initialized with 3 players.');

  let steps = 0;
  const maxSteps = 5000; // safety ceiling

  while (state.phase !== 'end' && steps < maxSteps) {
    steps++;

    const actingPlayerId = getNextActingPlayerId(state);
    if (!actingPlayerId) {
      console.log('⚠️ No active player found. Terminating.');
      break;
    }

    const player = state.players.find(p => p.id === actingPlayerId)!;
    const legalActions = getLegalActions(state, actingPlayerId);

    if (legalActions.length === 0) {
      console.log(`⚠️ Player ${player.name} (${actingPlayerId}) has NO legal actions. TurnPhase: ${state.turnPhase}, Phase: ${state.phase}. Stalling detector.`);
      // Force end turn or roll to prevent hanging if edge case occurs
      if (state.turnPhase === 'building') {
        state = processAction(state, { type: 'END_TURN' }, actingPlayerId);
      } else if (state.turnPhase === 'pre_roll') {
        state = processAction(state, { type: 'ROLL_DICE' }, actingPlayerId);
      } else {
        console.log('Terminating simulation due to stall.');
        break;
      }
      continue;
    }

    // Select action
    // To speed up simulation, we prioritize Roll Dice and limit building loops
    let chosenAction = legalActions[0];

    const hasRoll = legalActions.find(a => a.type === 'ROLL_DICE');
    const hasEndTurn = legalActions.find(a => a.type === 'END_TURN');

    if (hasRoll) {
      chosenAction = hasRoll;
    } else if (hasEndTurn && Math.random() < 0.35) {
      // 35% chance to end turn if it is possible, to prevent infinite building loops
      chosenAction = hasEndTurn;
    } else {
      // Pick random action
      chosenAction = legalActions[Math.floor(Math.random() * legalActions.length)];
    }

    // Log the selected action
    const actionDesc = JSON.stringify(chosenAction);
    const logPrefix = `[Step ${steps}] ${player.name} performs:`;
    
    try {
      if (chosenAction.type === 'END_TURN') {
        const pState = state.players.find(p => p.id === actingPlayerId)!;
        if (pState.progressCards.length > 4) {
          const discarded = pState.progressCards.splice(4);
          console.log(`[Sim Helper] Discarded excess progress cards for ${pState.name}: ${discarded.map(c => c.title).join(', ')}`);
        }
      }

      state = processAction(state, chosenAction, actingPlayerId);
      
      // Extract observation to verify it is working and size is consistent
      const obs = getObservation(state);
      if (obs.length !== 911) {
        throw new Error(`Invalid observation vector size: expected 911, got ${obs.length}`);
      }

      // Output short summary every 10 steps to not flood console but show progress
      if (steps % 10 === 0 || state.phase === 'end') {
        const standings = state.players.map(p => `${p.name}: ${p.victoryPoints}VP`).join(' | ');
        console.log(`${logPrefix} ${chosenAction.type} -> ${standings} (Barbarian Ship: Pos ${state.barbarians.position})`);
      }
    } catch (e: any) {
      console.error(`❌ Error executing action ${actionDesc} on player ${actingPlayerId}:`, e.message);
      break;
    }
  }

  console.log('\n--- SIMULATION RESULTS ---');
  if (state.phase === 'end') {
    const winner = state.players.find(p => p.id === state.winnerId);
    console.log(`🏆 MATCH COMPLETED in ${steps} steps!`);
    console.log(`🥇 Winner: ${winner ? winner.name : 'Unknown'}`);
    console.log(`🎲 Total Barbarian Attacks: ${state.barbarianAttackCount}`);
    console.log('Standings:');
    state.players.forEach(p => {
      console.log(` - ${p.name}: ${p.victoryPoints} VP (Science: Lv.${p.cityImprovements.blue}, Trade: Lv.${p.cityImprovements.green}, Politics: Lv.${p.cityImprovements.yellow})`);
    });
  } else {
    console.log(`🛑 Simulation ended prematurely or hit max step limit (${maxSteps} steps).`);
  }
}

// Self-execute if run directly
if (process.argv[1] && process.argv[1].endsWith('simulate.ts')) {
  runSimulation();
}
