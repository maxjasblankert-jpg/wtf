import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { GameState } from '../../shared/types';
import { createInitialState, processAction } from '../../server/gameEngine';
import { getBotNextAction } from '../../shared/botRunner';
import { saveGameSummary } from '../services/firebaseService';

function checkAndSaveStats(nextState: GameState | null, prevState: GameState | null, roomId: string | null) {
  if (nextState && nextState.phase === 'end' && (!prevState || prevState.phase !== 'end')) {
    const rId = roomId || 'local-game';
    const players = nextState.players.map(p => ({
      name: p.name,
      color: p.color,
      victoryPoints: p.victoryPoints
    }));
    const winnerPlayer = nextState.players.find(p => p.id === nextState.winnerId);
    const winnerName = winnerPlayer ? winnerPlayer.name : 'Unknown';
    const winnerColor = winnerPlayer ? winnerPlayer.color : 'gray';

    let durationSeconds = 0;
    if (nextState.startTime) {
      durationSeconds = Math.floor((Date.now() - new Date(nextState.startTime).getTime()) / 1000);
    }

    const totalTurns = nextState.progressHistory && nextState.progressHistory.length > 0
      ? Math.max(...nextState.progressHistory.map(s => s.turnNumber), 0)
      : 0;

    const summary = {
      id: `${rId}_${nextState.startTime || Date.now()}`,
      date: new Date().toISOString(),
      durationSeconds,
      winnerName,
      winnerColor,
      players,
      totalTurns,
      rollHistory: nextState.rollHistory || [],
      eventHistory: nextState.eventHistory || [],
      progressHistory: nextState.progressHistory || [],
      barbarianAttackCount: nextState.barbarianAttackCount || 0
    };

    saveGameSummary(summary).catch(err => console.error('Error saving game summary:', err));
  }
}

export type ClientActionType =
  | 'build_road'
  | 'build_settlement'
  | 'build_city'
  | 'build_city_wall'
  | 'recruit_knight'
  | 'upgrade_knight'
  | 'activate_knight'
  | 'move_knight'
  | 'displace_knight'
  | 'chase_robber'
  | 'break_road'
  | 'inventor_select'
  | 'deserter_select'
  | 'diplomat_select'
  | 'intrigue_select'
  | 'none';

interface SelectionState {
  actionType: ClientActionType;
  vertexId: string | null;
  edgeId: string | null;
  hexId: string | null;
  cardId: string | null;
  tempSelections: Record<string, any>;
}

interface GameStore {
  gameState: GameState | null;
  lobbyPlayers: { id: string; name: string; color: string }[];
  joinedRoomId: string | null;
  playerId: string | null;
  playerName: string | null;
  playerColor: string | null;
  isConnected: boolean;
  isLobby: boolean;

  localMode: boolean;
  localBots: string[];

  selection: SelectionState;

  setGameState: (state: GameState | null) => void;
  setLobbyPlayers: (players: { id: string; name: string; color: string }[]) => void;
  setRoomInfo: (roomId: string, name: string, color: string, playerId: string) => void;
  setConnected: (connected: boolean) => void;
  setLobbyStatus: (isLobby: boolean) => void;

  setSelectionAction: (actionType: ClientActionType, cardId?: string | null) => void;
  selectVertex: (vertexId: string) => void;
  selectEdge: (edgeId: string) => void;
  selectHex: (hexId: string) => void;
  clearSelection: () => void;
  setTempSelection: (key: string, value: any) => void;

  startLocalGame: (playerName: string, playerColor: string, playerCount: number) => void;
  applyLocalAction: (action: any, playerId: string) => void;

  showTradeModal: boolean;
  setShowTradeModal: (open: boolean) => void;
}

const initialSelection: SelectionState = {
  actionType: 'none',
  vertexId: null,
  edgeId: null,
  hexId: null,
  cardId: null,
  tempSelections: {}
};

