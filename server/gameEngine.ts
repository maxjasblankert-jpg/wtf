import {
  GameState,
  PlayerState,
  HexTile,
  Vertex,
  Edge,
  Knight,
  Resource,
  Commodity,
  TerrainType,
  HarborType,
  ProgressCard,
  ProgressCardName,
  ProgressCardType,
  KnightLevel,
  ImprovementColor,
  ImprovementLevel,
  EventDieFace
} from '../shared/types';

// Helper to generate unique IDs
function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

// -------------------------------------------------------------
// PROGRESS CARD DECKS DEFINITIONS
// -------------------------------------------------------------
const SCIENCE_CARD_DEFS: { name: ProgressCardName; title: string; effect: string }[] = [
  { name: 'alchemist', title: 'Alchemist', effect: 'Choose the result of white+red dice (before rolling); no event die is rolled.' },
  { name: 'crane', title: 'Crane', effect: 'Buy 1 city improvement level for 1 less commodity.' },
  { name: 'engineer', title: 'Engineer', effect: 'Place 1 city wall for free.' },
  { name: 'inventor', title: 'Inventor', effect: 'Swap number tokens on 2 non-desert, non-2, non-12 land hexes.' },
  { name: 'irrigation', title: 'Irrigation', effect: 'Collect 2 grain per field hex you have a city/settlement on.' },
  { name: 'medicine', title: 'Medicine', effect: 'Build a city for 2 grain + 2 ore (instead of 2 grain + 3 ore).' },
  { name: 'mining', title: 'Mining', effect: 'Collect 2 ore per mountain hex you have a city/settlement on.' },
  { name: 'printer', title: 'Printer', effect: 'Gain 1 permanent Victory Point (card stays in play face-up).' },
  { name: 'road_building', title: 'Road Building', effect: 'Build 2 roads for free.' },
  { name: 'smith', title: 'Smith', effect: 'Upgrade 2 knights to their next level for free.' }
];

const TRADE_CARD_DEFS: { name: ProgressCardName; title: string; effect: string }[] = [
  { name: 'bishop', title: 'Bishop', effect: 'Move robber to any desert or sea hex (no stealing).' },
  { name: 'commercial_harbor', title: 'Commercial Harbor', effect: 'Trade 2 identical resources/commodities to the bank for 2 of your choice.' },
  { name: 'master_merchant', title: 'Master Merchant', effect: 'Look at 2 cards in an opponent\'s hand and take 1; only if they have more VP.' },
  { name: 'merchant', title: 'Merchant', effect: 'Place merchant on land hex next to your building: 2:1 trade for that resource + 1 VP.' },
  { name: 'merchant_fleet', title: 'Merchant Fleet', effect: 'Trade 2:1 with bank for any 1 resource/commodity type of choice for the rest of turn.' },
  { name: 'resource_monopoly', title: 'Resource Monopoly', effect: 'All players must give you up to 2 of a chosen resource type.' },
  { name: 'commodity_monopoly', title: 'Commodity Monopoly', effect: 'All players must give you up to 2 of a chosen commodity type.' },
  { name: 'wedding', title: 'Wedding', effect: 'All players with more VP must give you 1 resource + 1 commodity.' }
];

const POLITICS_CARD_DEFS: { name: ProgressCardName; title: string; effect: string }[] = [
  { name: 'constitution', title: 'Constitution', effect: 'Gain 1 permanent Victory Point (card stays in play face-up).' },
  { name: 'deserter', title: 'Deserter', effect: 'Choose an opponent. They remove a knight, and you place one of the same level.' },
  { name: 'diplomat', title: 'Diplomat', effect: 'Remove any open road segment from the board (yours or opponent\'s).' },
  { name: 'intrigue', title: 'Intrigue', effect: 'Move 1 opponent\'s knight off the board (must be next to your road).' },
  { name: 'saboteur', title: 'Saboteur', effect: 'All players with more VP than you must discard half their cards (round down).' },
  { name: 'spy', title: 'Spy', effect: 'Look at 1 player\'s progress cards in hand and steal 1.' },
  { name: 'warlord', title: 'Warlord', effect: 'Activate all of your knights for free.' }
];

function buildDeck(defs: typeof SCIENCE_CARD_DEFS, type: ProgressCardType): ProgressCard[] {
  const cards: ProgressCard[] = [];
  // Fill up to 36 cards
  for (let i = 0; i < 36; i++) {
    const def = defs[i % defs.length];
    cards.push({
      id: `${type}_${i}_${generateId()}`,
      type,
      name: def.name,
      title: def.title,
      effect: def.effect
    });
  }
  return shuffle(cards);
}

function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// -------------------------------------------------------------
// BOARD GENERATOR
// -------------------------------------------------------------
export function generateBoard(): { hexTiles: HexTile[]; vertices: Vertex[]; edges: Edge[] } {
  const S = 100;
  const W = Math.sqrt(3) * S;

  // Land hex terrains & numbers
  const landTerrains: TerrainType[] = [
    'forest', 'forest', 'forest', 'forest',
    'pasture', 'pasture', 'pasture', 'pasture',
    'fields', 'fields', 'fields', 'fields',
    'hills', 'hills', 'hills',
    'mountains', 'mountains', 'mountains',
    'desert'
  ];

  const landNumbers: number[] = [
    2, 12, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11
  ];

  // Deterministic mapping for first layout, or simple coordinates
  const landCoordinates = [
    { q: 0, r: -2 }, { q: 1, r: -2 }, { q: 2, r: -2 },
    { q: -1, r: -1 }, { q: 0, r: -1 }, { q: 1, r: -1 }, { q: 2, r: -1 },
    { q: -2, r: 0 }, { q: -1, r: 0 }, { q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 },
    { q: -2, r: 1 }, { q: -1, r: 1 }, { q: 0, r: 1 }, { q: 1, r: 1 },
    { q: -2, r: 2 }, { q: -1, r: 2 }, { q: 0, r: 2 }
  ];

  // Standard fixed layout pairing
  const standardLayout: { terrain: TerrainType; num: number | null }[] = [
    { terrain: 'hills', num: 5 }, { terrain: 'pasture', num: 2 }, { terrain: 'forest', num: 6 },
    { terrain: 'fields', num: 3 }, { terrain: 'mountains', num: 8 }, { terrain: 'hills', num: 10 }, { terrain: 'pasture', num: 9 },
    { terrain: 'forest', num: 12 }, { terrain: 'fields', num: 11 }, { terrain: 'desert', num: null }, { terrain: 'hills', num: 4 }, { terrain: 'pasture', num: 8 },
    { terrain: 'forest', num: 10 }, { terrain: 'fields', num: 9 }, { terrain: 'mountains', num: 4 }, { terrain: 'pasture', num: 5 },
    { terrain: 'forest', num: 6 }, { terrain: 'fields', num: 3 }, { terrain: 'mountains', num: 11 }
  ];

  const hexTiles: HexTile[] = [];

  // Generate 19 land hexes
  for (let i = 0; i < landCoordinates.length; i++) {
    const { q, r } = landCoordinates[i];
    const layout = standardLayout[i];
    hexTiles.push({
      id: `hex_${q}_${r}`,
      terrain: layout.terrain,
      number: layout.num,
      hasRobber: layout.terrain === 'desert',
      q,
      r
    });
  }

  // Generate 18 sea hexes on the boundary (|q|=3, |r|=3, or |q+r|=3)
  const seaCoordinates: { q: number; r: number }[] = [];
  for (let q = -3; q <= 3; q++) {
    for (let r = -3; r <= 3; r++) {
      if (Math.abs(q) <= 3 && Math.abs(r) <= 3 && Math.abs(q + r) <= 3) {
        // Check if it's on the outer boundary
        if (Math.abs(q) === 3 || Math.abs(r) === 3 || Math.abs(q + r) === 3) {
          seaCoordinates.push({ q, r });
        }
      }
    }
  }

  for (const coord of seaCoordinates) {
    hexTiles.push({
      id: `hex_${coord.q}_${coord.r}`,
      terrain: 'sea',
      number: null,
      hasRobber: false,
      q: coord.q,
      r: coord.r
    });
  }

  // Build topology of vertices and edges
  const verticesMap: Map<string, Vertex> = new Map();
  const edgesMap: Map<string, Edge> = new Map();

  // For each hex, calculate its 6 vertices
  for (const hex of hexTiles) {
    const cx = S * Math.sqrt(3) * (hex.q + hex.r / 2);
    const cy = S * 1.5 * hex.r;

    // Angle offsets for pointy-topped hexes (0 top-most, going clockwise)
    const offsets = [
      { x: 0, y: -S, dir: 'top' },
      { x: W / 2, y: -S / 2, dir: 'bottom' },
      { x: W / 2, y: S / 2, dir: 'top' },
      { x: 0, y: S, dir: 'bottom' },
      { x: -W / 2, y: S / 2, dir: 'top' },
      { x: -W / 2, y: -S / 2, dir: 'bottom' }
    ];

    const localVertices: string[] = [];

    for (let i = 0; i < 6; i++) {
      const vx = cx + offsets[i].x;
      const vy = cy + offsets[i].y;
      const vId = `v_${vx.toFixed(1)}_${vy.toFixed(1)}`;
      localVertices.push(vId);

      if (!verticesMap.has(vId)) {
        verticesMap.set(vId, {
          id: vId,
          q: Math.round(vx),
          r: Math.round(vy),
          dir: offsets[i].dir as 'top' | 'bottom',
          adjacentHexIds: [],
          adjacentEdgeIds: [],
          adjacentVertexIds: [],
          harbor: null,
          building: null
        });
      }

      const vNode = verticesMap.get(vId)!;
      if (!vNode.adjacentHexIds.includes(hex.id)) {
        vNode.adjacentHexIds.push(hex.id);
      }
    }

    // Connect vertices to form edges
    for (let i = 0; i < 6; i++) {
      const vIdA = localVertices[i];
      const vIdB = localVertices[(i + 1) % 6];
      const eId = [vIdA, vIdB].sort().join('--');

      if (!edgesMap.has(eId)) {
        edgesMap.set(eId, {
          id: eId,
          adjacentVertexIds: [vIdA, vIdB],
          road: null,
          ship: null
        });
      }

      const eNode = edgesMap.get(eId)!;
      const vNodeA = verticesMap.get(vIdA)!;
      const vNodeB = verticesMap.get(vIdB)!;

      if (!vNodeA.adjacentEdgeIds.includes(eId)) vNodeA.adjacentEdgeIds.push(eId);
      if (!vNodeB.adjacentEdgeIds.includes(eId)) vNodeB.adjacentEdgeIds.push(eId);
      if (!vNodeA.adjacentVertexIds.includes(vIdB)) vNodeA.adjacentVertexIds.push(vIdB);
      if (!vNodeB.adjacentVertexIds.includes(vIdA)) vNodeB.adjacentVertexIds.push(vIdA);
    }
  }

  const vertices = Array.from(verticesMap.values());
  const edges = Array.from(edgesMap.values());

  // Determine land boundary vertices (adjacent to at least one land tile and one sea tile)
  const isLandHex = (hexId: string) => {
    const parts = hexId.split('_');
    const q = parseInt(parts[1]);
    const r = parseInt(parts[2]);
    return Math.abs(q) <= 2 && Math.abs(r) <= 2 && Math.abs(q + r) <= 2;
  };

  const boundaryVertices = vertices.filter(v => {
    const adjacentHexes = v.adjacentHexIds;
    const hasLand = adjacentHexes.some(hId => isLandHex(hId));
    const hasSea = adjacentHexes.some(hId => !isLandHex(hId));
    return hasLand && hasSea;
  });

  // Sort boundary vertices in polar angle order around center to loop them nicely
  boundaryVertices.sort((a, b) => {
    const angleA = Math.atan2(a.r, a.q);
    const angleB = Math.atan2(b.r, b.q);
    return angleA - angleB;
  });

  // Assign 9 harbors along the boundary Loop (2 adjacent vertices per harbor, with space in between)
  const harborsList: HarborType[] = [
    '3:1', '2:1_lumber', '3:1', '2:1_brick', '3:1', '2:1_wool', '3:1', '2:1_grain', '2:1_ore'
  ];

  // We have boundaryVertices.length (typically 30 for land radius 2 board). Let's distribute 9 harbors
  // Each harbor takes 2 consecutive vertices. That takes 18 vertices total, leaving 12 spacing vertices.
  // Let's place harbor on indexes: 0-1, 3-4, 6-7, 9-10, 13-14, 16-17, 20-21, 23-24, 27-28 (roughly spaced)
  const harborIndices = [0, 3, 6, 9, 13, 16, 20, 23, 27];
  for (let k = 0; k < harborsList.length; k++) {
    const baseIdx = harborIndices[k] % boundaryVertices.length;
    const nextIdx = (baseIdx + 1) % boundaryVertices.length;
    const hType = harborsList[k];

    const vA = boundaryVertices[baseIdx];
    const vB = boundaryVertices[nextIdx];
    vA.harbor = hType;
    vB.harbor = hType;
  }

  return { hexTiles, vertices, edges };
}

