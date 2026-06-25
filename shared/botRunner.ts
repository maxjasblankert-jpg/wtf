import {
  GameState,
  PlayerState,
  Resource,
  Commodity,
  ImprovementColor,
  ImprovementLevel,
  Vertex,
  Edge,
  Knight
} from './types';

// Helper to check if player has resources
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

// Distance rule validation
function isVertexDistanceRuleMet(state: GameState, vertex: Vertex): boolean {
  for (const adjVId of vertex.adjacentVertexIds) {
    const adjVNode = state.vertices.find(v => v.id === adjVId)!;
    if (adjVNode.building) return false;
  }
  return true;
}

// Road connectivity helpers
function isConnectedToRoad(state: GameState, vertex: Vertex, playerId: string): boolean {
  for (const eId of vertex.adjacentEdgeIds) {
    const edge = state.edges.find(e => e.id === eId)!;
    if (edge.road && edge.road.playerId === playerId) {
      return true;
    }
  }
  return false;
}

function isConnectedToPlayerRoads(state: GameState, edge: Edge, playerId: string): boolean {
  for (const vId of edge.adjacentVertexIds) {
    const vertex = state.vertices.find(v => v.id === vId)!;
    if (vertex.building && vertex.building.playerId !== playerId) continue;
    for (const eId of vertex.adjacentEdgeIds) {
      const eNode = state.edges.find(e => e.id === eId)!;
      if (eNode.road && eNode.road.playerId === playerId) {
        return true;
      }
    }
  }
  return false;
}