export const useGameStore = create<GameStore>()(
  persist(
    (set) => ({
      gameState: null,
      lobbyPlayers: [],
      joinedRoomId: null,
      playerId: null,
      playerName: null,
      playerColor: null,
      isConnected: false,
      isLobby: true,

      localMode: false,
      localBots: [],

      selection: initialSelection,

      showTradeModal: false,
      setShowTradeModal: (showTradeModal) => set({ showTradeModal }),

      setGameState: (gameState) => {
        const prevState = useGameStore.getState().gameState;
        const roomId = useGameStore.getState().joinedRoomId;
        set({ gameState });
        checkAndSaveStats(gameState, prevState, roomId);
      },
      setLobbyPlayers: (lobbyPlayers) => set({ lobbyPlayers }),
      setRoomInfo: (joinedRoomId, playerName, playerColor, playerId) =>
        set({ joinedRoomId, playerName, playerColor, playerId, isLobby: true }),
      setConnected: (isConnected) => set({ isConnected }),
      setLobbyStatus: (isLobby) => set({ isLobby }),

      setSelectionAction: (actionType, cardId = null) =>
        set((state) => ({
          selection: {
            ...initialSelection,
            actionType,
            cardId
          }
        })),

      selectVertex: (vertexId) =>
        set((state) => ({
          selection: {
            ...state.selection,
            vertexId
          }
        })),

      selectEdge: (edgeId) =>
        set((state) => ({
          selection: {
            ...state.selection,
            edgeId
          }
        })),

      selectHex: (hexId) =>
        set((state) => ({
          selection: {
            ...state.selection,
            hexId
          }
        })),

      clearSelection: () => set({ selection: initialSelection }),

      setTempSelection: (key, value) =>
        set((state) => ({
          selection: {
            ...state.selection,
            tempSelections: {
              ...state.selection.tempSelections,
              [key]: value
            }
          }
        })),

      startLocalGame: (playerName, playerColor, playerCount) => {
        // Determine colors not chosen by human
        const botColors = ['blue', 'green', 'orange'].filter(c => c !== playerColor);
        const botNames = ['Bob (Bot)', 'Charlie (Bot)', 'Dave (Bot)'];

        const playersConfig = [
          { id: 'player_human', name: playerName, color: playerColor }
        ];

        const localBots: string[] = [];
        for (let i = 0; i < playerCount - 1; i++) {
          const bId = `player_bot_${i + 1}`;
          playersConfig.push({
            id: bId,
            name: botNames[i],
            color: botColors[i]
          });
          localBots.push(bId);
        }

        const initialState = createInitialState(playersConfig, true);

        set({
          gameState: initialState,
          playerId: 'player_human',
          playerName,
          playerColor,
          joinedRoomId: 'local-game',
          isLobby: false,
          localMode: true,
          localBots
        });

        // In setup phase, human acts first, so no bot runner trigger needed immediately.
      },

      applyLocalAction: (action, actPlayerId) => {
        const state = useGameStore.getState();
        if (!state.gameState) return;

        try {
          const prevState = state.gameState;
          const nextState = processAction(prevState, action, actPlayerId);
          set({ gameState: { ...nextState } });
          checkAndSaveStats(nextState, prevState, state.joinedRoomId);

          // Run bot steps if any bot has actions pending
          setTimeout(() => {
            runBotStep();
          }, 700);
        } catch (e: any) {
          console.error('Local Action Error:', e.message);
          if (actPlayerId === 'player_human') {
            alert(`⚠️ Invalid Action: ${e.message}`);
          }
        }
      }
    }),
    {
      name: 'catan-game-storage',
      partialize: (state) => ({
        gameState: state.gameState,
        joinedRoomId: state.joinedRoomId,
        playerId: state.playerId,
        playerName: state.playerName,
        playerColor: state.playerColor,
        isLobby: state.isLobby,
        localMode: state.localMode,
        localBots: state.localBots
      })
    }
  )
);

export function getActivePlayerId(state: GameState | null): string {
  if (!state) return '';
  let idx = state.currentPlayerIndex;
  if (state.phase === 'setup') {
    const orderLen = state.turnOrder.length;
    if (idx >= orderLen) {
      idx = 2 * orderLen - 1 - idx;
    }
  }
  return state.turnOrder[idx] || '';
}

export function runBotStep() {
  const store = useGameStore.getState();
  if (!store.localMode || !store.gameState || store.gameState.phase === 'end') return;

  const { gameState, localBots } = store;
  const activePlayerId = getActivePlayerId(gameState);

  let botId: string | null = null;

  // 1. Barbarian attack downgrades checking
  if (gameState.phase === 'barbarian_attack') {
    const pendingBot = gameState.pendingDowngrades.find(id => localBots.includes(id));
    if (pendingBot) {
      botId = pendingBot;
    }
  }

  // 2. Discarding cards checks (during a 7 roll resolution)
  if (!botId && gameState.turnPhase === 'post_roll' && !gameState.pendingRobberMove && gameState.pendingStealFrom.length === 0) {
    const pendingDiscardBot = gameState.players.find(p => {
      if (!localBots.includes(p.id)) return false;
      const limit = 7 + 2 * p.cityWallCount;
      const total = Object.values(p.resources).reduce((a, b) => a + b, 0) +
                    Object.values(p.commodities).reduce((a, b) => a + b, 0);
      return total > limit;
    });
    if (pendingDiscardBot) {
      botId = pendingDiscardBot.id;
    }
  }

  // 3. Regular bot turn checking
  if (!botId && localBots.includes(activePlayerId)) {
    botId = activePlayerId;
  }

  if (!botId) return;

  const botAction = getBotNextAction(gameState, botId);
  if (botAction) {
    store.applyLocalAction(botAction, botId);
  }
}