// -------------------------------------------------------------
// GAME INITIALIZATION
// -------------------------------------------------------------
export function createInitialState(
  playersConfig: { id: string; name: string; color: string }[],
  randomBoard = false
): GameState {
  const board = generateBoard();

  if (randomBoard) {
    const landTiles = board.hexTiles.filter(h => h.terrain !== 'sea');

    // Shuffled terrains list (excluding sea)
    const landTerrains: TerrainType[] = [
      'forest', 'forest', 'forest', 'forest',
      'pasture', 'pasture', 'pasture', 'pasture',
      'fields', 'fields', 'fields', 'fields',
      'hills', 'hills', 'hills',
      'mountains', 'mountains', 'mountains',
      'desert'
    ];

    const shuffledTerrains = shuffle(landTerrains);
    for (let i = 0; i < landTiles.length; i++) {
      landTiles[i].terrain = shuffledTerrains[i];
      landTiles[i].hasRobber = shuffledTerrains[i] === 'desert';
    }

    // Reshuffle numbers until no two adjacent land tiles have 6 or 8
    let attempts = 0;
    let valid = false;
    const landNumbers: number[] = [
      2, 12, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11
    ];

    while (!valid && attempts < 500) {
      attempts++;
      const shuffledNums = shuffle(landNumbers);
      
      let numIdx = 0;
      for (const hex of landTiles) {
        if (hex.terrain === 'desert') {
          hex.number = null;
        } else {
          hex.number = shuffledNums[numIdx++];
        }
      }
      
      valid = true;
      for (let i = 0; i < landTiles.length; i++) {
        for (let j = i + 1; j < landTiles.length; j++) {
          const h1 = landTiles[i];
          const h2 = landTiles[j];
          if (
            h1.number !== null &&
            h2.number !== null &&
            (h1.number === 6 || h1.number === 8) &&
            (h2.number === 6 || h2.number === 8)
          ) {
            // Axial distance checker
            const dist = (Math.abs(h1.q - h2.q) + Math.abs(h1.q + h1.r - h2.q - h2.r) + Math.abs(h1.r - h2.r)) / 2;
            if (dist === 1) {
              valid = false;
              break;
            }
          }
        }
        if (!valid) break;
      }
    }
  }

  const players: PlayerState[] = playersConfig.map(p => ({
    id: p.id,
    name: p.name,
    color: p.color,
    resources: { lumber: 0, brick: 0, wool: 0, grain: 0, ore: 0 },
    commodities: { paper: 0, cloth: 0, coin: 0 },
    progressCards: [],
    cityImprovements: { green: 0, blue: 0, yellow: 0 },
    cityWallCount: 0,
    knightCount: 0,
    isDefenderOfCatan: false,
    victoryPoints: 0,
    hiddenVP: 0,
    hasLongestRoad: false
  }));

  const turnOrder = players.map(p => p.id);

  const state: GameState = {
    phase: 'setup',
    turnOrder,
    currentPlayerIndex: 0,
    turnPhase: 'pre_roll',
    dice: {
      white: 1,
      red: 1,
      event: 'science',
      lastRollTotal: 2
    },
    hexTiles: board.hexTiles,
    vertices: board.vertices,
    edges: board.edges,
    knights: [],
    barbarians: {
      position: 7,
      trackLength: 7,
      hasAttackedOnce: false
    },
    merchant: {
      hexId: null,
      playerId: null
    },
    players,
    progressCardDecks: {
      science: buildDeck(SCIENCE_CARD_DEFS, 'science'),
      trade: buildDeck(TRADE_CARD_DEFS, 'trade'),
      politics: buildDeck(POLITICS_CARD_DEFS, 'politics')
    },
    defenderOfCatanCards: 6,
    metropolisOwners: {
      green: null,
      blue: null,
      yellow: null
    },
    log: ['Game started. Setup phase begun.'],
    pendingDowngrades: [],
    pendingRobberMove: false,
    pendingStealFrom: [],
    activeProgressCardPlayed: null,
    alchemistPending: false,
    winnerId: null,
    rollHistory: [],
    eventHistory: [],
    progressHistory: [],
    barbarianAttackCount: 0,
    startTime: new Date().toISOString()
  };

  return state;
}

// -------------------------------------------------------------
// VP CALCULATION FUNCTION
// -------------------------------------------------------------
export function recalculateVictoryPoints(state: GameState): void {
  // Update VP for each player
  for (const player of state.players) {
    let vp = 0;

    // 1 VP per settlement
    // 2 VP per City
    // 4 VP total per Metropolis (so +2 VP bonus over city value)
    for (const v of state.vertices) {
      if (v.building && v.building.playerId === player.id) {
        if (v.building.type === 'settlement') {
          vp += 1;
        } else if (v.building.type === 'city') {
          vp += 2;
        } else if (v.building.type === 'metropolis') {
          vp += 4;
        }
      }
    }

    // Longest Road: 2 VP
    if (player.hasLongestRoad) {
      vp += 2;
    }

    // Defender of Catan cards: 1 VP each (wait, isDefenderOfCatan is boolean representing holding the card)
    if (player.isDefenderOfCatan) {
      vp += 1;
    }

    // Merchant control: 1 VP
    if (state.merchant.playerId === player.id) {
      vp += 1;
    }

    // Assign to player
    player.victoryPoints = vp;

    // Victory limit checks (13 VP on own turn)
    // Hidden VPs are added to final win checks
    const totalVP = vp + player.hiddenVP;
    const activePlayerId = state.turnOrder[state.currentPlayerIndex];
    if (totalVP >= 13 && player.id === activePlayerId && state.phase === 'main') {
      state.phase = 'end';
      state.winnerId = player.id;
      state.log.push(`🎉 PLAYER ${player.name} WINS WITH ${totalVP} VICTORY POINTS!`);
    }
  }
}

// -------------------------------------------------------------
// LONGEST ROAD CALCULATOR (FAITHFUL SIMULATION)
// -------------------------------------------------------------
export function calculateLongestRoad(state: GameState): void {
  // Clear previous longest road
  for (const p of state.players) {
    p.hasLongestRoad = false;
  }

  const lengths: Record<string, number> = {};
  for (const player of state.players) {
    lengths[player.id] = getPlayerLongestRoad(state, player.id);
  }

  // Find max length
  let maxLength = 4; // Longest road must be at least 5 segments
  let longestPlayerId: string | null = null;
  let isTie = false;

  for (const pId of state.turnOrder) {
    const len = lengths[pId];
    if (len > maxLength) {
      maxLength = len;
      longestPlayerId = pId;
      isTie = false;
    } else if (len === maxLength) {
      isTie = true;
    }
  }

  if (longestPlayerId && !isTie) {
    const player = state.players.find(p => p.id === longestPlayerId);
    if (player) {
      player.hasLongestRoad = true;
    }
  }
}

function getPlayerLongestRoad(state: GameState, playerId: string): number {
  // Filter roads belonging to player
  const playerRoads = state.edges.filter(e => e.road && e.road.playerId === playerId);
  if (playerRoads.length === 0) return 0;

  // Build adjacency lookup for roads
  const graph: Record<string, string[]> = {};
  for (const road of playerRoads) {
    const [v1, v2] = road.adjacentVertexIds;
    if (!graph[v1]) graph[v1] = [];
    if (!graph[v2]) graph[v2] = [];
    graph[v1].push(v2);
    graph[v2].push(v1);
  }

  let maxLen = 0;

  // DFS to find longest path
  const visitedEdges = new Set<string>();

  function dfs(currVertex: string, depth: number) {
    maxLen = Math.max(maxLen, depth);

    // If vertex contains an ENEMY building or ENEMY knight, the road path is broken
    // Exception: Your own building or knight does NOT break your road.
    const vertexNode = state.vertices.find(v => v.id === currVertex);
    if (vertexNode) {
      // Enemy building check
      if (vertexNode.building && vertexNode.building.playerId !== playerId) {
        return;
      }
      // Enemy knight check
      const knightNode = state.knights.find(k => k.vertexId === currVertex);
      if (knightNode && knightNode.playerId !== playerId) {
        return;
      }
    }

    const neighbors = graph[currVertex] || [];
    for (const nextVertex of neighbors) {
      const edgeId = [currVertex, nextVertex].sort().join('--');
      if (!visitedEdges.has(edgeId)) {
        visitedEdges.add(edgeId);
        dfs(nextVertex, depth + 1);
        visitedEdges.delete(edgeId);
      }
    }
  }

  for (const startVertex of Object.keys(graph)) {
    dfs(startVertex, 0);
  }

  return maxLen;
}

// -------------------------------------------------------------
// RESOURCE PRODUCTION DISTRIBUTION
// -------------------------------------------------------------
export function distributeResources(state: GameState, rolledSum: number): void {
  if (rolledSum === 7) return; // Discards and robber movement handled separately

  state.log.push(`Distributing resources for roll: ${rolledSum}`);

  for (const hex of state.hexTiles) {
    if (hex.number !== rolledSum || hex.terrain === 'sea' || hex.terrain === 'desert') continue;
    if (hex.hasRobber) {
      state.log.push(`Robber blocks production on ${hex.terrain} (${hex.number})`);
      continue;
    }

    // Find all adjacent vertices of this hex
    for (const vId of state.vertices) {
      const vNode = vId;
      if (!vNode.adjacentHexIds.includes(hex.id) || !vNode.building) continue;

      const player = state.players.find(p => p.id === vNode.building!.playerId)!;
      const bType = vNode.building.type;

      if (bType === 'settlement') {
        // Settlements always produce 1 resource
        const res = getTerrainResource(hex.terrain);
        if (res) {
          player.resources[res] += 1;
          state.log.push(`${player.name} gets 1 ${res} from settlement`);
        }
      } else {
        // Cities and Metropolises produce 2 units total:
        // Forest -> 1 lumber + 1 paper
        // Pasture -> 1 wool + 1 cloth
        // Mountains -> 1 ore + 1 coin
        // Fields -> 2 grain
        // Hills -> 2 brick
        const res = getTerrainResource(hex.terrain);
        const comm = getTerrainCommodity(hex.terrain);

        if (comm && res) {
          player.resources[res] += 1;
          player.commodities[comm] += 1;
          state.log.push(`${player.name} gets 1 ${res} and 1 ${comm} from ${bType}`);
        } else if (res) {
          player.resources[res] += 2;
          state.log.push(`${player.name} gets 2 ${res} from ${bType}`);
        }
      }
    }
  }
}

function getTerrainResource(terrain: TerrainType): Resource | null {
  switch (terrain) {
    case 'forest': return 'lumber';
    case 'pasture': return 'wool';
    case 'fields': return 'grain';
    case 'hills': return 'brick';
    case 'mountains': return 'ore';
    default: return null;
  }
}

function getTerrainCommodity(terrain: TerrainType): Commodity | null {
  switch (terrain) {
    case 'forest': return 'paper';
    case 'pasture': return 'cloth';
    case 'mountains': return 'coin';
    default: return null;
  }
}

const colorToDeckKey: Record<ImprovementColor, 'science' | 'trade' | 'politics'> = {
  green: 'trade',
  blue: 'science',
  yellow: 'politics'
};

// -------------------------------------------------------------
// PROGRESS CARD DISTRIBUTION
// -------------------------------------------------------------
export function distributeProgressCards(state: GameState, color: ImprovementColor, redDieValue: number): void {
  state.log.push(`Event Die: ${color} castle. Checking red die ${redDieValue} for improvements.`);

  for (const player of state.players) {
    const improvementLvl = player.cityImprovements[color];
    let eligible = false;

    if (improvementLvl === 1 && (redDieValue === 1 || redDieValue === 2)) {
      eligible = true;
    } else if (improvementLvl >= 2 && redDieValue <= improvementLvl + 1) {
      eligible = true;
    }

    if (eligible) {
      drawProgressCard(state, player.id, color);
    }
  }
}

