import {
  GameState,
  PlayerState,
  Resource,
  Commodity,
  TerrainType,
  HarborType,
  Vertex,
  Edge,
  Knight,
  ImprovementColor,
  ImprovementLevel
} from '../shared/types';

// Helper to get terrain resource mapping
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

// -------------------------------------------------------------
// 1. OBSERVATION SPACE EXTRACTOR
// -------------------------------------------------------------
export function getObservation(state: GameState): number[] {
  const obs: number[] = [];

  // General state variables (8 items)
  const phaseMap = { setup: 0.0, main: 0.33, barbarian_attack: 0.66, end: 1.0 };
  obs.push(phaseMap[state.phase] || 0.0);
  obs.push(state.currentPlayerIndex / Math.max(state.turnOrder.length, 1));
  const turnPhaseMap = { pre_roll: 0.0, post_roll: 0.5, building: 1.0 };
  obs.push(turnPhaseMap[state.turnPhase] || 0.0);
  obs.push(state.dice.white / 6.0);
  obs.push(state.dice.red / 6.0);
  const eventMap = { barbarian: 0.25, science: 0.5, trade: 0.75, politics: 1.0 };
  obs.push(eventMap[state.dice.event] || 0.0);
  obs.push(state.barbarians.position / 7.0);
  obs.push(state.barbarianAttackCount / 10.0); // normalize by arbitrary max of 10

  // Players state (Up to 4 players, 21 variables each = 84 items)
  const numPlayers = state.players.length;
  for (let i = 0; i < 4; i++) {
    if (i < numPlayers) {
      const pId = state.turnOrder[i] || state.players[i].id;
      const p = state.players.find(pl => pl.id === pId)!;

      obs.push(p.resources.lumber / 15.0);
      obs.push(p.resources.brick / 15.0);
      obs.push(p.resources.wool / 15.0);
      obs.push(p.resources.grain / 15.0);
      obs.push(p.resources.ore / 15.0);
      obs.push(p.commodities.paper / 15.0);
      obs.push(p.commodities.cloth / 15.0);
      obs.push(p.commodities.coin / 15.0);

      obs.push(p.victoryPoints / 13.0); // max is usually 13
      obs.push(p.hiddenVP / 5.0);
      obs.push(p.cityWallCount / 3.0);
      obs.push(p.knightCount / 6.0);

      obs.push(state.metropolisOwners.green === p.id ? 1.0 : 0.0);
      obs.push(state.metropolisOwners.blue === p.id ? 1.0 : 0.0);
      obs.push(state.metropolisOwners.yellow === p.id ? 1.0 : 0.0);

      obs.push(p.cityImprovements.blue / 5.0);
      obs.push(p.cityImprovements.green / 5.0);
      obs.push(p.cityImprovements.yellow / 5.0);

      obs.push(p.hasLongestRoad ? 1.0 : 0.0);
      obs.push(p.isDefenderOfCatan ? 1.0 : 0.0);
      obs.push(p.progressCards.length / 4.0); // limit is 4/5
    } else {
      // Padding zeros for missing players
      for (let j = 0; j < 21; j++) obs.push(0.0);
    }
  }

  // Hexes (19 tiles, 3 variables each = 57 items)
  // Sort q, r to guarantee layout matches spatial layout
  const sortedHexes = [...state.hexTiles].sort((a, b) => a.q - b.q || a.r - b.r);
  const terrainMap = { forest: 1, pasture: 2, fields: 3, hills: 4, mountains: 5, desert: 6, sea: 7 };
  for (const h of sortedHexes) {
    obs.push((terrainMap[h.terrain] || 7) / 7.0);
    obs.push((h.number || 0) / 12.0);
    obs.push(h.hasRobber ? 1.0 : 0.0);
  }

  // Vertices (54 items, 6 variables each = 324 items)
  const sortedVertices = [...state.vertices].sort((a, b) => a.q - b.q || a.r - b.r || a.dir.localeCompare(b.dir));
  for (const v of sortedVertices) {
    // Building type
    const bTypeMap = { settlement: 1, city: 2, metropolis: 3 };
    obs.push(v.building ? (bTypeMap[v.building.type] || 0) / 3.0 : 0.0);
    obs.push(v.building ? (state.turnOrder.indexOf(v.building.playerId) + 1.0) / 4.0 : 0.0);
    obs.push(v.building?.hasWall ? 1.0 : 0.0);

    // Knight
    const knight = state.knights.find(k => k.vertexId === v.id);
    obs.push(knight ? knight.level / 3.0 : 0.0);
    obs.push(knight ? (state.turnOrder.indexOf(knight.playerId) + 1.0) / 4.0 : 0.0);
    obs.push(knight?.isActive ? 1.0 : 0.0);
  }

  // Edges (72 items, 1 variable each = 72 items)
  const sortedEdges = [...state.edges].sort((a, b) => a.id.localeCompare(b.id));
  for (const e of sortedEdges) {
    obs.push(e.road ? (state.turnOrder.indexOf(e.road.playerId) + 1.0) / 4.0 : 0.0);
  }

  return obs;
}

