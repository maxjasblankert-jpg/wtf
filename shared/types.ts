import { PlayerProgressSnapshot } from './statsTypes';

export type Resource = 'lumber' | 'brick' | 'wool' | 'grain' | 'ore';
export type Commodity = 'paper' | 'cloth' | 'coin';

export type TerrainType = 'forest' | 'pasture' | 'fields' | 'hills' | 'mountains' | 'desert' | 'sea';
export type HarborType = '3:1' | '2:1_lumber' | '2:1_brick' | '2:1_wool' | '2:1_grain' | '2:1_ore';

export type KnightLevel = 1 | 2 | 3;          // basic, strong, mighty
export type ImprovementColor = 'green' | 'blue' | 'yellow'; // trade, science, politics
export type ImprovementLevel = 0 | 1 | 2 | 3 | 4 | 5;

export type EventDieFace = 'barbarian' | 'science' | 'trade' | 'politics';

export type ProgressCardType = 'science' | 'trade' | 'politics';

export type ProgressCardName =
  | 'alchemist' | 'crane' | 'engineer' | 'inventor' | 'irrigation' | 'medicine' | 'mining' | 'printer' | 'road_building' | 'smith'
  | 'bishop' | 'commercial_harbor' | 'master_merchant' | 'merchant' | 'merchant_fleet' | 'resource_monopoly' | 'commodity_monopoly' | 'wedding'
  | 'constitution' | 'deserter' | 'diplomat' | 'intrigue' | 'saboteur' | 'spy' | 'warlord';

export interface ProgressCard {
  id: string;
  type: ProgressCardType;
  name: ProgressCardName;
  title: string;
  effect: string;
}

export interface HexTile {
  id: string;
  terrain: TerrainType;
  number: number | null;   // null for desert/sea
  hasRobber: boolean;
  q: number;               // axial q coord
  r: number;               // axial r coord
}

export interface Vertex {
  id: string;
  q: number;               // calculated pixel-space or grid-space identifiers
  r: number;
  dir: 'top' | 'bottom';   // vertices can be classified into two patterns in hex layouts
  adjacentHexIds: string[];
  adjacentEdgeIds: string[];
  adjacentVertexIds: string[];
  harbor: HarborType | null;
  building: null | {
    playerId: string;
    type: 'settlement' | 'city' | 'metropolis';
    hasWall: boolean;        // city walls: only on city or metropolis
  };
}

export interface Edge {
  id: string;
  adjacentVertexIds: [string, string];
  road: null | { playerId: string };
  ship: null | { playerId: string };  // for Seafarers combo (optional)
}

export interface Knight {
  id: string;
  playerId: string;
  vertexId: string;
  level: KnightLevel;    // 1=basic, 2=strong, 3=mighty
  isActive: boolean;     // activated = can act this turn (costs 1 grain to activate)
  recruitedThisTurn: boolean;
  activatedThisTurn: boolean;
}

export interface CityImprovements {
  green: ImprovementLevel;   // Trade: 1=market,2=trading house,3=merchant guild,4=,5=metropolis
  blue: ImprovementLevel;    // Science: 1=library,2=lab,3=academy,4=,5=metropolis
  yellow: ImprovementLevel;  // Politics: 1=town hall,2=mansion,3=fortress (enables mighty knights),4=,5=metropolis
}

export interface PlayerState {
  id: string;
  name: string;
  color: string;
  resources: Record<Resource, number>;
  commodities: Record<Commodity, number>;
  progressCards: ProgressCard[];          // max 4 in hand (5 allowed at start of own turn)
  cityImprovements: CityImprovements;
  cityWallCount: number;                  // max 3
  knightCount: number;
  isDefenderOfCatan: boolean;             // holds "Defender of Catan" special card
  victoryPoints: number;                  // public VP (settlements, cities, metropolises, merchant)
  hiddenVP: number;                       // from Constitution + Printer progress cards
  hasLongestRoad: boolean;
}

export interface BarbariansState {
  position: number;       // 0–6, starts at 7 (off board), moves to 0 = attack
  trackLength: 7;
  hasAttackedOnce: boolean;   // robber locked until first attack
}

export interface MerchantState {
  hexId: string | null;
  playerId: string | null;    // player controlling it earns +1 VP
}

export interface GameState {
  phase: 'setup' | 'main' | 'barbarian_attack' | 'end';
  turnOrder: string[];        // player IDs
  currentPlayerIndex: number;
  turnPhase: 'pre_roll' | 'post_roll' | 'building';
  dice: {
    white: number;            // production die 1
    red: number;              // production die 2 (1–6), used for progress card distribution
    event: EventDieFace;      // event die
    lastRollTotal: number;    // white + red, for resource production (ignores event die)
  };
  hexTiles: HexTile[];
  vertices: Vertex[];
  edges: Edge[];
  knights: Knight[];
  barbarians: BarbariansState;
  merchant: MerchantState;
  players: PlayerState[];
  progressCardDecks: {
    science: ProgressCard[];
    trade: ProgressCard[];
    politics: ProgressCard[];
  };
  defenderOfCatanCards: number;   // stack of special Defender cards
  metropolisOwners: {
    green: string | null;         // player ID owning the Trade metropolis
    blue: string | null;          // Science metropolis
    yellow: string | null;        // Politics metropolis
  };
  log: string[];                  // action log for display
  pendingDowngrades: string[];    // list of player IDs who need to downgrade a city due to barbarian attack
  pendingRobberMove: boolean;     // flag indicating if Robber needs to be moved on a 7
  pendingStealFrom: string[];     // list of player IDs from whom active player can steal after moving robber
  activeProgressCardPlayed: ProgressCardName | null; // currently active progress card resolving state
  alchemistPending: boolean;      // flag if Alchemist is played and waiting for die choice
  winnerId: string | null;
  isPaused?: boolean;
  rollHistory: number[];
  eventHistory: EventDieFace[];
  progressHistory: PlayerProgressSnapshot[];
  barbarianAttackCount: number;
  startTime?: string;
}