function drawProgressCard(state: GameState, playerId: string, color: ImprovementColor): void {
  const player = state.players.find(p => p.id === playerId)!;
  const targetKey = colorToDeckKey[color];
  let deck = state.progressCardDecks[targetKey];

  if (deck.length === 0) {
    // Check if other decks have cards
    const otherColors: ImprovementColor[] = ['green', 'blue', 'yellow'].filter(c => c !== color) as ImprovementColor[];
    let fallbackColor = otherColors.find(c => state.progressCardDecks[colorToDeckKey[c]].length > 0);

    if (fallbackColor) {
      deck = state.progressCardDecks[colorToDeckKey[fallbackColor]];
      state.log.push(`${color} deck empty. Drawing ${fallbackColor} progress card for ${player.name}`);
    } else {
      // All progress decks empty. Award a Defender of Catan card (+1 VP) if available
      if (state.defenderOfCatanCards > 0) {
        state.defenderOfCatanCards -= 1;
        player.isDefenderOfCatan = true;
        state.log.push(`All progress decks empty! ${player.name} receives Defender of Catan card from supply`);
        recalculateVictoryPoints(state);
      } else {
        state.log.push(`All decks and Defender cards are empty! No card drawn.`);
      }
      return;
    }
  }

  const card = deck.pop()!;
  if (card.name === 'constitution' || card.name === 'printer') {
    player.hiddenVP += 1;
    state.log.push(`${player.name} draws and immediately plays ${card.title} (+1 VP, kept face-up)`);
    recalculateVictoryPoints(state);
  } else {
    player.progressCards.push(card);
    state.log.push(`${player.name} draws a ${card.title} progress card (${color})`);
  }
}

// -------------------------------------------------------------
// BARBARIAN ATTACK RESOLUTION
// -------------------------------------------------------------
export function resolveBarbarianAttack(state: GameState): void {
  state.barbarians.hasAttackedOnce = true;

  // 1. Calculate Barbarian Strength = number of cities + metropolises
  let barbarianStrength = 0;
  for (const v of state.vertices) {
    if (v.building && (v.building.type === 'city' || v.building.type === 'metropolis')) {
      barbarianStrength += 1;
    }
  }

  // 2. Calculate Active Knight Defense
  let knightDefense = 0;
  const playerKnightDefense: Record<string, number> = {};

  for (const p of state.players) {
    playerKnightDefense[p.id] = 0;
  }

  for (const k of state.knights) {
    if (k.isActive) {
      knightDefense += k.level;
      playerKnightDefense[k.playerId] += k.level;
    }
  }

  state.log.push(`⚔️ Barbarian Attack! Barbarian Strength: ${barbarianStrength}, Knight Defense: ${knightDefense}`);
  state.barbarianAttackCount = (state.barbarianAttackCount || 0) + 1;

  if (knightDefense >= barbarianStrength) {
    // Success: Catan is defended!
    // Find the player who contributed the most active knight levels
    let maxDefense = -1;
    let topContributors: string[] = [];

    for (const pId of state.turnOrder) {
      const def = playerKnightDefense[pId];
      if (def > maxDefense) {
        maxDefense = def;
        topContributors = [pId];
      } else if (def === maxDefense) {
        topContributors.push(pId);
      }
    }

    if (topContributors.length === 1) {
      // Unique winner gets Defender of Catan card
      const winnerId = topContributors[0];
      const winner = state.players.find(p => p.id === winnerId)!;

      // Transfer Defender card from previous owner (if exists)
      for (const p of state.players) {
        if (p.isDefenderOfCatan) {
          p.isDefenderOfCatan = false;
          state.log.push(`${p.name} loses the Defender of Catan card`);
        }
      }

      winner.isDefenderOfCatan = true;
      state.log.push(`🏆 Catan Defended! ${winner.name} contributed the most defense (${maxDefense}) and is named Defender of Catan (+1 VP)`);
    } else {
      // Tie for most defense: each tied player draws a Politics (yellow) progress card
      state.log.push(`🏆 Catan Defended! Tie for most defense (${maxDefense}). Tied players draw a Politics progress card.`);
      for (const pId of topContributors) {
        drawProgressCard(state, pId, 'yellow');
      }
    }
  } else {
    // Failure: Barbarians win!
    // Find player(s) with the fewest active knight levels (excluding players with no cities to lose)
    let minDefense = 999;
    let losers: string[] = [];

    for (const player of state.players) {
      // Check if player has any cities (not metropolises) to lose
      let hasCities = false;
      for (const v of state.vertices) {
        if (v.building && v.building.playerId === player.id && v.building.type === 'city') {
          hasCities = true;
          break;
        }
      }

      if (!hasCities) continue; // Excluded from losing

      const def = playerKnightDefense[player.id];
      if (def < minDefense) {
        minDefense = def;
        losers = [player.id];
      } else if (def === minDefense) {
        losers.push(player.id);
      }
    }

    if (losers.length > 0) {
      state.log.push(`💔 Catan Pillaged! Barbarians defeat our knights. Players with fewest defense who own cities: ${losers.map(l => state.players.find(p => p.id === l)!.name).join(', ')}`);
      state.pendingDowngrades = [...losers];
      state.phase = 'barbarian_attack';
    } else {
      state.log.push(`💔 Catan Pillaged! But no players had cities to lose.`);
    }
  }

  // Deactivate all knights
  for (const k of state.knights) {
    k.isActive = false;
  }

  // Reset Barbarian ship position to 7
  state.barbarians.position = 7;
  recalculateVictoryPoints(state);
}

// -------------------------------------------------------------
// BUILDING / COST RESOURCE SUBTRACTION
// -------------------------------------------------------------
function payResources(player: PlayerState, cost: { res?: Record<Resource, number>; comm?: Record<Commodity, number> }): void {
  if (cost.res) {
    for (const [r, qty] of Object.entries(cost.res) as [Resource, number][]) {
      player.resources[r] -= qty;
    }
  }
  if (cost.comm) {
    for (const [c, qty] of Object.entries(cost.comm) as [Commodity, number][]) {
      player.commodities[c] -= qty;
    }
  }
}

function hasResources(player: PlayerState, cost: { res?: Record<Resource, number>; comm?: Record<Commodity, number> }): boolean {
  if (cost.res) {
    for (const [r, qty] of Object.entries(cost.res) as [Resource, number][]) {
      if (player.resources[r] < qty) return false;
    }
  }
  if (cost.comm) {
    for (const [c, qty] of Object.entries(cost.comm) as [Commodity, number][]) {
      if (player.commodities[c] < qty) return false;
    }
  }
  return true;
}

const COST_ROAD = { res: { lumber: 1, brick: 1, wool: 0, grain: 0, ore: 0 } };
const COST_SETTLEMENT = { res: { lumber: 1, brick: 1, wool: 1, grain: 1, ore: 0 } };
const COST_CITY = { res: { lumber: 0, brick: 0, wool: 0, grain: 2, ore: 3 } };
const COST_CITY_WALL = { res: { lumber: 0, brick: 2, wool: 0, grain: 0, ore: 0 } };
const COST_KNIGHT = { res: { lumber: 0, brick: 0, wool: 1, grain: 0, ore: 1 } };
const COST_KNIGHT_UPGRADE = { res: { lumber: 0, brick: 0, wool: 1, grain: 0, ore: 1 } };
const COST_KNIGHT_ACTIVATION = { res: { lumber: 0, brick: 0, wool: 0, grain: 1, ore: 0 } };

// -------------------------------------------------------------
// GAME STATE ENGINE: ACTION DISPATCHER
// -------------------------------------------------------------
export function processAction(state: GameState, action: any, playerId: string): GameState {
  // Validate state phase and turn order
  let activePlayerId = state.turnOrder[state.currentPlayerIndex];
  if (state.phase === 'setup') {
    const orderLen = state.turnOrder.length;
    let idx = state.currentPlayerIndex;
    if (idx >= orderLen) {
      idx = 2 * orderLen - 1 - idx;
    }
    activePlayerId = state.turnOrder[idx];
  }

  if (state.phase === 'end') {
    throw new Error('Game is over.');
  }

  // Handle out-of-turn actions (like DOWNGRADE_CITY or DISCARD_CARDS or TRADE_ACCEPT)
  if (action.type === 'DOWNGRADE_CITY') {
    return handleDowngradeCity(state, action, playerId);
  }
  if (action.type === 'DISCARD_CARDS') {
    return handleDiscardCards(state, action, playerId);
  }
  if (action.type === 'TRADE_ACCEPT' || action.type === 'TRADE_REJECT') {
    return handleTradeResponse(state, action, playerId);
  }

  // All other actions must be by the active player
  if (playerId !== activePlayerId) {
    throw new Error('It is not your turn.');
  }

  switch (action.type) {
    case 'ROLL_DICE':
      return handleRollDice(state, playerId);

    case 'SELECT_ALCHEMIST_DICE':
      return handleAlchemistDice(state, action, playerId);

    case 'BUILD':
      return handleBuild(state, action, playerId);

    case 'RECRUIT_KNIGHT':
      return handleRecruitKnight(state, action, playerId);

    case 'UPGRADE_KNIGHT':
      return handleUpgradeKnight(state, action, playerId);

    case 'ACTIVATE_KNIGHT':
      return handleActivateKnight(state, action, playerId);

    case 'MOVE_KNIGHT':
      return handleMoveKnight(state, action, playerId);

    case 'USE_KNIGHT_ACTION':
      return handleKnightAction(state, action, playerId);

    case 'BUY_IMPROVEMENT':
      return handleBuyImprovement(state, action, playerId);

    case 'PLAY_PROGRESS_CARD':
      return handlePlayProgressCard(state, action, playerId);

    case 'TRADE_OFFER':
      return handleTradeOffer(state, action, playerId);

    case 'MOVE_ROBBER':
      return handleMoveRobber(state, action, playerId);

    case 'STEAL_CARD':
      return handleStealCard(state, action, playerId);

    case 'CLAIM_ALMS': {
      const player = state.players.find(p => p.id === playerId)!;
      if (player.cityImprovements.blue < 3) {
        throw new Error('Requires Science Level 3.');
      }
      if (state.turnPhase !== 'building') {
        throw new Error('Can only claim Alms during action phase.');
      }
      const activePlayerId = state.turnOrder[state.currentPlayerIndex];
      if (activePlayerId !== playerId) {
        throw new Error('Not your turn.');
      }
      const alreadyClaimed = state.log.some(msg => msg.includes(`${player.name} claimed Alms`));
      if (alreadyClaimed) {
        throw new Error('Already claimed Alms this turn.');
      }
      if (state.dice.lastRollTotal === 7) {
        throw new Error('Alms cannot be claimed on a 7 roll.');
      }
      const gotCards = state.log.some(msg => msg.includes(`${player.name} gets`) && !msg.includes('claimed Alms'));
      if (gotCards) {
        throw new Error('You received cards during production this turn.');
      }
      const res = action.resource as Resource;
      if (!['lumber', 'brick', 'wool', 'grain', 'ore'].includes(res)) {
        throw new Error('Invalid resource choice.');
      }
      player.resources[res] += 1;
      state.log.push(`${player.name} claimed Alms: +1 ${res}`);
      return state;
    }

    case 'END_TURN':
      return handleEndTurn(state, playerId);

    default:
      throw new Error(`Unknown action type: ${action.type}`);
  }
}

// -------------------------------------------------------------
// TURN PRE-ROLL ACTIONS & ROLL DICE
// -------------------------------------------------------------
function handleRollDice(state: GameState, playerId: string): GameState {
  if (state.phase !== 'main') {
    throw new Error('Cannot roll dice outside of main game phase.');
  }
  if (state.turnPhase !== 'pre_roll') {
    throw new Error('Dice already rolled or incorrect phase.');
  }

  // Roll white, red, and event dice
  const w = Math.floor(Math.random() * 6) + 1;
  const r = Math.floor(Math.random() * 6) + 1;

  const eventFaces: EventDieFace[] = ['barbarian', 'barbarian', 'barbarian', 'science', 'trade', 'politics'];
  const ev = eventFaces[Math.floor(Math.random() * eventFaces.length)];

  return executeRoll(state, w, r, ev, playerId);
}

function handleAlchemistDice(state: GameState, action: { white: number; red: number }, playerId: string): GameState {
  if (state.phase !== 'main' || state.turnPhase !== 'pre_roll') {
    throw new Error('Invalid phase for Alchemist choice.');
  }
  if (!state.alchemistPending) {
    throw new Error('Alchemist choice is not pending.');
  }
  if (action.white < 1 || action.white > 6 || action.red < 1 || action.red > 6) {
    throw new Error('Invalid die numbers.');
  }

  state.alchemistPending = false;
  state.activeProgressCardPlayed = null;

  // Alchemist: Choose white and red dice, NO event die rolled (so event is not run)
  state.dice = {
    white: action.white,
    red: action.red,
    event: 'science', // set default event, but we don't trigger event actions!
    lastRollTotal: action.white + action.red
  };

  if (!state.rollHistory) state.rollHistory = [];
  state.rollHistory.push(action.white + action.red);

  state.log.push(`Alchemist card played. ${state.players.find(p => p.id === playerId)!.name} chose white: ${action.white}, red: ${action.red}`);

  // Resolve resource production only (no event die effects!)
  const total = action.white + action.red;
  if (total === 7) {
    resolveSevenRoll(state);
  } else {
    distributeResources(state, total);
    state.turnPhase = 'building';
  }

  recalculateVictoryPoints(state);
  return state;
}

