import React from 'react';
import { ShieldAlert, Anchor, Ship } from 'lucide-react';
import { useGameStore } from '../store/gameStore';

export const BarbarianTrack: React.FC = () => {
  const { gameState } = useGameStore();

  if (!gameState) return null;

  const { position, hasAttackedOnce } = gameState.barbarians;

  // Track spaces: 7 down to 1
  const trackSpaces = [7, 6, 5, 4, 3, 2, 1];

  return (
    <div className="glass-panel p-3.5 rounded-lg border border-[var(--border-copper)] flex flex-col gap-3 w-full shadow-lg relative">
      <div className="flex items-center justify-between border-b border-[var(--border-copper)] pb-1.5 mb-1">
        <h3 className="panel-heading !mb-0 !pb-0 !border-0 text-xs">
          BARBARIAN TRACKER
        </h3>
        <span className="text-[11px] text-[var(--text-secondary)] font-cinzel">
          DEF: <span className="text-[var(--gold-bright)] font-bold">{gameState.knights.filter(k => k.isActive).reduce((sum, k) => sum + k.level, 0)}</span>
          &nbsp;|&nbsp;
          STR: <span className="text-red-400 font-bold">{gameState.vertices.filter(v => v.building && (v.building.type === 'city' || v.building.type === 'metropolis')).length}</span>
        </span>
      </div>

      {/* The Track Row */}
      <div className="flex items-center justify-between gap-1 w-full bg-[var(--bg-inset)] p-1.5 rounded border border-[var(--border-dark)]">
        {trackSpaces.map((space) => {
          const isShipHere = position === space;
          const isFinalSpace = space === 1;
          const isOneAway = position === 2;

          let squareClass = "w-[36px] h-[36px] rounded border flex items-center justify-center transition-all duration-300 ";
          
          if (isShipHere) {
            squareClass += "barbarian-track-active";
          } else {
            squareClass += "barbarian-track-inactive";
          }

          if (isFinalSpace && isOneAway && !isShipHere) {
            squareClass += " animate-dangerPulse";
          }

          return (
            <div
              key={space}
              className={squareClass}
              title={isFinalSpace ? "Barbarian Attack" : `Space ${space}`}
            >
              {isShipHere ? (
                <Ship className="w-5 h-5 text-white" />
              ) : isFinalSpace ? (
                <Anchor className="w-5 h-5 text-inherit" />
              ) : (
                <span className="font-cinzel font-bold text-sm text-inherit">
                  {space}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-[9px] font-serif text-[var(--text-secondary)] italic px-0.5">
        <span>Robber: {hasAttackedOnce ? "Active" : "Locked"}</span>
        <span>Attack on ⚓</span>
      </div>
    </div>
  );
};