// -------------------------------------------------------------
// 2. ACTION MASKING HELPERS
// -------------------------------------------------------------
function hasRes(player: PlayerState, cost: { res?: Partial<Record<Resource, number>>; comm?: Partial<Record<Commodity, number>> }): boolean {
  if (cost.res) {
    for (const [r, qty] of Object.entries(cost.res) as [Resource, number][]) {
      if ((player.resources[r] || 0) < qty) return false;
    }
  }
  if (cost.comm) {
    for (const [c, qty] of Object.entries(cost.comm) as [Commodity, number][]) {
      if ((player.commodities[c] || 0) < qty) return false;
    }
  }
  return true;
}

function isVertexDistanceRuleMet(state: GameState, vertex: Vertex): boolean {
  for (const adjVId of vertex.adjacentVertexIds) {
    const adjVNode = state.vertices.find(v => v.id === adjVId)!;
    if (adjVNode.building) return false;
  }
  return true;
}

function isConnectedToRoad(state: GameState, vertex: Vertex, playerId: string): boolean {
  for (const eId of vertex.adjacentEdgeIds) {
    const edge = state.edges.find(e => e.id === eId)!;
    if (edge.road && edge.road.playerId === playerId) return true;
  }
  return false;
}

function isConnectedToPlayerRoads(state: GameState, edge: Edge, playerId: string): boolean {
  for (const vId of edge.adjacentVertexIds) {
    const vertex = state.vertices.find(v => v.id === vId)!;
    if (vertex.building && vertex.building.playerId !== playerId) continue;
    for (const eId of vertex.adjacentEdgeIds) {
      const eNode = state.edges.find(e => e.id === eId)!;
      if (eNode.road && eNode.road.playerId === playerId) return true;
    }
  }
  return false;
}

function getTradeRate(state: GameState, playerId: string, item: string): number {
  const p = state.players.find(pl => pl.id === playerId);
  if (!p) return 4;

  if (state.merchant.playerId === playerId && state.merchant.hexId) {
    const merchantHex = state.hexTiles.find(h => h.id === state.merchant.hexId);
    if (merchantHex) {
      const res = getTerrainResource(merchantHex.terrain);
      if (res && res === item) return 2;
    }
  }

  if (state.activeProgressCardPlayed === 'merchant_fleet') return 2;

  const playerVertices = state.vertices.filter(v => v.building && v.building.playerId === playerId);
  let genericHarbor = false;
  let specialHarbor = false;

  for (const v of playerVertices) {
    if (v.harbor) {
      if (v.harbor === '3:1') genericHarbor = true;
      else if (v.harbor === `2:1_${item}`) specialHarbor = true;
    }
  }

  if (specialHarbor) return 2;
  if (genericHarbor) return 3;
  return 4;
}