function executeRoll(state: GameState, w: number, r: number, ev: EventDieFace, playerId: string): GameState {
  const total = w + r;
  state.dice = {
    white: w,
    red: r,
    event: ev,
    lastRollTotal: total
  };

  if (!state.rollHistory) state.rollHistory = [];
  state.rollHistory.push(total);
  if (!state.eventHistory) state.eventHistory = [];
  state.eventHistory.push(ev);

  const pName = state.players.find(p => p.id === playerId)!.name;
  state.log.push(`🎲 ${pName} rolled: White ${w}, Red ${r} (Total: ${total}), Event: ${ev.toUpperCase()}`);

  // 1. Resolve event die first (Barbarian advancement)
  let barbarianTriggered = false;
  if (ev === 'barbarian') {
    state.barbarians.position -= 1;
    state.log.push(`🚢 Barbarian ship moves closer! Position: ${state.barbarians.position}`);
    if (state.barbarians.position === 0) {
      resolveBarbarianAttack(state);
      barbarianTriggered = true;
    }
  } else {
    // Castle color: distribute progress cards
    const color = ev === 'science' ? 'blue' : ev === 'trade' ? 'green' : 'yellow';
    distributeProgressCards(state, color, r);
  }

  // If barbarian attack resulted in downgrades, we are now in the 'barbarian_attack' phase
  // and we must suspend resource production until downgrades are resolved.
  if (state.phase === 'barbarian_attack') {
    state.log.push(`Barbarian attack downgrades pending. Resource production suspended.`);
    return state;
  }

  // 2. Resolve production (unless sum is 7)
  if (total === 7) {
    resolveSevenRoll(state);
  } else {
    distributeResources(state, total);
    state.turnPhase = 'building';
  }

  recalculateVictoryPoints(state);
  return state;
}

function resolveSevenRoll(state: GameState): void {
  state.log.push(`7 Rolled! Enforcing hand limits.`);
  // Find all players who are over their limit
  const playersToDiscard: string[] = [];

  for (const player of state.players) {
    const handLimit = 7 + 2 * player.cityWallCount;
    const totalCards = Object.values(player.resources).reduce((a, b) => a + b, 0) +
                       Object.values(player.commodities).reduce((a, b) => a + b, 0);

    if (totalCards > handLimit) {
      playersToDiscard.push(player.id);
    }
  }

  if (playersToDiscard.length > 0) {
    state.log.push(`Players over hand limit: ${playersToDiscard.map(id => state.players.find(p => p.id === id)!.name).join(', ')}`);
    // Wait for discards
    state.turnPhase = 'post_roll';
  } else {
    // Proceed directly to robber movement (if first attack has occurred)
    if (state.barbarians.hasAttackedOnce) {
      state.pendingRobberMove = true;
      state.turnPhase = 'post_roll';
    } else {
      state.turnPhase = 'building';
      state.log.push(`First barbarian attack has not occurred. Robber locked.`);
    }
  }
}

// -------------------------------------------------------------
// POST-ROLL DISCARDS, ROBBER MOVES & STEALS
// -------------------------------------------------------------
function handleDiscardCards(state: GameState, action: { resources: Record<Resource, number>; commodities: Record<Commodity, number> }, playerId: string): GameState {
  const player = state.players.find(p => p.id === playerId)!;
  const handLimit = 7 + 2 * player.cityWallCount;
  const totalCards = Object.values(player.resources).reduce((a, b) => a + b, 0) +
                     Object.values(player.commodities).reduce((a, b) => a + b, 0);

  if (totalCards <= handLimit) {
    throw new Error('You do not need to discard.');
  }

  const discardQty = Math.floor(totalCards / 2);
  const resourceDiscard = action.resources || { lumber: 0, brick: 0, wool: 0, grain: 0, ore: 0 };
  const commodityDiscard = action.commodities || { paper: 0, cloth: 0, coin: 0 };

  const chosenQty = Object.values(resourceDiscard).reduce((a, b) => a + b, 0) +
                    Object.values(commodityDiscard).reduce((a, b) => a + b, 0);

  if (chosenQty !== discardQty) {
    throw new Error(`Must discard exactly ${discardQty} cards. You selected ${chosenQty}.`);
  }

  // Validate player has these cards
  for (const [r, qty] of Object.entries(resourceDiscard) as [Resource, number][]) {
    if (player.resources[r] < qty) throw new Error(`Insufficient ${r} in hand.`);
  }
  for (const [c, qty] of Object.entries(commodityDiscard) as [Commodity, number][]) {
    if (player.commodities[c] < qty) throw new Error(`Insufficient ${c} in hand.`);
  }

  // Subtract
  for (const [r, qty] of Object.entries(resourceDiscard) as [Resource, number][]) {
    player.resources[r] -= qty;
  }
  for (const [c, qty] of Object.entries(commodityDiscard) as [Commodity, number][]) {
    player.commodities[c] -= qty;
  }

  state.log.push(`${player.name} discarded ${discardQty} cards.`);

  // Check if all players have completed discards
  const pendingPlayers = state.players.filter(p => {
    const limit = 7 + 2 * p.cityWallCount;
    const cards = Object.values(p.resources).reduce((a, b) => a + b, 0) +
                  Object.values(p.commodities).reduce((a, b) => a + b, 0);
    return cards > limit;
  });

  if (pendingPlayers.length === 0) {
    // Discards finished! Now move robber if first attack has happened
    if (state.barbarians.hasAttackedOnce) {
      state.pendingRobberMove = true;
      state.turnPhase = 'post_roll';
    } else {
      state.turnPhase = 'building';
    }
  }

  return state;
}

function handleMoveRobber(state: GameState, action: { hexId: string }, playerId: string): GameState {
  if (!state.pendingRobberMove) {
    throw new Error('Robber movement is not pending.');
  }

  const hex = state.hexTiles.find(h => h.id === action.hexId);
  if (!hex || hex.terrain === 'sea') {
    throw new Error('Invalid robber destination.');
  }
  if (hex.hasRobber) {
    throw new Error('Robber is already on that hex.');
  }

  // Move Robber
  for (const h of state.hexTiles) {
    h.hasRobber = false;
  }
  hex.hasRobber = true;
  state.pendingRobberMove = false;

  const pName = state.players.find(p => p.id === playerId)!.name;
  state.log.push(`${pName} moves Robber to ${hex.terrain} (${hex.number})`);

  // Find players to steal from (must have a building on adjacent vertices and cards in hand)
  const adjacentPlayers = new Set<string>();
  for (const v of state.vertices) {
    if (v.adjacentHexIds.includes(hex.id) && v.building && v.building.playerId !== playerId) {
      // Check if player has resources/commodities to steal
      const target = state.players.find(p => p.id === v.building!.playerId)!;
      const cardCount = Object.values(target.resources).reduce((a, b) => a + b, 0) +
                        Object.values(target.commodities).reduce((a, b) => a + b, 0);
      if (cardCount > 0) {
        adjacentPlayers.add(v.building.playerId);
      }
    }
  }

  if (adjacentPlayers.size === 0) {
    state.log.push('No adjacent players to steal from.');
    state.turnPhase = 'building';
  } else {
    state.pendingStealFrom = Array.from(adjacentPlayers);
    // Active player must now steal
    state.turnPhase = 'post_roll';
  }

  return state;
}

function handleStealCard(state: GameState, action: { targetPlayerId: string }, playerId: string): GameState {
  if (state.pendingStealFrom.length === 0) {
    throw new Error('Stealing is not pending.');
  }
  if (!state.pendingStealFrom.includes(action.targetPlayerId)) {
    throw new Error('Cannot steal from this player.');
  }

  const activePlayer = state.players.find(p => p.id === playerId)!;
  const targetPlayer = state.players.find(p => p.id === action.targetPlayerId)!;

  // Build a list of all cards in target player's hand
  const cardsPool: (Resource | Commodity)[] = [];
  for (const [r, qty] of Object.entries(targetPlayer.resources) as [Resource, number][]) {
    for (let i = 0; i < qty; i++) cardsPool.push(r);
  }
  for (const [c, qty] of Object.entries(targetPlayer.commodities) as [Commodity, number][]) {
    for (let i = 0; i < qty; i++) cardsPool.push(c);
  }

  if (cardsPool.length === 0) {
    throw new Error('Target player has no cards in hand.');
  }

  // Draw 1 random card
  const stolenCard = cardsPool[Math.floor(Math.random() * cardsPool.length)];

  if (stolenCard === 'lumber' || stolenCard === 'brick' || stolenCard === 'wool' || stolenCard === 'grain' || stolenCard === 'ore') {
    targetPlayer.resources[stolenCard] -= 1;
    activePlayer.resources[stolenCard] += 1;
  } else {
    targetPlayer.commodities[stolenCard] -= 1;
    activePlayer.commodities[stolenCard] += 1;
  }

  state.log.push(`${activePlayer.name} steals a random card from ${targetPlayer.name}`);
  state.pendingStealFrom = [];
  state.turnPhase = 'building';

  return state;
}

// -------------------------------------------------------------
// BUILDING OPERATIONS
// -------------------------------------------------------------
function handleBuild(state: GameState, action: { buildType: string; targetId: string }, playerId: string): GameState {
  if (state.phase === 'setup') {
    return handleSetupBuild(state, action, playerId);
  }

  if (state.turnPhase !== 'building') {
    throw new Error('You cannot build in this phase.');
  }

  const player = state.players.find(p => p.id === playerId)!;

  if (action.buildType === 'road') {
    // Validation
    const edge = state.edges.find(e => e.id === action.targetId);
    if (!edge) throw new Error('Edge does not exist.');
    if (edge.road) throw new Error('Road already exists.');

    // Check cost
    if (!hasResources(player, COST_ROAD)) throw new Error('Insufficient resources for road.');

    // Distance/connectivity check
    if (!isConnectedToPlayerRoads(state, edge, playerId)) {
      throw new Error('Road must connect to your existing network.');
    }

    payResources(player, COST_ROAD);
    edge.road = { playerId };
    state.log.push(`${player.name} built a road`);
    calculateLongestRoad(state);
  }
  else if (action.buildType === 'settlement') {
    const vertex = state.vertices.find(v => v.id === action.targetId);
    if (!vertex) throw new Error('Vertex does not exist.');
    if (vertex.building) throw new Error('Building already exists.');

    // Check player settlement limit (5 max)
    const settlementCount = state.vertices.filter(v => v.building && v.building.playerId === playerId && v.building.type === 'settlement').length;
    if (settlementCount >= 5) {
      throw new Error('You have built the maximum number of settlements (5). You must upgrade to a city first.');
    }

    if (!hasResources(player, COST_SETTLEMENT)) throw new Error('Insufficient resources for settlement.');

    // Settlement placement checks
    if (!isVertexDistanceRuleMet(state, vertex)) {
      throw new Error('Must respect the distance rule (at least 2 edges away from other buildings).');
    }
    if (!isConnectedToRoad(state, vertex, playerId)) {
      throw new Error('Settlement must connect to your roads.');
    }

    payResources(player, COST_SETTLEMENT);
    vertex.building = { playerId, type: 'settlement', hasWall: false };
    state.log.push(`${player.name} built a settlement`);
    calculateLongestRoad(state);
  }
  else if (action.buildType === 'city') {
    const vertex = state.vertices.find(v => v.id === action.targetId);
    if (!vertex) throw new Error('Vertex does not exist.');
    if (!vertex.building || vertex.building.playerId !== playerId) {
      throw new Error('Must own the settlement you are upgrading.');
    }
    if (vertex.building.type !== 'settlement') {
      throw new Error('Can only upgrade settlements to cities.');
    }

    // Check city limit (4 max)
    const cityCount = state.vertices.filter(v => v.building && v.building.playerId === playerId && v.building.type === 'city').length;
    if (cityCount >= 4) {
      throw new Error('You have built the maximum number of cities (4).');
    }

    let cost = COST_CITY;
    // Check if Medicine progress card is active
    if (state.activeProgressCardPlayed === 'medicine') {
      cost = { res: { lumber: 0, brick: 0, wool: 0, grain: 2, ore: 2 } };
      state.activeProgressCardPlayed = null; // consume
    }

    if (!hasResources(player, cost)) throw new Error('Insufficient resources for city.');

    payResources(player, cost);
    vertex.building.type = 'city';
    state.log.push(`${player.name} upgraded settlement to city`);
  }
  else if (action.buildType === 'city_wall') {
    const vertex = state.vertices.find(v => v.id === action.targetId);
    if (!vertex) throw new Error('Vertex does not exist.');
    if (!vertex.building || vertex.building.playerId !== playerId) {
      throw new Error('Must own the city to build a wall.');
    }
    if (vertex.building.type !== 'city' && vertex.building.type !== 'metropolis') {
      throw new Error('Can only build city walls under a city or metropolis.');
    }
    if (vertex.building.hasWall) {
      throw new Error('City already has a wall.');
    }
    if (player.cityWallCount >= 3) {
      throw new Error('Max 3 city walls per player.');
    }

    let cost = COST_CITY_WALL;
    // Check if Engineer progress card is active
    if (state.activeProgressCardPlayed === 'engineer') {
      cost = { res: { lumber: 0, brick: 0, wool: 0, grain: 0, ore: 0 } };
      state.activeProgressCardPlayed = null;
    }

    if (!hasResources(player, cost)) throw new Error('Insufficient resources for city wall.');

    payResources(player, cost);
    vertex.building.hasWall = true;
    player.cityWallCount += 1;
    state.log.push(`${player.name} built a city wall`);
  }
  else {
    throw new Error('Invalid build type.');
  }

  recalculateVictoryPoints(state);
  return state;
}

