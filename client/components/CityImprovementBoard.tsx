import React from 'react';
import { ChevronUp, Feather, Crown, FlaskConical } from 'lucide-react';
import { useGameStore, getActivePlayerId } from '../store/gameStore';
import { useSocket } from '../hooks/useSocket';
import { ImprovementColor, ImprovementLevel, Knight } from '@shared/types';

export const CityImprovementBoard: React.FC = () => {
  const { gameState, playerId } = useGameStore();
  const { sendAction } = useSocket();

  if (!gameState || !playerId) return null;

  const player = gameState.players.find(p => p.id === playerId);
  if (!player) return null;

  const activePlayerId = getActivePlayerId(gameState);
  const isMyTurn = playerId === activePlayerId;
  const isBuildingPhase = gameState.turnPhase === 'building';
  const isSetupPhase = gameState.phase === 'setup';

  // Section 8 specs:
  // - Ordered: Trade (green), Politics (yellow), Science (blue) in the code mapping
  const tracks = [
    {
      color: 'green' as ImprovementColor,
      name: 'TRADE',
      commodity: 'cloth' as const,
      icon: <Feather className="w-3.5 h-3.5" style={{ color: 'var(--green-track-lit)' }} />,
      litColor: 'var(--green-track-lit)',
      trackBg: 'var(--green-track)',
      description: 'Increases Trade Progress card distribution.',
      abilities: [
        'Level 1: Market (Red die: 1)',
        'Level 2: Trading House (Red die: 1-3)',
        'Level 3: Merchant Guild (Red die: 1-4) - Ability: You may trade any 2 identical commodities for any 1 other commodity or resource.',
        'Level 4: Expansion (Red die: 1-5) - Metropolis control.',
        'Level 5: Assembly (Red die: any) - Permanent Metropolis control.'
      ]
    },
    {
      color: 'yellow' as ImprovementColor,
      name: 'POLITICS',
      commodity: 'coin' as const,
      icon: <Crown className="w-3.5 h-3.5" style={{ color: 'var(--purple-track-lit)' }} />,
      litColor: 'var(--purple-track-lit)',
      trackBg: 'var(--purple-track)',
      description: 'Increases Politics Progress card distribution.',
      abilities: [
        'Level 1: Town Hall (Red die: 1)',
        'Level 2: Mansion (Red die: 1-3)',
        'Level 3: Fortress (Red die: 1-4) - Ability: You may promote strong knights to mighty knights.',
        'Level 4: Expansion (Red die: 1-5) - Metropolis control.',
        'Level 5: Assembly (Red die: any) - Permanent Metropolis control.'
      ]
    },
    {
      color: 'blue' as ImprovementColor,
      name: 'SCIENCE',
      commodity: 'paper' as const,
      icon: <FlaskConical className="w-3.5 h-3.5" style={{ color: 'var(--blue-track-lit)' }} />,
      litColor: 'var(--blue-track-lit)',
      trackBg: 'var(--blue-track)',
      description: 'Increases Science Progress card distribution.',
      abilities: [
        'Level 1: Library (Red die: 1)',
        'Level 2: Lab (Red die: 1-3)',
        'Level 3: Academy (Red die: 1-4) - Ability: If you receive no production cards (excluding 7 rolls), take 1 resource card of your choice.',
        'Level 4: Expansion (Red die: 1-5) - Metropolis control.',
        'Level 5: Assembly (Red die: any) - Permanent Metropolis control.'
      ]
    }
  ];

  const handleBuyImprovement = (color: ImprovementColor) => {
    sendAction({ type: 'BUY_IMPROVEMENT', color });
  };

  const renderKnightIcon = (k: Knight) => {
    // Basic (gray), Strong (copper), Mighty (gold)
    const iconColor = k.level === 3 ? 'text-[var(--gold-bright)]' : k.level === 2 ? 'text-[var(--border-copper)]' : 'text-slate-400';
    
    // Active knights get a slight scale and gold border glow
    const style: React.CSSProperties = k.isActive 
      ? { boxShadow: '0 0 6px var(--gold-dim)', borderColor: 'var(--border-gold)', transform: 'scale(1.05)' }
      : { opacity: 0.5, borderColor: 'var(--border-dark)' };

    return (
      <div
        key={k.id}
        style={style}
        title={`Knight Level ${k.level} (${k.isActive ? 'Active' : 'Inactive'})`}
        className="flex items-center justify-center bg-[var(--bg-inset)] border w-7 h-7 rounded transition-all duration-200"
      >
        <span className={`text-sm ${iconColor} select-none`}>🪖</span>
      </div>
    );
  };

  return (
    <div className="glass-panel p-3 rounded-lg shadow-lg border border-[var(--border-dark)] flex flex-col gap-2.5 relative">
      
      <div className="flex flex-col gap-1.5 border-b border-[var(--border-copper)] pb-2 mb-0.5">
        <h3 className="font-cinzel font-bold text-[0.78rem] tracking-wider text-[var(--gold-primary)] uppercase text-center md:text-left leading-none">
          CITY IMPROVEMENTS
        </h3>
        
        {/* Compact chips for commodities */}
        <div className="flex items-center gap-1.5 w-full">
          <div className="bg-[var(--bg-inset)] border border-[var(--border-dark)] rounded px-1.5 py-0.5 min-w-0 flex-1 text-center font-cinzel text-[0.7rem] text-[var(--text-primary)] whitespace-nowrap">
            📜 Paper: <span className="font-bold text-[var(--gold-bright)]">{player.commodities.paper}</span>
          </div>
          <div className="bg-[var(--bg-inset)] border border-[var(--border-dark)] rounded px-1.5 py-0.5 min-w-0 flex-1 text-center font-cinzel text-[0.7rem] text-[var(--text-primary)] whitespace-nowrap">
            🧶 Cloth: <span className="font-bold text-[var(--gold-bright)]">{player.commodities.cloth}</span>
          </div>
          <div className="bg-[var(--bg-inset)] border border-[var(--border-dark)] rounded px-1.5 py-0.5 min-w-0 flex-1 text-center font-cinzel text-[0.7rem] text-[var(--text-primary)] whitespace-nowrap">
            🪙 Coin: <span className="font-bold text-[var(--gold-bright)]">{player.commodities.coin}</span>
          </div>
        </div>
      </div>

      {/* Tracks Rows */}
      <div className="flex flex-col">
        {tracks.map((track, idx) => {
          const currentLvl = player.cityImprovements[track.color];
          const isMax = currentLvl === 5;
          const nextLvl = (currentLvl + 1) as ImprovementLevel;

          const hasCrane = gameState.activeProgressCardPlayed === 'crane' && isMyTurn;
          const upgradeCost = isMax ? 0 : Math.max(0, nextLvl - (hasCrane ? 1 : 0));
          const hasEnough = player.commodities[track.commodity] >= upgradeCost;

          // Must own at least 1 city to buy improvements
          const standardCityCount = gameState.vertices.filter(
            v => v.building && v.building.playerId === playerId && (v.building.type === 'city' || v.building.type === 'metropolis')
          ).length;

          const canBuy =
            isMyTurn &&
            isBuildingPhase &&
            !isSetupPhase &&
            !isMax &&
            hasEnough &&
            standardCityCount > 0;

          // Metropolis owner
          const metroOwner = gameState.metropolisOwners[track.color];
          const ownsMetro = metroOwner === playerId;

          return (
            <div key={track.color} className={track.color === 'green' ? 'trade-track' : track.color === 'yellow' ? 'politics-track' : 'science-track'}>
              {/* Separate track rows with a 1px border-dark line */}
              {idx > 0 && <div className="border-t border-[var(--border-dark)] my-2" />}

              <div className="flex items-center justify-between gap-2 py-1.5">
                {/* Track icon + name label: Cinzel 600, 0.75rem */}
                <div className="flex items-center gap-1.5 w-24">
                  {track.icon}
                  <span
                    className="font-cinzel font-semibold text-[0.7rem] tracking-wider"
                    style={{ color: track.litColor }}
                  >
                    {track.name}
                  </span>
                </div>

                {/* Squares slots */}
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((lvl) => {
                    const isFilled = currentLvl >= lvl;
                    const isMetroLvl = lvl === 4 || lvl === 5;
                    const isMetroHeldHere = isMetroLvl && ownsMetro;

                    return (
                      <div key={lvl} className="flex flex-col items-center gap-0.5">
                        {/* Level square using class-based states */}
                        <div
                          data-level={lvl}
                          title={lvl >= 3 ? track.abilities[lvl - 1] : undefined}
                          className={`level-square ${isFilled ? 'reached' : ''} transition-all duration-300 select-none text-[9.5px] font-bold`}
                        >
                          {isMetroHeldHere && lvl === currentLvl ? (
                            <span className="font-cinzel text-[8px] text-[var(--gold-bright)]">M</span>
                          ) : isMetroLvl && isFilled ? (
                            <span className="font-cinzel text-[8px] text-white/80">M</span>
                          ) : (
                            <span>{lvl}</span>
                          )}
                        </div>
                        {/* Level X label under square */}
                        <span className="level-label text-[0.55rem] text-[var(--text-secondary)] font-cinzel">
                          L{lvl}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Buy Up arrow */}
                {!isMax && (
                  <button
                    onClick={() => handleBuyImprovement(track.color)}
                    disabled={!canBuy}
                    title={standardCityCount === 0 ? "Requires a City" : `Upgrade to Level ${nextLvl} (Cost: ${upgradeCost} ${track.commodity})`}
                    className="p-1 rounded bg-[var(--bg-panel)] hover:bg-[var(--bg-raised)] border border-[var(--border-copper)] hover:border-[var(--border-gold)] text-[var(--gold-primary)] hover:text-[var(--gold-bright)] disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                )}
                {isMax && <div className="w-6" />}
              </div>
            </div>
          );
        })}
      </div>

      {/* Knight Management Dashboard: Section 9 */}
      {(() => {
        const playerKnights = gameState.knights.filter(k => k.playerId === playerId);
        const basicKnights = playerKnights.filter(k => k.level === 1);
        const strongKnights = playerKnights.filter(k => k.level === 2);
        const mightyKnights = playerKnights.filter(k => k.level === 3);

        return (
          <div className="border-t border-[var(--border-copper)] pt-3 flex flex-col gap-2.5 mt-1">
            <h4 className="font-cinzel font-bold text-xs text-center text-[var(--gold-primary)] uppercase tracking-wide">
              Knight Management
            </h4>
            
            <div className="flex justify-around items-start gap-1">
              {/* Basic Group */}
              <div className="flex flex-col items-center gap-1.5 flex-1 border-r border-[var(--border-dark)] pr-1">
                <div className="flex gap-1 justify-center min-h-[28px] items-center flex-wrap">
                  {basicKnights.map(k => renderKnightIcon(k))}
                  {basicKnights.length === 0 && (
                    <span className="text-sm text-slate-500 opacity-25 select-none">🪖</span>
                  )}
                </div>
                <span className="font-cinzel text-[0.6rem] text-[var(--text-secondary)] uppercase font-semibold">
                  Basic
                </span>
              </div>

              {/* Strong Group */}
              <div className="flex flex-col items-center gap-1.5 flex-1 border-r border-[var(--border-dark)] px-1">
                <div className="flex gap-1 justify-center min-h-[28px] items-center flex-wrap">
                  {strongKnights.map(k => renderKnightIcon(k))}
                  {strongKnights.length === 0 && (
                    <span className="text-sm text-slate-500 opacity-25 select-none">🪖</span>
                  )}
                </div>
                <span className="font-cinzel text-[0.6rem] text-[var(--text-secondary)] uppercase font-semibold">
                  Strong
                </span>
              </div>

              {/* Mighty Group */}
              <div className="flex flex-col items-center gap-1.5 flex-1 pl-1">
                <div className="flex gap-1 justify-center min-h-[28px] items-center flex-wrap">
                  {mightyKnights.map(k => renderKnightIcon(k))}
                  {mightyKnights.length === 0 && (
                    <span className="text-sm text-slate-500 opacity-25 select-none">🪖</span>
                  )}
                </div>
                <span className="font-cinzel text-[0.6rem] text-[var(--text-secondary)] uppercase font-semibold">
                  Mighty
                </span>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
};
