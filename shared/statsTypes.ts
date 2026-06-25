export interface PlayerProgressSnapshot {
  turnNumber: number;
  playerId: string;
  playerName: string;
  victoryPoints: number;
  scienceLevel: number;
  tradeLevel: number;
  politicsLevel: number;
}

export interface GameSummary {
  id: string;
  date: string;
  durationSeconds: number;
  winnerName: string;
  winnerColor: string;
  players: { name: string; color: string; victoryPoints: number }[];
  totalTurns: number;
  rollHistory: number[];
  eventHistory: string[];
  progressHistory: PlayerProgressSnapshot[];
  barbarianAttackCount: number;
}