// Setup building rules (snake placement)
function handleSetupBuild(state: GameState, action: { buildType: string; targetId: string }, playerId: string): GameState {
  const player = state.players.find(p => p.id === playerId)!;

  // Determine if player needs to place building or road
  // Setup pass logic:
  // 1st round (P1 -> P2 -> P3): 1 settlement + 1 road
  // 2nd round (P3 -> P2 -> P1): 1 city + 1 road
  // We can track whose turn it is usingcurrentPlayerIndex
  const round = state.currentPlayerIndex < state.turnOrder.length ? 1 : 2;

  const playerBuildings = state.vertices.filter(v => v.building && v.building.playerId === playerId);
  const playerRoads = state.edges.filter(e => e.road && e.road.playerId === playerId);

  if (round === 1) {
    if (playerBuildings.length === 0) {
      // Must place settlement
      if (action.buildType !== 'settlement') throw new Error('Must place a settlement first.');
      const vertex = state.vertices.find(v => v.id === action.targetId);
      if (!vertex) throw new Error('Invalid vertex.');
      if (vertex.building) throw new Error('Space occupied.');
      if (!isVertexDistanceRuleMet(state, vertex)) throw new Error('Must respect distance rule.');

      vertex.building = { playerId, type: 'settlement', hasWall: false };
      state.log.push(`${player.name} placed starting settlement`);
    } else if (playerRoads.length === 0) {
      // Must place road
      if (action.buildType !== 'road') throw new Error('Must place a road now.');
      const edge = state.edges.find(e => e.id === action.targetId);
      if (!edge) throw new Error('Invalid edge.');
      if (edge.road) throw new Error('Space occupied.');

      // Must connect to starting settlement
      const settlementVertex = playerBuildings[0];
      if (!edge.adjacentVertexIds.includes(settlementVertex.id)) {
        throw new Error('Road must connect to starting settlement.');
      }

      edge.road = { playerId };
      state.log.push(`${player.name} placed starting road`);

      // Auto-advance setup index
      advanceSetupTurn(state);
    } else {
      throw new Error('Wait for your turn.');
    }
  } else {
    // Round 2
    if (playerBuildings.length === 1) {
      // Must place city
      if (action.buildType !== 'city') throw new Error('Must place starting city now.');
      const vertex = state.vertices.find(v => v.id === action.targetId);
      if (!vertex) throw new Error('Invalid vertex.');
      if (vertex.building) throw new Error('Space occupied.');
      if (!isVertexDistanceRuleMet(state, vertex)) throw new Error('Must respect distance rule.');

      vertex.building = { playerId, type: 'city', hasWall: false };
      state.log.push(`${player.name} placed starting city`);

      // Start city produces adjacent land resources on placement
      for (const hexId of vertex.adjacentHexIds) {
        const hex = state.hexTiles.find(h => h.id === hexId)!;
        const res = getTerrainResource(hex.terrain);
        if (res) {
          player.resources[res] += 1;
        }
      }
    } else if (playerRoads.length === 1) {
      // Must place road
      if (action.buildType !== 'road') throw new Error('Must place a road now.');
      const edge = state.edges.find(e => e.id === action.targetId);
      if (!edge) throw new Error('Invalid edge.');
      if (edge.road) throw new Error('Space occupied.');

      // Must connect to starting city
      const cityVertex = playerBuildings.find(v => v.building!.type === 'city')!;
      if (!edge.adjacentVertexIds.includes(cityVertex.id)) {
        throw new Error('Road must connect to starting city.');
      }

      edge.road = { playerId };
      state.log.push(`${player.name} placed starting road`);

      // Auto-advance setup index
      advanceSetupTurn(state);
    } else {
      throw new Error('Wait for your turn.');
    }
  }

  recalculateVictoryPoints(state);
  return state;
}

function advanceSetupTurn(state: GameState): void {
  // Setup sequence:
  // Forward pass: 0 -> 1 -> 2
  // Reverse pass: 5 (representing index 2) -> 4 (index 1) -> 3 (index 0)
  // Let's implement setup currentPlayerIndex mapping from 0 to 2*turnOrder.length - 1
  const orderLen = state.turnOrder.length;
  const nextIdx = state.currentPlayerIndex + 1;

  if (nextIdx < 2 * orderLen) {
    state.currentPlayerIndex = nextIdx;
    // Map setup index to turnOrder index:
    // 0 -> 0, 1 -> 1, 2 -> 2
    // 3 -> 2, 4 -> 1, 5 -> 0
    let mapIdx = nextIdx;
    if (nextIdx >= orderLen) {
      mapIdx = 2 * orderLen - 1 - nextIdx;
    }
    state.log.push(`It is now ${state.players.find(p => p.id === state.turnOrder[mapIdx])!.name}'s turn for setup.`);
  } else {
    // Setup complete! Transition to main game phase
    state.phase = 'main';
    state.currentPlayerIndex = 0; // P1 starts
    state.turnPhase = 'pre_roll';
    state.log.push('Setup phase complete! Main game phase has begun.');
  }
}

// Connectivity Helpers
function isConnectedToPlayerRoads(state: GameState, edge: Edge, playerId: string): boolean {
  // Checks if edge shares a vertex with an edge containing a road owned by playerId
  for (const vId of edge.adjacentVertexIds) {
    // Blocked if vertex contains an enemy building
    const vertex = state.vertices.find(v => v.id === vId)!;
    if (vertex.building && vertex.building.playerId !== playerId) continue;

    // Check adjacent edges
    for (const eId of vertex.adjacentEdgeIds) {
      const eNode = state.edges.find(e => e.id === eId)!;
      if (eNode.road && eNode.road.playerId === playerId) {
        return true;
      }
    }
  }
  return false;
}

function isConnectedToRoad(state: GameState, vertex: Vertex, playerId: string): boolean {
  for (const eId of vertex.adjacentEdgeIds) {
    const edge = state.edges.find(e => e.id === eId)!;
    if (edge.road && edge.road.playerId === playerId) {
      return true;
    }
  }
  return false;
}

function isVertexDistanceRuleMet(state: GameState, vertex: Vertex): boolean {
  // Returns false if any adjacent vertex contains a building
  for (const adjVId of vertex.adjacentVertexIds) {
    const adjVNode = state.vertices.find(v => v.id === adjVId)!;
    if (adjVNode.building) return false;
  }
  return true;
}

// -------------------------------------------------------------
// KNIGHT MANAGEMENT OPERATIONS
// -------------------------------------------------------------
function handleRecruitKnight(state: GameState, action: { vertexId: string }, playerId: string): GameState {
  if (state.turnPhase !== 'building') throw new Error('Cannot recruit knights in this phase.');

  const player = state.players.find(p => p.id === playerId)!;
  const vertex = state.vertices.find(v => v.id === action.vertexId);

  if (!vertex) throw new Error('Vertex does not exist.');
  if (vertex.building) throw new Error('Space occupied by a building.');

  const existingKnight = state.knights.find(k => k.vertexId === action.vertexId);
  if (existingKnight) throw new Error('Space occupied by another knight.');

  // Supply check: max 2 basic (lvl 1)
  const lvl1Count = state.knights.filter(k => k.playerId === playerId && k.level === 1).length;
  if (lvl1Count >= 2) throw new Error('No basic knights left in your supply.');

  // Road adjacency check
  if (!isConnectedToRoad(state, vertex, playerId)) {
    throw new Error('Knight must be placed adjacent to your road network.');
  }

  // Distance rule: cannot be adjacent to existing building or knight
  if (!isVertexDistanceRuleMet(state, vertex)) {
    throw new Error('Must respect distance rule: cannot place adjacent to other buildings.');
  }

  for (const adjVId of vertex.adjacentVertexIds) {
    if (state.knights.some(k => k.vertexId === adjVId)) {
      throw new Error('Cannot recruit adjacent to another knight.');
    }
  }

  // Cost check
  if (!hasResources(player, COST_KNIGHT)) throw new Error('Insufficient resources to recruit knight.');

  payResources(player, COST_KNIGHT);

  const newKnight: Knight = {
    id: `knight_${generateId()}`,
    playerId,
    vertexId: vertex.id,
    level: 1,
    isActive: false,
    recruitedThisTurn: true,
    activatedThisTurn: false
  };

  state.knights.push(newKnight);
  state.log.push(`${player.name} recruited a basic knight`);
  return state;
}

function handleUpgradeKnight(state: GameState, action: { knightId: string }, playerId: string): GameState {
  if (state.turnPhase !== 'building') throw new Error('Cannot upgrade knights in this phase.');

  const player = state.players.find(p => p.id === playerId)!;
  const knight = state.knights.find(k => k.id === action.knightId);

  if (!knight || knight.playerId !== playerId) {
    throw new Error('Must own the knight to upgrade it.');
  }

  if (knight.level === 3) {
    throw new Error('Knight is already at max level.');
  }

  // Cost checking
  if (!hasResources(player, COST_KNIGHT_UPGRADE)) throw new Error('Insufficient resources to upgrade knight.');

  if (knight.level === 1) {
    // Level 1 -> 2 (Strong)
    const lvl2Count = state.knights.filter(k => k.playerId === playerId && k.level === 2).length;
    if (lvl2Count >= 2) throw new Error('No strong knights left in your supply.');

    payResources(player, COST_KNIGHT_UPGRADE);
    knight.level = 2;
    state.log.push(`${player.name} upgraded a knight to Strong (Level 2)`);
  } else if (knight.level === 2) {
    // Level 2 -> 3 (Mighty)
    // Requires Yellow improvement level 3
    if (player.cityImprovements.yellow < 3) {
      throw new Error('Mighty knights require Fortress (Politics level 3).');
    }

    const lvl3Count = state.knights.filter(k => k.playerId === playerId && k.level === 3).length;
    if (lvl3Count >= 2) throw new Error('No mighty knights left in your supply.');

    payResources(player, COST_KNIGHT_UPGRADE);
    knight.level = 3;
    state.log.push(`${player.name} upgraded a knight to Mighty (Level 3)`);
  }

  return state;
}

function handleActivateKnight(state: GameState, action: { knightId: string }, playerId: string): GameState {
  // Knight activation can be done in pre-roll OR post-roll/building phase
  const player = state.players.find(p => p.id === playerId)!;
  const knight = state.knights.find(k => k.id === action.knightId);

  if (!knight || knight.playerId !== playerId) {
    throw new Error('Must own the knight to activate it.');
  }

  if (knight.isActive) {
    throw new Error('Knight is already active.');
  }

  // Cost check (1 grain)
  if (!hasResources(player, COST_KNIGHT_ACTIVATION)) {
    throw new Error('Need 1 grain to activate knight.');
  }

  payResources(player, COST_KNIGHT_ACTIVATION);
  knight.isActive = true;
  knight.activatedThisTurn = true;

  state.log.push(`${player.name} activated a knight`);
  return state;
}

