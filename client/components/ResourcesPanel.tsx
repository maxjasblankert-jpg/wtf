import React from 'react';
import { useGameStore } from '../store/gameStore';
import { Resource, Commodity } from '@shared/types';

export const ResourcesPanel: React.FC = () => {
  const { gameState, playerId } = useGameStore();

  if (!gameState || !playerId) return null;

  const player = gameState.players.find(p => p.id === playerId);
  if (!player) return null;

  const resourceDefs: { key: Resource; label: string; icon: string }[] = [
    { key: 'lumber', label: 'LUMBER', icon: '🪵' },
    { key: 'brick', label: 'BRICK', icon: '🧱' },
    { key: 'wool', label: 'WOOL', icon: '🐑' },
    { key: 'grain', label: 'GRAIN', icon: '🌾' },
    { key: 'ore', label: 'ORE', icon: '🪨' }
  ];

  const commodityDefs: { key: Commodity; label: string; icon: string }[] = [
    { key: 'paper', label: 'PAPER', icon: '📜' },
    { key: 'cloth', label: 'CLOTH', icon: '👕' },
    { key: 'coin', label: 'COIN', icon: '🪙' }
  ];

  return (
    <div className="glass-panel p-3.5 rounded-lg shadow-lg border border-[var(--border-dark)] flex flex-col gap-3 relative">
      <h3 className="panel-heading text-center">
        RESOURCES
      </h3>

      {/* Resources grid matching reference layout */}
      <div className="flex flex-col gap-2">
        {/* Row 1: Lumber, Brick, Wool */}
        <div className="grid grid-cols-3 gap-1.5">
          {resourceDefs.slice(0, 3).map((res) => {
            const qty = player.resources[res.key];
            return (
              <div
                key={res.key}
                style={{ padding: '6px 8px' }}
                className="resource-card flex flex-col items-center gap-0.5 transition-all duration-200"
              >
                <span className="leading-none select-none" style={{ fontSize: '20px' }}>{res.icon}</span>
                <span className="resource-label text-center leading-none" style={{ fontSize: '0.7rem' }}>{res.label}</span>
                <span className="resource-card-count leading-none mt-0.5" style={{ color: qty > 0 ? '#FFD700' : '#F5E6C8' }}>
                  {qty}
                </span>
              </div>
            );
          })}
        </div>

        {/* Row 2: Grain, Ore */}
        <div className="grid grid-cols-2 gap-1.5">
          {resourceDefs.slice(3).map((res) => {
            const qty = player.resources[res.key];
            return (
              <div
                key={res.key}
                style={{ padding: '6px 8px' }}
                className="resource-card flex flex-col items-center gap-0.5 transition-all duration-200"
              >
                <span className="leading-none select-none" style={{ fontSize: '20px' }}>{res.icon}</span>
                <span className="resource-label text-center leading-none" style={{ fontSize: '0.7rem' }}>{res.label}</span>
                <span className="resource-card-count leading-none mt-0.5" style={{ color: qty > 0 ? '#FFD700' : '#F5E6C8' }}>
                  {qty}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Commodities list with border-copper divider */}
      <div className="flex flex-col gap-1.5 border-t border-[var(--border-copper)] pt-2 mt-0.5">
        <h3 className="panel-heading text-center !border-0 !mb-1 !pb-0 text-[0.72rem]">
          COMMODITIES
        </h3>
        <div className="grid grid-cols-3 gap-1.5">
          {commodityDefs.map((comm) => {
            const qty = player.commodities[comm.key];
            return (
              <div
                key={comm.key}
                style={{ padding: '6px 8px' }}
                className="resource-card flex flex-col items-center gap-0.5 transition-all duration-200"
              >
                <span className="leading-none select-none" style={{ fontSize: '20px' }}>{comm.icon}</span>
                <span className="resource-label text-center leading-none" style={{ fontSize: '0.7rem' }}>{comm.label}</span>
                <span className="resource-card-count leading-none mt-0.5" style={{ color: qty > 0 ? '#FFD700' : '#F5E6C8' }}>
                  {qty}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
