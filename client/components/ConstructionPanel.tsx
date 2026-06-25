import React from 'react';
import { useGameStore, ClientActionType, getActivePlayerId } from '../store/gameStore';
import { useSocket } from '../hooks/useSocket';

export const ConstructionPanel: React.FC = () => {
  const { gameState, playerId, selection, setSelectionAction, clearSelection, setShowTradeModal } = useGameStore();
  const { sendAction } = useSocket();

  if (!gameState || !playerId) return null;

  const player = gameState.players.find(p => p.id === playerId);
  if (!player) return null;

  const activePlayerId = getActivePlayerId(gameState);
  const isMyTurn = playerId === activePlayerId;
  const isSetup = gameState.phase === 'setup';
  const isBuilding = gameState.turnPhase === 'building';
  const isPreRoll = gameState.turnPhase === 'pre_roll';

  const COSTS = {
    build_road: { lumber: 1, brick: 1 },
    build_settlement: { lumber: 1, brick: 1, wool: 1, grain: 1 },
    build_city: { grain: 2, ore: 3 },
    build_city_wall: { brick: 2 },
    recruit_knight: { wool: 1, ore: 1 },
    activate_knight: { grain: 1 },
    upgrade_knight: { wool: 1, grain: 1 },
    move_knight: {}
  };

  const getRequiredCost = (actionKey: string) => {
    if (actionKey === 'build_road' && gameState.activeProgressCardPlayed === 'road_building' && isMyTurn) {
      return {};
    }
    if (actionKey === 'build_city' && gameState.activeProgressCardPlayed === 'medicine' && isMyTurn) {
      return { grain: 1, ore: 2 };
    }
    if (actionKey === 'build_city_wall' && gameState.activeProgressCardPlayed === 'engineer' && isMyTurn) {
      return {};
    }
    return COSTS[actionKey as keyof typeof COSTS] || {};
  };

  const hasResForAction = (actionKey: string) => {
    const cost = getRequiredCost(actionKey);
    return (
      (!cost.lumber || player.resources.lumber >= cost.lumber) &&
      (!cost.brick || player.resources.brick >= cost.brick) &&
      (!cost.wool || player.resources.wool >= cost.wool) &&
      (!cost.grain || player.resources.grain >= cost.grain) &&
      (!cost.ore || player.resources.ore >= cost.ore)
    );
  };

  const setAction = (type: ClientActionType) => {
    if (selection.actionType === type) {
      clearSelection();
    } else {
      setSelectionAction(type, null);
    }
  };

  // Check harbors owned by player
  const ownedHarbors = new Set<string>();
  gameState.vertices.forEach(v => {
    if (v.building && v.building.playerId === playerId && v.harbor) {
      ownedHarbors.add(v.harbor);
    }
  });

  const has31Port = ownedHarbors.has('3:1');

  // Construction Buttons matching Section 11 specifications
  const buildButtons: {
    key: ClientActionType;
    label: string;
    structureIcon: string;
    requires?: string;
  }[] = [
    {
      key: 'build_road',
      label: 'BUILD ROAD',
      structureIcon: '🛣️'
    },
    {
      key: 'build_settlement',
      label: 'BUILD SETTLEMENT',
      structureIcon: '🏠'
    },
    {
      key: 'build_city',
      label: 'BUILD CITY',
      structureIcon: '🏰'
    },
    {
      key: 'build_city_wall',
      label: 'BUILD CITY WALL',
      structureIcon: '🧱',
      requires: 'requires a city'
    },
    {
      key: 'recruit_knight',
      label: 'RECRUIT KNIGHT',
      structureIcon: '🪖'
    },
    {
      key: 'activate_knight',
      label: 'ACTIVATE KNIGHT',
      structureIcon: '⚡',
      requires: 'requires a knight'
    },
    {
      key: 'upgrade_knight',
      label: 'PROMOTE KNIGHT',
      structureIcon: '🔼',
      requires: 'requires a knight'
    },
    {
      key: 'move_knight',
      label: 'MOVE KNIGHT',
      structureIcon: '🏃',
      requires: 'requires active knight'
    }
  ];

  const renderCostLine = (actionKey: string) => {
    const cost = getRequiredCost(actionKey);
    const costPairs: string[] = [];
    const emojisMap = {
      lumber: '🪵',
      brick: '🧱',
      wool: '🐑',
      grain: '🌾',
      ore: '🪨'
    };

    for (const [res, qty] of Object.entries(cost)) {
      const emoji = emojisMap[res as keyof typeof emojisMap] || '';
      costPairs.push(`${qty}${emoji}`);
    }

    if (costPairs.length === 0) return 'Cost: Free';
    return `Cost: ${costPairs.join(' ')}`;
  };

  const renderCostIconsInline = (actionKey: string) => {
    const cost = getRequiredCost(actionKey);
    const emojisMap = {
      lumber: '🪵',
      brick: '🧱',
      wool: '🐑',
      grain: '🌾',
      ore: '🪨'
    };
    const elements: React.ReactNode[] = [];
    for (const [res, qty] of Object.entries(cost)) {
      const emoji = emojisMap[res as keyof typeof emojisMap] || '';
      elements.push(
        <span key={res} className="inline-flex items-center gap-0.5">
          <span>{qty}</span>
          <span style={{ fontSize: '15px' }} className="select-none leading-none">{emoji}</span>
        </span>
      );
    }
    if (elements.length === 0) return <span className="cost-text">Free</span>;
    return (
      <div className="flex items-center gap-1 mt-1 leading-none cost-text">
        <span>Cost:</span>
        <div className="flex items-center gap-1.5">
          {elements}
        </div>
      </div>
    );
  };

  return (
    <div className="glass-panel p-3 rounded-lg shadow-lg border border-[var(--border-dark)] flex flex-col gap-2.5 relative">
      <h3 className="panel-heading text-center mb-2">
        Construction
      </h3>

      {/* TRADE WITH PLAYERS Button: Section 11 Top (only during building/action phase) - FIX 11 */}
      {isBuilding && (
        <button
          onClick={() => setShowTradeModal(true)}
          style={{ border: '1.5px solid var(--border-gold)' }}
          className="w-full p-2 rounded bg-gradient-to-b from-[var(--bg-raised)] to-[var(--bg-panel)] hover:from-[#3a2212] text-[var(--gold-bright)] font-cinzel font-bold text-xs tracking-widest uppercase shadow-md select-none hover:shadow-[0_0_8px_var(--gold-dim)] transition-all duration-150 mb-1 flex items-center justify-center gap-2"
        >
          <span>⇄</span>
          <span>TRADE WITH PLAYERS</span>
        </button>
      )}

      {/* Building Actions Grid */}
      <div className="grid grid-cols-1 gap-1.5">
        {buildButtons.map((btn) => {
          const isSelected = selection.actionType === btn.key;
          const hasEnough = hasResForAction(btn.key);
          const canAct = isMyTurn && (isSetup || (!isPreRoll && isBuilding)) && (hasEnough || isSetup);

          let btnClass = "rounded flex flex-col items-start gap-0.5 text-left transition-all duration-150 select-none ";
          if (isSelected) {
            btnClass += "border border-[var(--border-gold)] bg-gradient-to-b from-[#3a2212] to-[var(--bg-panel)] shadow-[0_0_8px_var(--gold-dim)]";
          } else {
            btnClass += "border border-[var(--border-dark)] bg-gradient-to-b from-[var(--bg-raised)] to-[var(--bg-panel)] hover:border-[var(--border-copper)] hover:from-[#3a2212] disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:from-[var(--bg-raised)] disabled:hover:border-[var(--border-dark)]";
          }

          return (
            <button
              key={btn.key}
              onClick={() => setAction(btn.key)}
              disabled={!canAct}
              style={{ padding: '6px 8px' }}
              className={btnClass}
            >
              <div className="flex justify-between items-center w-full">
                {/* Build label: Cinzel 600, 0.68rem */}
                <span className="build-action-label" style={{ fontSize: '0.68rem' }}>
                  {btn.label}
                </span>
                <span className="text-xs leading-none select-none">{btn.structureIcon}</span>
              </div>
              
              {/* Requires note: IM Fell English, 0.62rem, italic, color dim */}
              {btn.requires && (
                <span className="font-serif italic text-[0.62rem] text-[var(--text-dim)] -mt-0.5 leading-none">
                  ({btn.requires})
                </span>
              )}

              {/* Cost icons inline - FIX 8.3 */}
              {renderCostIconsInline(btn.key)}
            </button>
          );
        })}
      </div>

      {/* Havens / Ports checklists: Section 12 - FIX 8.4 */}
      <div className="border-t border-[var(--border-dark)] pt-2.5 flex flex-col gap-2">
        
        {/* 2 for 1 Haven */}
        <div className="flex items-center justify-between gap-2 border-b border-[var(--border-dark)]/40 pb-2">
          <span className="font-cinzel font-bold text-[9px] text-[var(--gold-primary)] uppercase tracking-wider leading-none whitespace-nowrap">
            2 FOR 1
          </span>
          <div className="flex justify-end items-center gap-1 flex-1">
            {[
              { harbor: '2:1_wool', icon: '🐑' },
              { harbor: '2:1_lumber', icon: '🪵' },
              { harbor: '2:1_ore', icon: '🪨' },
              { harbor: '2:1_grain', icon: '🌾' },
              { harbor: '2:1_brick', icon: '🧱' }
            ].map((p, idx) => {
              const active = ownedHarbors.has(p.harbor);
              return (
                <div key={idx} className="flex flex-col items-center gap-0.5 select-none">
                  <div
                    style={{
                      width: '22px',
                      height: '22px',
                      borderRadius: '3.5px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: active ? '1px solid var(--border-gold)' : '1px solid var(--border-dark)',
                      background: 'var(--bg-inset)',
                      fontSize: '13px'
                    }}
                    className="select-none"
                    title={p.harbor.replace('2:1_', '').toUpperCase() + ' harbor'}
                  >
                    {p.icon}
                  </div>
                  <div className={`w-2.5 h-2.5 rounded flex items-center justify-center text-[7px] font-bold border ${active ? 'bg-[var(--success)] border-[var(--border-copper)] text-white' : 'bg-transparent border-[var(--border-dark)] text-transparent'}`}>
                    ✓
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3 for 1 Haven */}
        <div className="flex items-center justify-between gap-2 border-b border-[var(--border-dark)]/40 pb-2">
          <span className="font-cinzel font-bold text-[9px] text-[var(--gold-primary)] uppercase tracking-wider leading-none whitespace-nowrap">
            3 FOR 1
          </span>
          <div className="flex justify-end items-center gap-1 flex-1">
            {['🐑', '🪵', '🪨', '🧱', '🌾'].map((icon, idx) => (
              <div key={idx} className="flex flex-col items-center gap-0.5 select-none">
                <div
                  style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: '3.5px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: has31Port ? '1px solid var(--border-gold)' : '1px solid var(--border-dark)',
                    background: 'var(--bg-inset)',
                    fontSize: '13px'
                  }}
                  className="select-none"
                >
                  {icon}
                </div>
                <div className={`w-2.5 h-2.5 rounded flex items-center justify-center text-[7px] font-bold border ${has31Port ? 'bg-[var(--success)] border-[var(--border-copper)] text-white' : 'bg-transparent border-[var(--border-dark)] text-transparent'}`}>
                  ✓
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="font-serif italic text-[0.65rem] text-[var(--text-dim)] text-center leading-none mt-0.5">
          You must build a settlement on a haven first
        </p>

      </div>
    </div>
  );
};