function handleMoveKnight(state: GameState, action: { knightId: string; targetVertexId: string }, playerId: string): GameState {
  // Movement must happen in pre-roll phase
  if (state.turnPhase !== 'pre_roll') {
    throw new Error('Knight movements are only allowed during the pre-roll phase.');
  }

  const knight = state.knights.find(k => k.id === action.knightId);
  if (!knight || knight.playerId !== playerId) throw new Error('Must own the knight.');
  if (!knight.isActive) throw new Error('Knight must be active to move.');

  // Validate action restriction: place & activate & act same turn is forbidden
  if (knight.recruitedThisTurn && knight.activatedThisTurn) {
    throw new Error('You cannot use a knight on the same turn it was both recruited and activated.');
  }

  const targetVertex = state.vertices.find(v => v.id === action.targetVertexId);
  if (!targetVertex) throw new Error('Target space does not exist.');
  if (targetVertex.building) throw new Error('Target space is occupied by a building.');

  if (state.knights.some(k => k.vertexId === action.targetVertexId)) {
    throw new Error('Target space is occupied by another knight.');
  }

  // Verify connectivity along road network (DFS path finder along own roads, not through enemy buildings/knights)
  if (!hasRoadPath(state, knight.vertexId, action.targetVertexId, playerId)) {
    throw new Error('No road path connects the knight to the destination.');
  }

  // Move
  knight.vertexId = action.targetVertexId;
  knight.isActive = false; // counts as action, deactivates!

  const pName = state.players.find(p => p.id === playerId)!.name;
  state.log.push(`${pName} moved knight to vertex`);
  calculateLongestRoad(state); // movement might change road breaks
  return state;
}

function handleKnightAction(state: GameState, action: { knightId: string; actionType: string; targetId: string }, playerId: string): GameState {
  if (state.turnPhase !== 'pre_roll') {
    throw new Error('Knight actions must occur in the pre-roll phase.');
  }

  const knight = state.knights.find(k => k.id === action.knightId);
  if (!knight || knight.playerId !== playerId) throw new Error('Must own the knight.');
  if (!knight.isActive) throw new Error('Knight must be active.');

  if (knight.recruitedThisTurn && knight.activatedThisTurn) {
    throw new Error('You cannot act with a knight on the same turn it was both recruited and activated.');
  }

  const player = state.players.find(p => p.id === playerId)!;

  if (action.actionType === 'chase_robber') {
    if (!state.barbarians.hasAttackedOnce) {
      throw new Error('Cannot chase robber before first barbarian attack.');
    }
    // Verify robber hex adjacency
    const hex = state.hexTiles.find(h => h.id === action.targetId);
    if (!hex) throw new Error('Invalid hex.');
    if (!hex.hasRobber) throw new Error('No robber on target hex.');

    // Verify knight is adjacent to the robber hex
    const vNode = state.vertices.find(v => v.id === knight.vertexId)!;
    if (!vNode.adjacentHexIds.includes(hex.id)) {
      throw new Error('Knight must be adjacent to the robber hex to chase it.');
    }

    // Set robber pending move
    state.pendingRobberMove = true;
    knight.isActive = false;
    state.log.push(`${player.name} used knight to chase robber.`);
  }
  else if (action.actionType === 'displace') {
    // Displace enemy knight on the same vertex
    // The targetId is the target vertex ID containing the enemy knight
    const vTarget = state.vertices.find(v => v.id === action.targetId);
    if (!vTarget) throw new Error('Invalid target vertex.');

    const enemyKnight = state.knights.find(k => k.vertexId === action.targetId);
    if (!enemyKnight || enemyKnight.playerId === playerId) {
      throw new Error('Must target an enemy knight.');
    }

    if (knight.level < enemyKnight.level) {
      throw new Error('Cannot displace a higher-level knight.');
    }

    // Path check: must have a road connection to target vertex
    if (!isConnectedToRoad(state, vTarget, playerId)) {
      throw new Error('Must have a road connected to displacement vertex.');
    }

    // Displace enemy knight
    // Move enemy knight to adjacent vacant vertex connected by road. If impossible, return to supply.
    const adjVacant = vTarget.adjacentVertexIds.filter(vId => {
      const vNode = state.vertices.find(v => v.id === vId)!;
      const pathRoad = state.edges.find(e => e.adjacentVertexIds.includes(vTarget.id) && e.adjacentVertexIds.includes(vId) && e.road && e.road.playerId === enemyKnight.playerId);
      const spaceOccupied = state.knights.some(k => k.vertexId === vId) || vNode.building;
      return pathRoad && !spaceOccupied;
    });

    state.knights = state.knights.filter(k => k.id !== enemyKnight.id); // remove target
    if (adjVacant.length > 0) {
      // Displace to first vacant road vertex
      const newVId = adjVacant[0];
      state.knights.push({
        ...enemyKnight,
        vertexId: newVId
      });
      state.log.push(`${player.name} displaced ${state.players.find(p => p.id === enemyKnight.playerId)!.name}'s knight to adjacent road.`);
    } else {
      state.log.push(`${player.name} displaced ${state.players.find(p => p.id === enemyKnight.playerId)!.name}'s knight back to their supply.`);
    }

    // Move player's knight to that vertex
    knight.vertexId = vTarget.id;
    knight.isActive = false; // deactivates!
    calculateLongestRoad(state);
  }
  else if (action.actionType === 'break_road') {
    // Knight moves to a vertex between two enemy road segments, breaking their road path
    const vTarget = state.vertices.find(v => v.id === action.targetId);
    if (!vTarget) throw new Error('Invalid vertex.');
    if (vTarget.building) throw new Error('Cannot break road at building vertex.');

    // Knight must move to that vertex
    if (!isConnectedToRoad(state, vTarget, playerId)) {
      throw new Error('Must have a road connection to vertex.');
    }

    if (state.knights.some(k => k.vertexId === vTarget.id)) {
      throw new Error('Vertex already occupied.');
    }

    knight.vertexId = vTarget.id;
    knight.isActive = false;

    state.log.push(`${player.name} placed a knight to break enemy road connection`);
    calculateLongestRoad(state);
  }
  else {
    throw new Error('Invalid knight action.');
  }

  return state;
}

// DFS road network path check
function hasRoadPath(state: GameState, startVId: string, endVId: string, playerId: string): boolean {
  const visited = new Set<string>();
  const queue: string[] = [startVId];

  while (queue.length > 0) {
    const curr = queue.shift()!;
    if (curr === endVId) return true;
    visited.add(curr);

    const vertexNode = state.vertices.find(v => v.id === curr)!;
    // Cannot pass through enemy buildings or enemy knights
    if (vertexNode.id !== startVId) {
      if (vertexNode.building && vertexNode.building.playerId !== playerId) continue;
      const kn = state.knights.find(k => k.vertexId === curr);
      if (kn && kn.playerId !== playerId) continue;
    }

    for (const edgeId of vertexNode.adjacentEdgeIds) {
      const edge = state.edges.find(e => e.id === edgeId)!;
      if (edge.road && edge.road.playerId === playerId) {
        const nextVId = edge.adjacentVertexIds.find(id => id !== curr)!;
        if (!visited.has(nextVId) && !queue.includes(nextVId)) {
          queue.push(nextVId);
        }
      }
    }
  }

  return false;
}

// -------------------------------------------------------------
// CITY IMPROVEMENTSTRACKS
// -------------------------------------------------------------
function handleBuyImprovement(state: GameState, action: { color: ImprovementColor }, playerId: string): GameState {
  if (state.turnPhase !== 'building') {
    throw new Error('Cannot buy improvements in this phase.');
  }

  const player = state.players.find(p => p.id === playerId)!;
  const color = action.color;
  const currentLvl = player.cityImprovements[color];

  if (currentLvl === 5) {
    throw new Error('Track is already at level 5.');
  }

  const targetLvl = (currentLvl + 1) as ImprovementLevel;

  // Level 4+ check: requires at least 1 city (not metropolis) on the board
  if (targetLvl >= 4) {
    const standardCityCount = state.vertices.filter(v => v.building && v.building.playerId === playerId && v.building.type === 'city').length;
    if (standardCityCount === 0) {
      throw new Error('Buying level 4+ requires at least one active standard city on the board.');
    }
  }

  // Cost: N commodities of that color
  let costQty: number = targetLvl;
  // Apply Crane discount (buy city improvement for 1 less commodity)
  if (state.activeProgressCardPlayed === 'crane') {
    costQty = Math.max(0, costQty - 1);
    state.activeProgressCardPlayed = null; // consume
  }

  const comm: Commodity = color === 'green' ? 'cloth' : color === 'blue' ? 'paper' : 'coin';

  if (player.commodities[comm] < costQty) {
    throw new Error(`Need ${costQty} ${comm} to upgrade. You have ${player.commodities[comm]}.`);
  }

  // Pay
  player.commodities[comm] -= costQty;
  player.cityImprovements[color] = targetLvl;
  state.log.push(`${player.name} purchased ${color} improvement level ${targetLvl}`);

  // Metropolis award check
  if (targetLvl === 5) {
    awardMetropolis(state, color, playerId);
  }

  recalculateVictoryPoints(state);
  return state;
}

function awardMetropolis(state: GameState, color: ImprovementColor, playerId: string): void {
  const currentOwnerId = state.metropolisOwners[color];

  if (currentOwnerId === playerId) return; // already owns

  const player = state.players.find(p => p.id === playerId)!;

  // Find a standard city of this player to place the metropolis on
  const playerCity = state.vertices.find(v => v.building && v.building.playerId === playerId && v.building.type === 'city');

  if (!playerCity) {
    // The player doesn't have a city. Wait, is this possible? They had to have a city to buy level 4, but they might have downgraded it
    // or bought level 5 in a turn where they lost a city. If they have no standard city, they cannot place the metropolis.
    // In Cities & Knights, you must have a city to hold a metropolis. If not, the metropolis owner is null until they build a city.
    state.log.push(`${player.name} reached level 5 in ${color} but has no standard city to place the metropolis on!`);
    return;
  }

  // Remove metropolis from previous owner (downgrade their metropolis to a standard city)
  if (currentOwnerId) {
    const prevOwner = state.players.find(p => p.id === currentOwnerId)!;
    const prevMetropolis = state.vertices.find(v => v.building && v.building.playerId === currentOwnerId && v.building.type === 'metropolis');
    if (prevMetropolis) {
      prevMetropolis.building!.type = 'city';
      state.log.push(`${prevOwner.name} loses the ${color} metropolis to ${player.name}`);
    }
  }

  // Upgrade player's city to metropolis
  playerCity.building!.type = 'metropolis';
  state.metropolisOwners[color] = playerId;

  state.log.push(`👑 ${player.name} claims the ${color} Metropolis! (+2 VP)`);
}

// -------------------------------------------------------------
// PROGRESS CARDS LOGIC & RESOLUTIONS
// -------------------------------------------------------------
function handlePlayProgressCard(state: GameState, action: { cardId: string; params?: any }, playerId: string): GameState {
  // Validate hand contains card
  const player = state.players.find(p => p.id === playerId)!;
  const cardIndex = player.progressCards.findIndex(c => c.id === action.cardId);

  if (cardIndex === -1) {
    throw new Error('You do not hold this progress card.');
  }

  const card = player.progressCards[cardIndex];

  // Turn phase checks: play only in pre_roll unless specified (Alchemist is pre_roll, Crane/Road building can be post-roll)
  // Let's enforce that progress cards can be played in either pre_roll or building phase, but Alchemist MUST be pre-roll.
  if (card.name === 'alchemist' && state.turnPhase !== 'pre_roll') {
    throw new Error('Alchemist must be played BEFORE rolling the dice.');
  }

  state.log.push(`${player.name} plays progress card: ${card.title}`);

  // Discard card from hand (except Constitution / Printer which stay in play)
  if (card.name === 'constitution' || card.name === 'printer') {
    player.progressCards.splice(cardIndex, 1);
    player.hiddenVP += 1; // stays in play, gives permanent +1 hidden VP
    state.log.push(`${player.name} places ${card.title} in play (+1 VP)`);
  } else if (card.name === 'alchemist') {
    // Alchemist suspension
    player.progressCards.splice(cardIndex, 1);
    state.alchemistPending = true;
    state.activeProgressCardPlayed = 'alchemist';
  } else {
    // Standard cards
    player.progressCards.splice(cardIndex, 1);
    resolveCardEffect(state, card.name, action.params, playerId);
  }

  recalculateVictoryPoints(state);
  return state;
}

