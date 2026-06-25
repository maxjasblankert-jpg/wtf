import { describe, it, expect } from 'vitest';
import {
  createInitialState,
  processAction,
  recalculateVictoryPoints,
  resolveBarbarianAttack,
  distributeProgressCards
} from './gameEngine';
import { GameState } from '../shared/types';

describe('Catan: Cities & Knights Game Engine Tests', () => {
  const players = [
    { id: 'p1', name: 'Alice', color: 'red' },
    { id: 'p2', name: 'Bob', color: 'blue' },
    { id: 'p3', name: 'Charlie', color: 'orange' }
  ];

  it('correctly initializes the game state in setup phase', () => {
    const state = createInitialState(players, false);

    expect(state.phase).toBe('setup');
    expect(state.players.length).toBe(3);
    expect(state.currentPlayerIndex).toBe(0); // Alice starts setup
    expect(state.barbarians.position).toBe(7);
    expect(state.hexTiles.length).toBe(37); // 19 land + 18 sea
  });

  it('runs setup placements snake forward and backward', () => {
    let state = createInitialState(players, false);

    // Alice builds starting settlement + road
    const targetVertex = state.vertices.find(v => !v.building)!;
    state = processAction(state, { type: 'BUILD', buildType: 'settlement', targetId: targetVertex.id }, 'p1');
    const targetEdge = state.edges.find(e => e.adjacentVertexIds.includes(targetVertex.id))!;
    state = processAction(state, { type: 'BUILD', buildType: 'road', targetId: targetEdge.id }, 'p1');

    // Turn should advance to Bob (setup index 1)
    expect(state.currentPlayerIndex).toBe(1);
    expect(state.turnOrder[state.currentPlayerIndex]).toBe('p2');
  });

  it('correctly resolves barbarian attack success (Catan Defended)', () => {
    const state = createInitialState(players, false);
    state.phase = 'main';
    state.turnPhase = 'pre_roll';

    // Set up cities (strength = 2)
    state.vertices[0].building = { playerId: 'p1', type: 'city', hasWall: false };
    state.vertices[1].building = { playerId: 'p2', type: 'city', hasWall: false };

    // Set up knights (defense = 3)
    state.knights.push({
      id: 'k1',
      playerId: 'p1',
      vertexId: state.vertices[2].id,
      level: 2, // Strong
      isActive: true,
      recruitedThisTurn: false,
      activatedThisTurn: false
    });
    state.knights.push({
      id: 'k2',
      playerId: 'p2',
      vertexId: state.vertices[3].id,
      level: 1, // Basic
      isActive: true,
      recruitedThisTurn: false,
      activatedThisTurn: false
    });

    // Roll event die = barbarian, moves position to 0 to trigger attack
    state.barbarians.position = 1;
    // We trigger roll
    // Let's directly test the resolver
    resolveBarbarianAttack(state);

    // Defense (3) >= Barbarian Strength (2)
    // p1 contributed 2 defense, p2 contributed 1. p1 should be Defender of Catan
    const p1 = state.players.find(p => p.id === 'p1')!;
    const p2 = state.players.find(p => p.id === 'p2')!;

    expect(p1.isDefenderOfCatan).toBe(true);
    expect(p2.isDefenderOfCatan).toBe(false);
    expect(state.barbarians.position).toBe(7); // reset
    expect(state.knights.every(k => !k.isActive)).toBe(true); // deactivated
  });

  it('correctly resolves barbarian attack failure (Catan Pillaged)', () => {
    const state = createInitialState(players, false);
    state.phase = 'main';
    state.turnPhase = 'pre_roll';

    // Set up cities (strength = 3)
    state.vertices[0].building = { playerId: 'p1', type: 'city', hasWall: true }; // has city wall
    state.vertices[1].building = { playerId: 'p2', type: 'city', hasWall: false };
    state.vertices[2].building = { playerId: 'p3', type: 'city', hasWall: false };
    state.players.find(p => p.id === 'p1')!.cityWallCount = 1;

    // Knight defense = 1 (active level 1 knight owned by p2)
    state.knights.push({
      id: 'k1',
      playerId: 'p2',
      vertexId: state.vertices[3].id,
      level: 1,
      isActive: true,
      recruitedThisTurn: false,
      activatedThisTurn: false
    });

    // Run barbarian attack
    resolveBarbarianAttack(state);

    // Defense (1) < Strength (3) -> Barbarians win.
    // Losers: P1 and P3 are tied for fewest active knights (0 levels) and have cities to lose.
    expect(state.phase).toBe('barbarian_attack');
    expect(state.pendingDowngrades).toContain('p1');
    expect(state.pendingDowngrades).toContain('p3');

    // Alice downgrades her city at vertex 0
    processAction(state, { type: 'DOWNGRADE_CITY', vertexId: state.vertices[0].id }, 'p1');

    // Alice's city should become a settlement, wall destroyed
    expect(state.vertices[0].building!.type).toBe('settlement');
    expect(state.vertices[0].building!.hasWall).toBe(false);
    expect(state.players.find(p => p.id === 'p1')!.cityWallCount).toBe(0);

    // Bob tries to end turn (should fail, still downgrades pending)
    expect(() => processAction(state, { type: 'END_TURN' }, 'p1')).toThrow();
  });

  it('correctly checks city improvement progress card eligibility', () => {
    const state = createInitialState(players, false);

    // Give Alice Green level 1, Bob Green level 2, Charlie Green level 0
    state.players[0].cityImprovements.green = 1;
    state.players[1].cityImprovements.green = 2;
    state.players[2].cityImprovements.green = 0;

    // Trigger distribution for Green castle (trade), red die value = 3
    distributeProgressCards(state, 'green', 3);

    // Alice (level 1) is eligible only on red die 1-2. Bob (level 2) is eligible on red die 1-3.
    // So Bob should get a card, Alice and Charlie should not.
    expect(state.players[0].progressCards.length).toBe(0);
    expect(state.players[1].progressCards.length).toBe(1);
    expect(state.players[2].progressCards.length).toBe(0);
  });

  it('enforces city wall building rules', () => {
    const state = createInitialState(players, false);
    state.phase = 'main';
    state.turnPhase = 'building';

    // Alice has resources
    const p1 = state.players.find(p => p.id === 'p1')!;
    p1.resources.brick = 10;

    // Try to build wall on vacant vertex -> should fail
    expect(() => processAction(state, { type: 'BUILD', buildType: 'city_wall', targetId: state.vertices[0].id }, 'p1')).toThrow();

    // Place settlement and city first
    state.vertices[0].building = { playerId: 'p1', type: 'city', hasWall: false };

    // Build city wall
    processAction(state, { type: 'BUILD', buildType: 'city_wall', targetId: state.vertices[0].id }, 'p1');

    expect(state.vertices[0].building!.hasWall).toBe(true);
    expect(p1.cityWallCount).toBe(1);
    expect(p1.resources.brick).toBe(8); // cost 2 brick
  });
});