// -------------------------------------------------------------
// 3. ACTION MASKING GENERATOR
// -------------------------------------------------------------
export function getLegalActions(state: GameState, playerId: string): any[] {
  const actions: any[] = [];
  const player = state.players.find(p => p.id === playerId);
  if (!player) return actions;

  // Validate out-of-turn actions first
  if (state.phase === 'barbarian_attack') {
    if (state.pendingDowngrades.includes(playerId)) {
      const playerCities = state.vertices.filter(v => v.building && v.building.playerId === playerId && v.building.type === 'city');
      for (const city of playerCities) {
        actions.push({ type: 'DOWNGRADE_CITY', vertexId: city.id });
      }
    }
    return actions; // no other actions legal during downgrade resolution
  }

  if (state.turnPhase === 'post_roll') {
    // 1. Discard checks
    const handLimit = 7 + 2 * player.cityWallCount;
    const totalHand = Object.values(player.resources).reduce((a, b) => a + b, 0) +
                      Object.values(player.commodities).reduce((a, b) => a + b, 0);
    
    // Check if player is flagged to discard
    const isPendingDiscard = state.players.some(p => {
      const pLimit = 7 + 2 * p.cityWallCount;
      const pTotal = Object.values(p.resources).reduce((a, b) => a + b, 0) +
                     Object.values(p.commodities).reduce((a, b) => a + b, 0);
      return pTotal > pLimit;
    });

    if (totalHand > handLimit && isPendingDiscard) {
      // Discard choice generator (a simplified action list of resource selections)
      // Provide a couple of valid combinations to avoid exponential sizing:
      // Discard first N cards we can find
      const numToDiscard = Math.floor(totalHand / 2);
      const tempResources = { ...player.resources };
      const tempCommodities = { ...player.commodities };
      const discRes = { lumber: 0, brick: 0, wool: 0, grain: 0, ore: 0 };
      const discComm = { paper: 0, cloth: 0, coin: 0 };

      let count = 0;
      for (const r of ['lumber', 'brick', 'wool', 'grain', 'ore'] as Resource[]) {
        while (tempResources[r] > 0 && count < numToDiscard) {
          discRes[r]++;
          tempResources[r]--;
          count++;
        }
      }
      for (const c of ['paper', 'cloth', 'coin'] as Commodity[]) {
        while (tempCommodities[c] > 0 && count < numToDiscard) {
          discComm[c]++;
          tempCommodities[c]--;
          count++;
        }
      }

      actions.push({
        type: 'DISCARD_CARDS',
        resources: discRes,
        commodities: discComm
      });
      return actions;
    }

    if (isPendingDiscard) {
      return actions; // wait for others to discard
    }

    // 2. Active player robber movements
    const activePlayerId = state.turnOrder[state.currentPlayerIndex];
    if (playerId === activePlayerId) {
      if (state.pendingRobberMove) {
        const validHexes = state.hexTiles.filter(h => h.terrain !== 'sea' && h.terrain !== 'desert' && !h.hasRobber);
        for (const hex of validHexes) {
          actions.push({ type: 'MOVE_ROBBER', hexId: hex.id });
        }
        return actions;
      }

      if (state.pendingStealFrom.length > 0) {
        for (const otherId of state.pendingStealFrom) {
          actions.push({ type: 'STEAL_CARD', targetPlayerId: otherId });
        }
        return actions;
      }
    }
  }

  // Active player turn check for setup & main phases
  let currentActiveId = state.turnOrder[state.currentPlayerIndex];
  if (state.phase === 'setup') {
    const orderLen = state.turnOrder.length;
    let idx = state.currentPlayerIndex;
    if (idx >= orderLen) {
      idx = 2 * orderLen - 1 - idx;
    }
    currentActiveId = state.turnOrder[idx];
  }

  if (playerId !== currentActiveId) {
    return actions; // not this player's turn
  }

  // -------------------------------------------------------------
  // A. SETUP PHASE ACTIONS
  // -------------------------------------------------------------
  if (state.phase === 'setup') {
    const playerBuildings = state.vertices.filter(v => v.building && v.building.playerId === playerId);
    const playerRoads = state.edges.filter(e => e.road && e.road.playerId === playerId);
    const round = state.currentPlayerIndex < state.turnOrder.length ? 1 : 2;

    if (round === 1) {
      if (playerBuildings.length === 0) {
        // Build settlement
        const validVertices = state.vertices.filter(v => !v.building && isVertexDistanceRuleMet(state, v) && v.adjacentHexIds.some(hId => {
          const hex = state.hexTiles.find(h => h.id === hId)!;
          return hex.terrain !== 'sea';
        }));
        for (const vertex of validVertices) {
          actions.push({ type: 'BUILD', buildType: 'settlement', targetId: vertex.id });
        }
      } else if (playerRoads.length === 0) {
        // Build road adjacent to that settlement
        const settlementVertex = playerBuildings[0];
        const vacantEdges = state.edges.filter(e => e.adjacentVertexIds.includes(settlementVertex.id) && !e.road);
        for (const edge of vacantEdges) {
          actions.push({ type: 'BUILD', buildType: 'road', targetId: edge.id });
        }
      } else {
        actions.push({ type: 'END_TURN' });
      }
    } else {
      // Round 2
      if (playerBuildings.length === 1) {
        // Build city
        const validVertices = state.vertices.filter(v => !v.building && isVertexDistanceRuleMet(state, v) && v.adjacentHexIds.some(hId => {
          const hex = state.hexTiles.find(h => h.id === hId)!;
          return hex.terrain !== 'sea';
        }));
        for (const vertex of validVertices) {
          actions.push({ type: 'BUILD', buildType: 'city', targetId: vertex.id });
        }
      } else if (playerRoads.length === 1) {
        // Build road adjacent to round 2 city
        const cityVertex = playerBuildings.find(v => v.building!.type === 'city')!;
        const vacantEdges = state.edges.filter(e => e.adjacentVertexIds.includes(cityVertex.id) && !e.road);
        for (const edge of vacantEdges) {
          actions.push({ type: 'BUILD', buildType: 'road', targetId: edge.id });
        }
      } else {
        actions.push({ type: 'END_TURN' });
      }
    }
    return actions;
  }

  // -------------------------------------------------------------
  // B. MAIN GAME ACTIONS
  // -------------------------------------------------------------
  if (state.turnPhase === 'pre_roll') {
    if (state.alchemistPending) {
      // 36 dice choices
      for (let w = 1; w <= 6; w++) {
        for (let r = 1; r <= 6; r++) {
          actions.push({ type: 'SELECT_ALCHEMIST_DICE', white: w, red: r });
        }
      }
    } else {
      actions.push({ type: 'ROLL_DICE' });
      // Play alchemist progress card if player holds it
      const alchemistCard = player.progressCards.find(c => c.name === 'alchemist');
      if (alchemistCard) {
        actions.push({ type: 'PLAY_PROGRESS_CARD', cardId: alchemistCard.id });
      }
    }
    return actions;
  }

  if (state.turnPhase === 'building') {
    // 1. Buy City Improvements
    const colors: ImprovementColor[] = ['green', 'blue', 'yellow'];
    for (const color of colors) {
      const curLvl = player.cityImprovements[color];
      if (curLvl < 5) {
        const nextLvl = (curLvl + 1) as ImprovementLevel;
        const commType: Commodity = color === 'green' ? 'cloth' : color === 'blue' ? 'paper' : 'coin';
        const cost = hasRes(player, { comm: { [commType]: nextLvl } });
        const hasCity = state.vertices.some(v => v.building && v.building.playerId === playerId && v.building.type === 'city');
        const canBuild = nextLvl < 4 || hasCity;

        if (cost && canBuild) {
          actions.push({ type: 'BUY_IMPROVEMENT', color });
        }
      }
    }

    // 2. Upgrade Settlement to City
    const playerSettlements = state.vertices.filter(v => v.building && v.building.playerId === playerId && v.building.type === 'settlement');
    const builtCitiesCount = state.vertices.filter(v => v.building && v.building.playerId === playerId && v.building.type === 'city').length;
    if (hasRes(player, { res: { grain: 2, ore: 3 } }) && builtCitiesCount < 4) {
      for (const setVertex of playerSettlements) {
        actions.push({ type: 'BUILD', buildType: 'city', targetId: setVertex.id });
      }
    }

    // 3. Build Settlement
    const playerSettlementsCount = playerSettlements.length;
    if (hasRes(player, { res: { lumber: 1, brick: 1, wool: 1, grain: 1 } }) && playerSettlementsCount < 5) {
      const validVertices = state.vertices.filter(v => !v.building && isVertexDistanceRuleMet(state, v) && isConnectedToRoad(state, v, playerId));
      for (const vertex of validVertices) {
        actions.push({ type: 'BUILD', buildType: 'settlement', targetId: vertex.id });
      }
    }

    // 4. Build Road
    if (hasRes(player, { res: { lumber: 1, brick: 1 } })) {
      const validEdges = state.edges.filter(e => !e.road && isConnectedToPlayerRoads(state, e, playerId));
      for (const edge of validEdges) {
        actions.push({ type: 'BUILD', buildType: 'road', targetId: edge.id });
      }
    }

    // 5. Build City Wall
    const playerCities = state.vertices.filter(v => v.building && v.building.playerId === playerId && (v.building.type === 'city' || v.building.type === 'metropolis'));
    if (hasRes(player, { res: { brick: 2 } }) && player.cityWallCount < 3) {
      for (const city of playerCities) {
        if (!city.building?.hasWall) {
          actions.push({ type: 'BUILD', buildType: 'city_wall', targetId: city.id });
        }
      }
    }

    // 6. Recruit Knight
    const totalKnights = state.knights.filter(k => k.playerId === playerId).length;
    const basicKnights = state.knights.filter(k => k.playerId === playerId && k.level === 1).length;
    if (hasRes(player, { res: { wool: 1, ore: 1 } }) && basicKnights < 2 && totalKnights < 6) {
      const validVertices = state.vertices.filter(v => 
        !v.building && 
        isVertexDistanceRuleMet(state, v) && 
        isConnectedToRoad(state, v, playerId) && 
        !state.knights.some(k => k.vertexId === v.id) &&
        !v.adjacentVertexIds.some(adjVId => state.knights.some(k => k.vertexId === adjVId))
      );
      for (const vertex of validVertices) {
        actions.push({ type: 'RECRUIT_KNIGHT', vertexId: vertex.id });
      }
    }

    // 7. Activate Knight
    const inactiveKnights = state.knights.filter(k => k.playerId === playerId && !k.isActive);
    if (hasRes(player, { res: { grain: 1 } })) {
      for (const knight of inactiveKnights) {
        actions.push({ type: 'ACTIVATE_KNIGHT', knightId: knight.id });
      }
    }

    // 8. Upgrade Knight
    const upgradeableKnights = state.knights.filter(k => {
      if (k.playerId !== playerId) return false;
      if (k.level === 1) {
        // level 1 -> 2
        return state.knights.filter(kn => kn.playerId === playerId && kn.level === 2).length < 2;
      }
      if (k.level === 2) {
        // level 2 -> 3 (Requires politics level >= 3)
        return player.cityImprovements.yellow >= 3 && state.knights.filter(kn => kn.playerId === playerId && kn.level === 3).length < 2;
      }
      return false;
    });

    if (hasRes(player, { res: { wool: 1, ore: 1 } })) {
      for (const knight of upgradeableKnights) {
        actions.push({ type: 'UPGRADE_KNIGHT', knightId: knight.id });
      }
    }

    // 9. Play Progress Cards
    for (const card of player.progressCards) {
      if (card.name === 'alchemist') continue; // Played in pre-roll phase

      let params: any = undefined;
      let isPlayable = false;

      // Cards that need no params
      if (['crane', 'engineer', 'road_building', 'medicine', 'irrigation', 'mining', 'merchant_fleet', 'warlord', 'constitution', 'printer', 'saboteur', 'wedding'].includes(card.name)) {
        isPlayable = true;
      } 
      // Cards that require parameters (generate valid mock or derived parameters)
      else if (card.name === 'bishop') {
        const targetHex = state.hexTiles.find(h => h.terrain === 'desert' || h.terrain === 'sea');
        if (targetHex) {
          params = { hexId: targetHex.id };
          isPlayable = true;
        }
      } else if (card.name === 'merchant') {
        const targetHex = state.hexTiles.find(h => h.terrain !== 'desert' && h.terrain !== 'sea' && state.vertices.some(v => v.building?.playerId === playerId && v.adjacentHexIds.includes(h.id)));
        if (targetHex) {
          params = { hexId: targetHex.id };
          isPlayable = true;
        }
      } else if (card.name === 'resource_monopoly') {
        params = { resource: 'grain' };
        isPlayable = true;
      } else if (card.name === 'commodity_monopoly') {
        params = { commodity: 'paper' };
        isPlayable = true;
      } else if (card.name === 'master_merchant') {
        const targetOpp = state.players.find(p => p.id !== playerId && p.victoryPoints > player.victoryPoints);
        if (targetOpp) {
          params = { targetPlayerId: targetOpp.id, chosenCard: 'grain' };
          isPlayable = true;
        }
      } else if (card.name === 'spy') {
        const targetOpp = state.players.find(p => p.id !== playerId && p.progressCards.length > 0);
        if (targetOpp) {
          params = { targetPlayerId: targetOpp.id };
          isPlayable = true;
        }
      } else if (card.name === 'smith') {
        const myKnights = state.knights.filter(k => k.playerId === playerId && k.level < 3);
        if (myKnights.length > 0) {
          params = { knightIdA: myKnights[0].id, knightIdB: myKnights[1]?.id };
          isPlayable = true;
        }
      } else if (card.name === 'deserter') {
        const oppKnight = state.knights.find(k => k.playerId !== playerId);
        const myVacantVertex = state.vertices.find(v => !v.building && isConnectedToRoad(state, v, playerId) && !state.knights.some(k => k.vertexId === v.id));
        if (oppKnight && myVacantVertex) {
          params = { targetPlayerId: oppKnight.playerId, knightId: oppKnight.id, vertexId: myVacantVertex.id };
          isPlayable = true;
        }
      } else if (card.name === 'diplomat') {
        const enemyRoad = state.edges.find(e => e.road && e.road.playerId !== playerId);
        if (enemyRoad) {
          params = { edgeId: enemyRoad.id };
          isPlayable = true;
        }
      } else if (card.name === 'intrigue') {
        const adjacentOppKnight = state.knights.find(k => k.playerId !== playerId && isConnectedToRoad(state, state.vertices.find(v => v.id === k.vertexId)!, playerId));
        if (adjacentOppKnight) {
          params = { knightId: adjacentOppKnight.id };
          isPlayable = true;
        }
      } else if (card.name === 'commercial_harbor') {
        const items = ['lumber', 'brick', 'wool', 'grain', 'ore', 'paper', 'cloth', 'coin'];
        const offered = items.find(it => {
          const qty = it in player.resources ? player.resources[it as Resource] : player.commodities[it as Commodity] || 0;
          return qty >= 2;
        });
        if (offered) {
          params = { payCard: offered, takeCard1: 'grain', takeCard2: 'ore' };
          isPlayable = true;
        }
      }

      if (isPlayable) {
        actions.push({
          type: 'PLAY_PROGRESS_CARD',
          cardId: card.id,
          params
        });
      }
    }

    // 10. Maritime Trade with Bank
    const items = ['lumber', 'brick', 'wool', 'grain', 'ore', 'paper', 'cloth', 'coin'];
    for (const offerItem of items) {
      const rate = getTradeRate(state, playerId, offerItem);
      const currentQty = offerItem in player.resources 
        ? player.resources[offerItem as Resource] 
        : player.commodities[offerItem as Commodity] || 0;

      if (currentQty >= rate) {
        for (const reqItem of items) {
          if (reqItem !== offerItem) {
            const offerObj = { [offerItem]: rate };
            const reqObj = { [reqItem]: 1 };
            actions.push({
              type: 'TRADE_OFFER',
              targetPlayerId: 'bank',
              offer: offerObj,
              request: reqObj
            });
          }
        }
      }
    }

    // 11. End Turn is always a valid transition in action phase
    actions.push({ type: 'END_TURN' });
  }

  return actions;
}