function resolveCardEffect(state: GameState, name: ProgressCardName, params: any, playerId: string): void {
  const player = state.players.find(p => p.id === playerId)!;

  switch (name) {
    case 'crane':
      // Buy 1 city improvement level free (1 discount)
      state.activeProgressCardPlayed = 'crane';
      break;

    case 'engineer':
      // Build 1 city wall for free
      state.activeProgressCardPlayed = 'engineer';
      break;

    case 'road_building':
      // Active player gets resources for 2 roads immediately (1 lumber, 1 brick each)
      // or we just build them? Let's give them resources to build them!
      player.resources.lumber += 2;
      player.resources.brick += 2;
      state.log.push('Road Building: Awarded 2 lumber and 2 brick.');
      break;

    case 'medicine':
      // Build city for 2 grain + 2 ore
      state.activeProgressCardPlayed = 'medicine';
      break;

    case 'irrigation':
      // Collect 2 grain per fields hex you have buildings on
      let grainCollected = 0;
      for (const v of state.vertices) {
        if (v.building && v.building.playerId === playerId) {
          // Count fields hexes adjacent
          for (const hId of v.adjacentHexIds) {
            const hex = state.hexTiles.find(h => h.id === hId)!;
            if (hex.terrain === 'fields') {
              grainCollected += 2;
            }
          }
        }
      }
      player.resources.grain += grainCollected;
      state.log.push(`Irrigation: Collected ${grainCollected} grain.`);
      break;

    case 'mining':
      // Collect 2 ore per mountains hex you have buildings on
      let oreCollected = 0;
      for (const v of state.vertices) {
        if (v.building && v.building.playerId === playerId) {
          for (const hId of v.adjacentHexIds) {
            const hex = state.hexTiles.find(h => h.id === hId)!;
            if (hex.terrain === 'mountains') {
              oreCollected += 2;
            }
          }
        }
      }
      player.resources.ore += oreCollected;
      state.log.push(`Mining: Collected ${oreCollected} ore.`);
      break;

    case 'inventor':
      // Swap number tokens on 2 land hexes (not 2, 12, desert, or sea)
      const hexA = state.hexTiles.find(h => h.id === params.hexIdA);
      const hexB = state.hexTiles.find(h => h.id === params.hexIdB);

      if (!hexA || !hexB) throw new Error('Invalid hex selections.');
      if (hexA.terrain === 'sea' || hexA.terrain === 'desert' || hexB.terrain === 'sea' || hexB.terrain === 'desert') {
        throw new Error('Cannot swap sea or desert tokens.');
      }
      if (hexA.number === 2 || hexA.number === 12 || hexB.number === 2 || hexB.number === 12) {
        throw new Error('Cannot swap 2 or 12 tokens.');
      }

      const tempNum = hexA.number;
      hexA.number = hexB.number;
      hexB.number = tempNum;

      state.log.push(`Inventor: Swapped tokens between ${hexA.terrain} and ${hexB.terrain}.`);
      break;

    case 'smith':
      // Upgrade 2 knights for free
      const knightA = state.knights.find(k => k.id === params.knightIdA);
      const knightB = state.knights.find(k => k.id === params.knightIdB);

      if (knightA && knightA.playerId === playerId && knightA.level < 3) {
        knightA.level = (knightA.level + 1) as KnightLevel;
        state.log.push('Smith: Upgraded knight A.');
      }
      if (knightB && knightB.playerId === playerId && knightB.level < 3) {
        knightB.level = (knightB.level + 1) as KnightLevel;
        state.log.push('Smith: Upgraded knight B.');
      }
      break;

    case 'bishop':
      // Move robber to desert/sea hex
      const robHex = state.hexTiles.find(h => h.id === params.hexId);
      if (!robHex || (robHex.terrain !== 'desert' && robHex.terrain !== 'sea')) {
        throw new Error('Bishop card requires a desert or sea destination.');
      }
      for (const h of state.hexTiles) h.hasRobber = false;
      robHex.hasRobber = true;
      state.log.push(`Bishop: Robber moved to ${robHex.terrain}.`);
      break;

    case 'commercial_harbor':
      // Trade 2 identical for 2 choice (commercial harbor)
      const payRes = params.payCard; // e.g. 'lumber'
      const takeRes1 = params.takeCard1; // e.g. 'grain'
      const takeRes2 = params.takeCard2; // e.g. 'ore'

      const isPayResource = ['lumber', 'brick', 'wool', 'grain', 'ore'].includes(payRes);
      const qtyOwned = isPayResource ? player.resources[payRes as Resource] : player.commodities[payRes as Commodity];

      if (qtyOwned < 2) throw new Error('Need at least 2 identical cards to trade.');

      // Pay
      if (isPayResource) player.resources[payRes as Resource] -= 2;
      else player.commodities[payRes as Commodity] -= 2;

      // Receive
      if (['lumber', 'brick', 'wool', 'grain', 'ore'].includes(takeRes1)) player.resources[takeRes1 as Resource] += 1;
      else player.commodities[takeRes1 as Commodity] += 1;

      if (['lumber', 'brick', 'wool', 'grain', 'ore'].includes(takeRes2)) player.resources[takeRes2 as Resource] += 1;
      else player.commodities[takeRes2 as Commodity] += 1;

      state.log.push(`Commercial Harbor: Traded 2 ${payRes} for 1 ${takeRes1} and 1 ${takeRes2}.`);
      break;

    case 'master_merchant':
      const target = state.players.find(p => p.id === params.targetPlayerId)!;
      if (target.victoryPoints <= player.victoryPoints) {
        throw new Error('Can only target an opponent with more VPs.');
      }
      // Steal 1 chosen card out of 2 random cards in hand
      const targetCards: (Resource | Commodity)[] = [];
      for (const [r, qty] of Object.entries(target.resources) as [Resource, number][]) {
        for (let i = 0; i < qty; i++) targetCards.push(r);
      }
      for (const [c, qty] of Object.entries(target.commodities) as [Commodity, number][]) {
        for (let i = 0; i < qty; i++) targetCards.push(c);
      }

      if (targetCards.length < 2) {
        // Just take what they have if less than 2
        if (targetCards.length === 1) {
          const c = targetCards[0];
          if (['lumber', 'brick', 'wool', 'grain', 'ore'].includes(c)) {
            target.resources[c as Resource] -= 1;
            player.resources[c as Resource] += 1;
          } else {
            target.commodities[c as Commodity] -= 1;
            player.commodities[c as Commodity] += 1;
          }
          state.log.push(`Master Merchant: Stole only card (${c}) from ${target.name}`);
        }
      } else {
        // Draw 2 random cards, player chooses 1 in params (we simulate by taking the chosen param if it's one of the 2, or just random)
        const drawn = shuffle(targetCards).slice(0, 2);
        const chosen = params.chosenCard && drawn.includes(params.chosenCard) ? params.chosenCard : drawn[0];

        if (['lumber', 'brick', 'wool', 'grain', 'ore'].includes(chosen)) {
          target.resources[chosen as Resource] -= 1;
          player.resources[chosen as Resource] += 1;
        } else {
          target.commodities[chosen as Commodity] -= 1;
          player.commodities[chosen as Commodity] += 1;
        }
        state.log.push(`Master Merchant: Stole 1 card (${chosen}) from ${target.name}`);
      }
      break;

    case 'merchant':
      // Place merchant token on land hex adjacent to settlement/city
      const mHex = state.hexTiles.find(h => h.id === params.hexId);
      if (!mHex || mHex.terrain === 'sea' || mHex.terrain === 'desert') {
        throw new Error('Merchant must be placed on a productive land hex.');
      }
      // Adjacency check
      const hasAdjacentBuilding = state.vertices.some(v => v.adjacentHexIds.includes(mHex.id) && v.building && v.building.playerId === playerId);
      if (!hasAdjacentBuilding) {
        throw new Error('Merchant must be adjacent to your settlement/city.');
      }

      state.merchant.hexId = mHex.id;
      state.merchant.playerId = playerId;
      state.log.push(`Merchant: Token placed on ${mHex.terrain} hex by ${player.name}.`);
      break;

    case 'merchant_fleet':
      // Trade 2:1 for rest of turn
      state.activeProgressCardPlayed = 'merchant_fleet';
      break;

    case 'resource_monopoly':
      // Select resource, all players give you 1 (max 2)
      const resMono = params.resource as Resource;
      for (const p of state.players) {
        if (p.id === playerId) continue;
        const count = Math.min(2, p.resources[resMono]);
        p.resources[resMono] -= count;
        player.resources[resMono] += count;
        state.log.push(`${p.name} gave ${count} ${resMono} to monopoly.`);
      }
      break;

    case 'commodity_monopoly':
      // Select commodity, all players give you 1 (max 2)
      const commMono = params.commodity as Commodity;
      for (const p of state.players) {
        if (p.id === playerId) continue;
        const count = Math.min(2, p.commodities[commMono]);
        p.commodities[commMono] -= count;
        player.commodities[commMono] += count;
        state.log.push(`${p.name} gave ${count} ${commMono} to monopoly.`);
      }
      break;

    case 'wedding':
      // All players with more VP must give 1 resource + 1 commodity
      for (const p of state.players) {
        if (p.id === playerId) continue;
        if (p.victoryPoints > player.victoryPoints) {
          // Find first available resource
          const resKey = (Object.keys(p.resources) as Resource[]).find(k => p.resources[k] > 0);
          const commKey = (Object.keys(p.commodities) as Commodity[]).find(k => p.commodities[k] > 0);

          if (resKey) {
            p.resources[resKey] -= 1;
            player.resources[resKey] += 1;
          }
          if (commKey) {
            p.commodities[commKey] -= 1;
            player.commodities[commKey] += 1;
          }
          state.log.push(`${p.name} sent wedding gifts to ${player.name}`);
        }
      }
      break;

    case 'deserter':
      // Remove enemy knight, place one of your own of same level
      const desTarget = state.players.find(p => p.id === params.targetPlayerId)!;
      const enemyKnightToDes = state.knights.find(k => k.id === params.knightId && k.playerId === desTarget.id);

      if (!enemyKnightToDes) throw new Error('Must target an enemy knight.');

      // Remove
      state.knights = state.knights.filter(k => k.id !== enemyKnightToDes.id);

      // Try to place on valid vertex for player
      const desVertex = state.vertices.find(v => v.id === params.vertexId);
      if (desVertex && !desVertex.building && !state.knights.some(k => k.vertexId === desVertex.id)) {
        state.knights.push({
          id: `knight_${generateId()}`,
          playerId,
          vertexId: desVertex.id,
          level: enemyKnightToDes.level,
          isActive: false,
          recruitedThisTurn: true,
          activatedThisTurn: false
        });
        state.log.push(`Deserter: Claimed knight from ${desTarget.name} and placed on vertex.`);
      } else {
        state.log.push(`Deserter: Removed ${desTarget.name}'s knight, but could not place due to invalid/blocked vertex.`);
      }
      break;

    case 'diplomat':
      // Remove any open road segment
      const roadEdge = state.edges.find(e => e.id === params.edgeId);
      if (!roadEdge || !roadEdge.road) throw new Error('Must target a road.');

      // An open road is one that has at least one end not connected to another road/building of the owner
      // Let's implement simpler validation: can remove any road that doesn't have buildings on both ends
      const roadOwnerId = roadEdge.road.playerId;
      let isConnectA = false;
      let isConnectB = false;

      const [vA, vB] = roadEdge.adjacentVertexIds;
      const vNodeA = state.vertices.find(v => v.id === vA)!;
      const vNodeB = state.vertices.find(v => v.id === vB)!;

      if (vNodeA.building && vNodeA.building.playerId === roadOwnerId) isConnectA = true;
      if (vNodeB.building && vNodeB.building.playerId === roadOwnerId) isConnectB = true;

      // Also check adjacent roads
      for (const eId of vNodeA.adjacentEdgeIds) {
        if (eId === roadEdge.id) continue;
        const eNode = state.edges.find(e => e.id === eId)!;
        if (eNode.road && eNode.road.playerId === roadOwnerId) isConnectA = true;
      }
      for (const eId of vNodeB.adjacentEdgeIds) {
        if (eId === roadEdge.id) continue;
        const eNode = state.edges.find(e => e.id === eId)!;
        if (eNode.road && eNode.road.playerId === roadOwnerId) isConnectB = true;
      }

      if (isConnectA && isConnectB) {
        throw new Error('Cannot remove a road connected on both ends.');
      }

      roadEdge.road = null;
      state.log.push(`Diplomat: Removed road from board.`);
      calculateLongestRoad(state);
      break;

    case 'intrigue':
      // Move 1 opponent's knight off board (returned to supply). Must be adjacent to your road segment
      const knToMove = state.knights.find(k => k.id === params.knightId && k.playerId !== playerId);
      if (!knToMove) throw new Error('Target knight not found.');

      // Check adjacency to your road network
      const knVertex = state.vertices.find(v => v.id === knToMove.vertexId)!;
      const adjToMyRoad = isConnectedToRoad(state, knVertex, playerId);
      if (!adjToMyRoad) throw new Error('Knight must be adjacent to your road network.');

      // Displace it (returned to supply)
      state.knights = state.knights.filter(k => k.id !== knToMove.id);
      state.log.push(`Intrigue: Returned ${state.players.find(p => p.id === knToMove.playerId)!.name}'s knight to supply.`);
      calculateLongestRoad(state);
      break;

    case 'saboteur':
      // All players with more VP than active player discard half their cards
      for (const p of state.players) {
        if (p.victoryPoints > player.victoryPoints) {
          const totalHand = Object.values(p.resources).reduce((a, b) => a + b, 0) +
                            Object.values(p.commodities).reduce((a, b) => a + b, 0);
          const discard = Math.floor(totalHand / 2);

          // Standard random discard
          let cardsPool: (Resource | Commodity)[] = [];
          for (const [r, qty] of Object.entries(p.resources) as [Resource, number][]) {
            for (let i = 0; i < qty; i++) cardsPool.push(r);
          }
          for (const [c, qty] of Object.entries(p.commodities) as [Commodity, number][]) {
            for (let i = 0; i < qty; i++) cardsPool.push(c);
          }

          cardsPool = shuffle(cardsPool);
          for (let i = 0; i < discard; i++) {
            const card = cardsPool[i];
            if (['lumber', 'brick', 'wool', 'grain', 'ore'].includes(card)) p.resources[card as Resource] -= 1;
            else p.commodities[card as Commodity] -= 1;
          }
          state.log.push(`Saboteur: ${p.name} discarded ${discard} random cards.`);
        }
      }
      break;

    case 'spy':
      // Take 1 progress card from opponent
      const spyTarget = state.players.find(p => p.id === params.targetPlayerId)!;
      if (spyTarget.progressCards.length === 0) throw new Error('Target player has no progress cards.');

      // Steal 1
      const spyIndex = Math.floor(Math.random() * spyTarget.progressCards.length);
      const stolenProgCard = spyTarget.progressCards.splice(spyIndex, 1)[0];
      player.progressCards.push(stolenProgCard);
      state.log.push(`Spy: Stole progress card from ${spyTarget.name}`);
      break;

    case 'warlord':
      // Activate all of your knights for free
      for (const k of state.knights) {
        if (k.playerId === playerId) {
          k.isActive = true;
        }
      }
      state.log.push('Warlord: Activated all owned knights.');
      break;

    default:
      break;
  }
}