// MAIN BOT ACTION SELECTOR
export function getBotNextAction(state: GameState, botPlayerId: string): any {
  const player = state.players.find(p => p.id === botPlayerId);
  if (!player) return null;

  // 1. SETUP PHASE ACTIONS
  if (state.phase === 'setup') {
    const playerBuildings = state.vertices.filter(v => v.building && v.building.playerId === botPlayerId);
    const playerRoads = state.edges.filter(e => e.road && e.road.playerId === botPlayerId);

    const round = state.currentPlayerIndex < state.turnOrder.length ? 1 : 2;

    if (round === 1) {
      if (playerBuildings.length === 0) {
        // Build settlement: find first valid vertex satisfying distance rule
        const validVertex = state.vertices.find(v => !v.building && isVertexDistanceRuleMet(state, v) && v.adjacentHexIds.some(hId => {
          const hex = state.hexTiles.find(h => h.id === hId)!;
          return hex.terrain !== 'sea';
        }));
        if (validVertex) {
          return { type: 'BUILD', buildType: 'settlement', targetId: validVertex.id };
        }
      } else if (playerRoads.length === 0) {
        // Build road adjacent to that settlement
        const settlementVertex = playerBuildings[0];
        const vacantEdge = state.edges.find(e => e.adjacentVertexIds.includes(settlementVertex.id) && !e.road);
        if (vacantEdge) {
          return { type: 'BUILD', buildType: 'road', targetId: vacantEdge.id };
        }
      }
    } else {
      // Round 2
      if (playerBuildings.length === 1) {
        // Build starting city
        const validVertex = state.vertices.find(v => !v.building && isVertexDistanceRuleMet(state, v) && v.adjacentHexIds.some(hId => {
          const hex = state.hexTiles.find(h => h.id === hId)!;
          return hex.terrain !== 'sea';
        }));
        if (validVertex) {
          return { type: 'BUILD', buildType: 'city', targetId: validVertex.id };
        }
      } else if (playerRoads.length === 1) {
        // Build road adjacent to that city
        const cityVertex = playerBuildings.find(v => v.building!.type === 'city')!;
        const vacantEdge = state.edges.find(e => e.adjacentVertexIds.includes(cityVertex.id) && !e.road);
        if (vacantEdge) {
          return { type: 'BUILD', buildType: 'road', targetId: vacantEdge.id };
        }
      }
    }
    // Stalled? End turn
    return { type: 'END_TURN' };
  }

  // 2. BARBARIAN DOWNGRADE PHASE ACTIONS
  if (state.phase === 'barbarian_attack') {
    if (state.pendingDowngrades.includes(botPlayerId)) {
      // Find a city to downgrade
      const cityVertex = state.vertices.find(v => v.building && v.building.playerId === botPlayerId && v.building.type === 'city');
      if (cityVertex) {
        return { type: 'DOWNGRADE_CITY', vertexId: cityVertex.id };
      }
    }
    return null; // wait
  }

  // 3. MAIN GAME PHASE ACTIONS
  if (state.phase === 'main') {
    // A. Pre-Roll Phase: bot just rolls the dice
    if (state.turnPhase === 'pre_roll') {
      return { type: 'ROLL_DICE' };
    }

    // B. Post-Roll Discards & Robber Moves
    if (state.turnPhase === 'post_roll') {
      // Discard cards if over limit
      const handLimit = 7 + 2 * player.cityWallCount;
      const totalCards = Object.values(player.resources).reduce((a, b) => a + b, 0) +
                         Object.values(player.commodities).reduce((a, b) => a + b, 0);

      if (totalCards > handLimit) {
        // Build random discard set of size Math.floor(totalCards/2)
        const discardQty = Math.floor(totalCards / 2);
        const resources: Record<Resource, number> = { lumber: 0, brick: 0, wool: 0, grain: 0, ore: 0 };
        const commodities: Record<Commodity, number> = { paper: 0, cloth: 0, coin: 0 };

        let count = 0;
        const resPool: Resource[] = [];
        const commPool: Commodity[] = [];

        for (const [r, q] of Object.entries(player.resources) as [Resource, number][]) {
          for (let i = 0; i < q; i++) resPool.push(r);
        }
        for (const [c, q] of Object.entries(player.commodities) as [Commodity, number][]) {
          for (let i = 0; i < q; i++) commPool.push(c);
        }

        // Shuffle pools and pick
        const combined = [...resPool, ...commPool];
        for (let i = 0; i < discardQty; i++) {
          const card = combined[i];
          if (['lumber', 'brick', 'wool', 'grain', 'ore'].includes(card)) {
            resources[card as Resource] += 1;
          } else {
            commodities[card as Commodity] += 1;
          }
        }

        return { type: 'DISCARD_CARDS', resources, commodities };
      }

      // Robber moves
      if (state.pendingRobberMove) {
        // Move robber to a random land hex (not desert, not current robber)
        const validHexes = state.hexTiles.filter(h => h.terrain !== 'sea' && h.terrain !== 'desert' && !h.hasRobber);
        if (validHexes.length > 0) {
          const targetHex = validHexes[Math.floor(Math.random() * validHexes.length)];
          return { type: 'MOVE_ROBBER', hexId: targetHex.id };
        }
      }

      // Steal card
      if (state.pendingStealFrom.length > 0) {
        const stealTarget = state.pendingStealFrom[Math.floor(Math.random() * state.pendingStealFrom.length)];
        return { type: 'STEAL_CARD', targetPlayerId: stealTarget };
      }

      return null; // wait
    }

    // C. Building Phase
    if (state.turnPhase === 'building') {
      // 1. Buy City Improvements
      const improvementColors: ImprovementColor[] = ['green', 'blue', 'yellow'];
      for (const col of improvementColors) {
        const currentLvl = player.cityImprovements[col];
        if (currentLvl < 5) {
          const nextLvl = (currentLvl + 1) as ImprovementLevel;
          const comm: Commodity = col === 'green' ? 'cloth' : col === 'blue' ? 'paper' : 'coin';
          const hasCityForLvl4 = nextLvl < 4 || state.vertices.some(v => v.building && v.building.playerId === botPlayerId && v.building.type === 'city');

          if (player.commodities[comm] >= nextLvl && hasCityForLvl4) {
            return { type: 'BUY_IMPROVEMENT', color: col };
          }
        }
      }

      // 2. Build City (Upgrade Settlement)
      const playerSettlements = state.vertices.filter(v => v.building && v.building.playerId === botPlayerId && v.building.type === 'settlement');
      const builtCitiesCount = state.vertices.filter(v => v.building && v.building.playerId === botPlayerId && v.building.type === 'city').length;

      if (hasRes(player, { res: { grain: 2, ore: 3 } }) && builtCitiesCount < 4 && playerSettlements.length > 0) {
        return { type: 'BUILD', buildType: 'city', targetId: playerSettlements[0].id };
      }

      // 3. Build Settlement
      const builtSettlementsCount = playerSettlements.length;
      if (hasRes(player, { res: { lumber: 1, brick: 1, wool: 1, grain: 1 } }) && builtSettlementsCount < 5) {
        // Find a vacant vertex connected to our roads that meets distance rules
        const validVertex = state.vertices.find(v => !v.building && isVertexDistanceRuleMet(state, v) && isConnectedToRoad(state, v, botPlayerId));
        if (validVertex) {
          return { type: 'BUILD', buildType: 'settlement', targetId: validVertex.id };
        }
      }

      // 4. Build Road
      if (hasRes(player, { res: { lumber: 1, brick: 1 } })) {
        // Find a vacant edge connected to our roads
        const validEdge = state.edges.find(e => !e.road && isConnectedToPlayerRoads(state, e, botPlayerId));
        if (validEdge) {
          return { type: 'BUILD', buildType: 'road', targetId: validEdge.id };
        }
      }

      // 5. Recruit Knight
      const recruitedKnightsCount = state.knights.filter(k => k.playerId === botPlayerId).length;
      const basicKnightsCount = state.knights.filter(k => k.playerId === botPlayerId && k.level === 1).length;

      if (hasRes(player, { res: { wool: 1, grain: 1, ore: 1 } }) && basicKnightsCount < 2 && recruitedKnightsCount < 6) {
        // Find vacant vertex adjacent to road meeting distance rules
        const validVertex = state.vertices.find(v => !v.building && isVertexDistanceRuleMet(state, v) && isConnectedToRoad(state, v, botPlayerId) && !state.knights.some(k => k.vertexId === v.id));
        if (validVertex) {
          return { type: 'RECRUIT_KNIGHT', vertexId: validVertex.id };
        }
      }

      // 6. Activate Knight
      const inactiveKnight = state.knights.find(k => k.playerId === botPlayerId && !k.isActive);
      if (hasRes(player, { res: { grain: 1 } }) && inactiveKnight) {
        return { type: 'ACTIVATE_KNIGHT', knightId: inactiveKnight.id };
      }

      // 7. Upgrade Knight
      const knightToUpgrade = state.knights.find(k => {
        if (k.playerId !== botPlayerId) return false;
        if (k.level === 1) {
          // Lvl 1->2
          return state.knights.filter(kn => kn.playerId === botPlayerId && kn.level === 2).length < 2;
        }
        if (k.level === 2) {
          // Lvl 2->3 (Fortress check)
          return player.cityImprovements.yellow >= 3 && state.knights.filter(kn => kn.playerId === botPlayerId && kn.level === 3).length < 2;
        }
        return false;
      });

      if (hasRes(player, { res: { wool: 1, grain: 1 } }) && knightToUpgrade) {
        return { type: 'UPGRADE_KNIGHT', knightId: knightToUpgrade.id };
      }

      // If nothing left to buy/do, end turn
      return { type: 'END_TURN' };
    }
  }

  return null;
}