// -------------------------------------------------------------
// DOWNGRADE CITY ACTION RESOLUTION (BARBARIANS WIN)
// -------------------------------------------------------------
function handleDowngradeCity(state: GameState, action: { vertexId: string }, playerId: string): GameState {
  if (state.phase !== 'barbarian_attack') {
    throw new Error('Not in barbarian attack resolution phase.');
  }
  if (!state.pendingDowngrades.includes(playerId)) {
    throw new Error('You do not need to downgrade a city.');
  }

  const vertex = state.vertices.find(v => v.id === action.vertexId);
  if (!vertex || !vertex.building || vertex.building.playerId !== playerId || vertex.building.type !== 'city') {
    throw new Error('Invalid city selected.');
  }

  // Downgrade city to settlement
  vertex.building.type = 'settlement';
  if (vertex.building.hasWall) {
    vertex.building.hasWall = false;
    const player = state.players.find(p => p.id === playerId)!;
    player.cityWallCount = Math.max(0, player.cityWallCount - 1);
  }

  state.log.push(`${state.players.find(p => p.id === playerId)!.name} downgraded city to settlement`);

  // Remove player from pending downgrades
  state.pendingDowngrades = state.pendingDowngrades.filter(id => id !== playerId);

  if (state.pendingDowngrades.length === 0) {
    // Resume game play
    state.phase = 'main';

    // Proceed to resource distribution of the roll
    const rolledSum = state.dice.lastRollTotal;
    if (rolledSum !== 7) {
      distributeResources(state, rolledSum);
      state.turnPhase = 'building';
    } else {
      resolveSevenRoll(state);
    }
  }

  recalculateVictoryPoints(state);
  return state;
}

// -------------------------------------------------------------
// TRADING SYSTEM (DOMESTIC & MARITIME)
// -------------------------------------------------------------
// Active trades list
interface ActiveTrade {
  id: string;
  senderId: string;
  targetId: string | 'bank';
  offer: Record<Resource | Commodity, number>;
  request: Record<Resource | Commodity, number>;
}
let activeTrades: ActiveTrade[] = [];

function handleTradeOffer(state: GameState, action: { offer: any; request: any; targetPlayerId: string }, playerId: string): GameState {
  if (state.turnPhase !== 'building') {
    throw new Error('Can only trade during building phase.');
  }

  const sender = state.players.find(p => p.id === playerId)!;

  // Validate sender has resources
  for (const [r, qty] of Object.entries(action.offer) as [Resource | Commodity, number][]) {
    if (['lumber', 'brick', 'wool', 'grain', 'ore'].includes(r)) {
      if (sender.resources[r as Resource] < qty) throw new Error(`Insufficient ${r} to trade.`);
    } else {
      if (sender.commodities[r as Commodity] < qty) throw new Error(`Insufficient ${r} to trade.`);
    }
  }

  if (action.targetPlayerId === 'bank') {
    // Maritime bank trade
    // 4:1 base rate, or harbor rate, or Merchant rate
    const senderVps = state.vertices.filter(v => v.building && v.building.playerId === playerId);

    // Harbor checks
    let genericHarbor = false;
    const specialHarbors = new Set<HarborType>();

    for (const v of senderVps) {
      if (v.harbor) {
        if (v.harbor === '3:1') genericHarbor = true;
        else specialHarbors.add(v.harbor);
      }
    }

    // Determine trade cost
    // Offer must be a single resource/commodity type traded at rate
    const offeredList = Object.entries(action.offer || {}).filter((entry) => (entry[1] as number) > 0) as [Resource | Commodity, number][];
    const requestedList = Object.entries(action.request || {}).filter((entry) => (entry[1] as number) > 0) as [Resource | Commodity, number][];

    if (offeredList.length !== 1 || requestedList.length !== 1) {
      throw new Error('Bank trade must offer exactly 1 card type and request exactly 1 card type.');
    }

    const [offeredItem, offeredQty] = offeredList[0];
    const [requestedItem, requestedQty] = requestedList[0];

    // Determine discount
    let requiredRate = 4;

    // Check Merchant control (2:1 for that resource)
    if (state.merchant.playerId === playerId && state.merchant.hexId) {
      const merchantHex = state.hexTiles.find(h => h.id === state.merchant.hexId)!;
      const res = getTerrainResource(merchantHex.terrain);
      if (res && res === offeredItem) {
        requiredRate = 2;
      }
    }

    // Check progress card merchant fleet (2:1 for anything chosen)
    if (state.activeProgressCardPlayed === 'merchant_fleet' && requiredRate > 2) {
      requiredRate = 2;
    }

    // Check special harbor
    if (requiredRate > 2) {
      const spec = `2:1_${offeredItem}` as HarborType;
      if (specialHarbors.has(spec)) {
        requiredRate = 2;
      }
    }

    // Check generic harbor
    if (requiredRate > 3 && genericHarbor) {
      requiredRate = 3;
    }

    const expectedCost = requiredRate * requestedQty;
    if (offeredQty < expectedCost) {
      throw new Error(`Bank trade requires ${expectedCost} ${offeredItem} for ${requestedQty} ${requestedItem}. You offered ${offeredQty}.`);
    }

    // Pay resources
    if (['lumber', 'brick', 'wool', 'grain', 'ore'].includes(offeredItem)) sender.resources[offeredItem as Resource] -= expectedCost;
    else sender.commodities[offeredItem as Commodity] -= expectedCost;

    // Receive resources
    if (['lumber', 'brick', 'wool', 'grain', 'ore'].includes(requestedItem)) sender.resources[requestedItem as Resource] += requestedQty;
    else sender.commodities[requestedItem as Commodity] += requestedQty;

    state.log.push(`${sender.name} traded with Bank: ${expectedCost} ${offeredItem} for ${requestedQty} ${requestedItem}`);
  } else {
    // Domestic player-to-player trade offer
    const tradeId = generateId();
    activeTrades.push({
      id: tradeId,
      senderId: playerId,
      targetId: action.targetPlayerId,
      offer: action.offer,
      request: action.request
    });
    const targetPlayer = state.players.find(p => p.id === action.targetPlayerId);
    state.log.push(`${sender.name} proposed trade to ${targetPlayer ? targetPlayer.name : 'all players'}`);
  }

  return state;
}

function handleTradeResponse(state: GameState, action: { tradeId: string; accept: boolean }, playerId: string): GameState {
  const tradeIdx = activeTrades.findIndex(t => t.id === action.tradeId);
  if (tradeIdx === -1) throw new Error('Trade offer not found or expired.');

  const trade = activeTrades[tradeIdx];

  // Target check
  if (trade.targetId !== 'all' && trade.targetId !== playerId) {
    throw new Error('Not authorized to respond to this trade.');
  }

  if (action.accept) {
    const sender = state.players.find(p => p.id === trade.senderId)!;
    const responder = state.players.find(p => p.id === playerId)!;

    // Check responder has requested cards
    for (const [r, qty] of Object.entries(trade.request) as [Resource | Commodity, number][]) {
      if (['lumber', 'brick', 'wool', 'grain', 'ore'].includes(r)) {
        if (responder.resources[r as Resource] < qty) throw new Error('Insufficient resources to complete trade.');
      } else {
        if (responder.commodities[r as Commodity] < qty) throw new Error('Insufficient commodities to complete trade.');
      }
    }

    // Check sender still has offered cards
    for (const [r, qty] of Object.entries(trade.offer) as [Resource | Commodity, number][]) {
      if (['lumber', 'brick', 'wool', 'grain', 'ore'].includes(r)) {
        if (sender.resources[r as Resource] < qty) throw new Error('Offer sender no longer has the resources.');
      } else {
        if (sender.commodities[r as Commodity] < qty) throw new Error('Offer sender no longer has the commodities.');
      }
    }

    // Execute trade
    for (const [r, qty] of Object.entries(trade.offer) as [Resource | Commodity, number][]) {
      if (['lumber', 'brick', 'wool', 'grain', 'ore'].includes(r)) {
        sender.resources[r as Resource] -= qty;
        responder.resources[r as Resource] += qty;
      } else {
        sender.commodities[r as Commodity] -= qty;
        responder.commodities[r as Commodity] += qty;
      }
    }

    for (const [r, qty] of Object.entries(trade.request) as [Resource | Commodity, number][]) {
      if (['lumber', 'brick', 'wool', 'grain', 'ore'].includes(r)) {
        responder.resources[r as Resource] -= qty;
        sender.resources[r as Resource] += qty;
      } else {
        responder.commodities[r as Commodity] -= qty;
        sender.commodities[r as Commodity] += qty;
      }
    }

    state.log.push(`🤝 Trade accepted! ${sender.name} traded with ${responder.name}.`);
    // Clear trade
    activeTrades = activeTrades.filter(t => t.id !== trade.id);
  } else {
    // Trade rejected
    const responderName = state.players.find(p => p.id === playerId)!.name;
    state.log.push(`❌ Trade rejected by ${responderName}.`);
    activeTrades = activeTrades.filter(t => t.id !== trade.id);
  }

  return state;
}

// -------------------------------------------------------------
// END TURN
// -------------------------------------------------------------
function handleEndTurn(state: GameState, playerId: string): GameState {
  if (state.turnPhase === 'pre_roll') {
    throw new Error('Must roll the dice first.');
  }

  const player = state.players.find(p => p.id === playerId)!;

  // Hand limit for progress cards check (max 4 allowed at turn end)
  if (player.progressCards.length > 4) {
    throw new Error(`Must discard progress cards down to 4 before ending your turn. You currently hold ${player.progressCards.length}.`);
  }

  // Reset knight activity logs for next round
  for (const k of state.knights) {
    if (k.playerId === playerId) {
      k.recruitedThisTurn = false;
      k.activatedThisTurn = false;
    }
  }

  // Reset active progress card effects
  if (state.activeProgressCardPlayed !== 'crane' && state.activeProgressCardPlayed !== 'engineer') {
    state.activeProgressCardPlayed = null;
  }

  recalculateVictoryPoints(state);

  // Record progress snapshot for the player ending their turn
  if (!state.progressHistory) {
    state.progressHistory = [];
  }
  const playerSnapshots = state.progressHistory.filter(s => s.playerId === playerId);
  const turnNumber = playerSnapshots.length + 1;
  state.progressHistory.push({
    turnNumber,
    playerId: player.id,
    playerName: player.name,
    victoryPoints: player.victoryPoints,
    scienceLevel: player.cityImprovements.blue,
    tradeLevel: player.cityImprovements.green,
    politicsLevel: player.cityImprovements.yellow
  });

  // Advance player index
  state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.turnOrder.length;
  state.turnPhase = 'pre_roll';

  const nextPlayer = state.players.find(p => p.id === state.turnOrder[state.currentPlayerIndex])!;
  state.log.push(`It is now ${nextPlayer.name}'s turn.`);

  recalculateVictoryPoints(state);
  return state;
}
