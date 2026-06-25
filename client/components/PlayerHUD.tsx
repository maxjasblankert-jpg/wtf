import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import { useSocket } from '../hooks/useSocket';
import { Resource, Commodity } from '@shared/types';

export const PlayerHUD: React.FC = () => {
  const { gameState, playerId, selection, clearSelection, showTradeModal, setShowTradeModal } = useGameStore();
  const { sendAction } = useSocket();

  const [tradeOffer, setTradeOffer] = useState<Record<string, number>>({ lumber: 0, brick: 0, wool: 0, grain: 0, ore: 0, paper: 0, cloth: 0, coin: 0 });
  const [tradeRequest, setTradeRequest] = useState<Record<string, number>>({ lumber: 0, brick: 0, wool: 0, grain: 0, ore: 0, paper: 0, cloth: 0, coin: 0 });
  const [tradeTarget, setTradeTarget] = useState<string>('bank');

  if (!gameState || !playerId) return null;

  const player = gameState.players.find(p => p.id === playerId);
  if (!player) return null;

  const resourceKeys: Resource[] = ['lumber', 'brick', 'wool', 'grain', 'ore'];
  const commodityKeys: Commodity[] = ['paper', 'cloth', 'coin'];

  const resourceDefs = [
    { key: 'lumber', label: 'lumber', icon: '🪵' },
    { key: 'brick', label: 'brick', icon: '🧱' },
    { key: 'wool', label: 'wool', icon: '🐑' },
    { key: 'grain', label: 'grain', icon: '🌾' },
    { key: 'ore', label: 'ore', icon: '🪨' }
  ];

  const commodityDefs = [
    { key: 'paper', label: 'paper', icon: '📜' },
    { key: 'cloth', label: 'cloth', icon: '👕' },
    { key: 'coin', label: 'coin', icon: '🪙' }
  ];

  // Trade Modal Ratio Calculations
  const getBankTradeRate = (offeredItem: string) => {
    const isResource = resourceKeys.includes(offeredItem as Resource);
    
    const hasMerchantFleet = gameState.activeProgressCardPlayed === 'merchant_fleet';
    if (hasMerchantFleet) return 2;
    
    const senderVps = gameState.vertices.filter(v => v.building && v.building.playerId === playerId);
    let hasGenericHarbor = false;
    const specialHarbors = new Set<string>();
    for (const v of senderVps) {
      if (v.harbor) {
        if (v.harbor === '3:1') hasGenericHarbor = true;
        else specialHarbors.add(v.harbor);
      }
    }
    
    if (isResource) {
      if (gameState.merchant.playerId === playerId && gameState.merchant.hexId) {
        const merchantHex = gameState.hexTiles.find(h => h.id === gameState.merchant.hexId)!;
        const resMap: Record<string, string> = { forest: 'lumber', pasture: 'wool', fields: 'grain', hills: 'brick', mountains: 'ore' };
        if (resMap[merchantHex.terrain] === offeredItem) return 2;
      }
      if (specialHarbors.has(`2:1_${offeredItem}`)) return 2;
      if (hasGenericHarbor) return 3;
      return 4;
    } else {
      const hasTradeLevel3 = player.cityImprovements.green >= 3;
      if (hasTradeLevel3) return 2;
      if (hasGenericHarbor) return 3;
      return 4;
    }
  };

  const getBankTradeError = () => {
    if (tradeTarget !== 'bank') return null;
    
    const offeredList = Object.entries(tradeOffer).filter(([, q]) => q > 0);
    const requestedList = Object.entries(tradeRequest).filter(([, q]) => q > 0);
    
    if (offeredList.length !== 1 || requestedList.length !== 1) {
      return 'Bank trade must offer exactly 1 card type and request exactly 1 card type.';
    }
    
    const [offeredItem, offeredQty] = offeredList[0];
    const [requestedItem, requestedQty] = requestedList[0];
    
    const rate = getBankTradeRate(offeredItem);
    const requiredCost = rate * requestedQty;
    
    if (offeredQty !== requiredCost) {
      return `Bank trade requires exactly ${rate}:1 exchange rate. Select exactly ${requiredCost} ${offeredItem} to get ${requestedQty} ${requestedItem}.`;
    }
    
    return null;
  };

  const getPlayerTradeError = () => {
    if (tradeTarget === 'bank') return null;
    for (const [k, q] of Object.entries(tradeOffer)) {
      const owned = resourceKeys.includes(k as Resource)
        ? player.resources[k as Resource]
        : player.commodities[k as Commodity];
      if (q > owned) return `You only have ${owned} ${k} to trade, but you offered ${q}.`;
    }
    const offeredTotal = Object.values(tradeOffer).reduce((a, b) => a + b, 0);
    const requestedTotal = Object.values(tradeRequest).reduce((a, b) => a + b, 0);
    if (offeredTotal === 0 && requestedTotal === 0) return 'Cannot send empty trade offer.';
    return null;
  };

  const getTradeError = () => {
    return tradeTarget === 'bank' ? getBankTradeError() : getPlayerTradeError();
  };

  const handleSendTrade = () => {
    sendAction({
      type: 'TRADE_OFFER',
      offer: { ...tradeOffer },
      request: { ...tradeRequest },
      targetPlayerId: tradeTarget
    });
    setTradeOffer({ lumber: 0, brick: 0, wool: 0, grain: 0, ore: 0, paper: 0, cloth: 0, coin: 0 });
    setTradeRequest({ lumber: 0, brick: 0, wool: 0, grain: 0, ore: 0, paper: 0, cloth: 0, coin: 0 });
    setShowTradeModal(false);
  };

  const handleDismissModal = () => {
    setTradeOffer({ lumber: 0, brick: 0, wool: 0, grain: 0, ore: 0, paper: 0, cloth: 0, coin: 0 });
    setTradeRequest({ lumber: 0, brick: 0, wool: 0, grain: 0, ore: 0, paper: 0, cloth: 0, coin: 0 });
    setShowTradeModal(false);
  };

  return (
    <>

      {/* TRADE MODAL OVERLAY: Section 13 */}
      {showTradeModal && (
        <div
          style={{
            position: 'fixed',
            inset: '0',
            background: 'rgba(0,0,0,0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100
          }}
          className="p-4"
        >
          <div
            style={{
              background: 'var(--bg-panel)',
              border: '1px solid var(--border-copper)',
              borderRadius: '10px',
              padding: '24px',
              minWidth: '420px',
              maxWidth: '560px',
              boxShadow: '0 8px 40px rgba(0,0,0,0.8)'
            }}
            className="flex flex-col gap-4 relative"
          >
            {/* Heading */}
            <h3 className="font-cinzel font-bold text-base text-[var(--gold-primary)] tracking-wider text-center uppercase border-b border-[var(--border-copper)] pb-2.5">
              TRADE WITH PLAYERS
            </h3>

            {/* Stepper Columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* YOU OFFER Column */}
              <div className="flex flex-col gap-1.5">
                <span className="font-cinzel font-bold text-[10px] text-[var(--text-secondary)] uppercase tracking-wider pl-0.5">
                  YOU OFFER
                </span>
                <div className="flex flex-col gap-1 max-h-[220px] overflow-y-auto bg-[var(--bg-inset)] border border-[var(--border-dark)] rounded-lg p-2">
                  {[...resourceKeys, ...commodityKeys].map((k) => {
                    const isResource = resourceKeys.includes(k as Resource);
                    const owned = isResource ? player.resources[k as Resource] : player.commodities[k as Commodity];
                    const selected = tradeOffer[k] || 0;
                    const emoji = isResource 
                      ? (resourceDefs.find(r => r.key === k)?.icon || '')
                      : (commodityDefs.find(c => c.key === k)?.icon || '');
                    
                    const isHighlighted = selected > 0;
                    const rate = getBankTradeRate(k);

                    return (
                      <div
                        key={k}
                        className={`flex items-center justify-between p-1.5 rounded border transition-all ${
                          isHighlighted ? 'border-[var(--border-gold)] bg-[var(--bg-raised)]/35 shadow-inner' : 'border-[var(--border-dark)] bg-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="text-base select-none leading-none">{emoji}</span>
                          <div className="flex flex-col select-none">
                            <span className="capitalize font-cinzel text-[9px] font-semibold text-[var(--text-primary)] leading-none">
                              {k}
                            </span>
                            <span className="text-[7px] text-[var(--text-secondary)] font-serif leading-none mt-0.5">
                              Own: {owned} {tradeTarget === 'bank' && `(${rate}:1)`}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setTradeOffer(prev => ({ ...prev, [k]: Math.max(0, prev[k] - 1) }))}
                            className="bg-[var(--bg-panel)] border border-[var(--border-dark)] text-[var(--text-primary)] hover:border-[var(--border-copper)] w-4.5 h-4.5 rounded text-[10px] font-bold flex items-center justify-center leading-none"
                          >
                            -
                          </button>
                          <span className="w-5 text-center font-cinzel text-[10px] font-bold text-[var(--gold-bright)] select-none">
                            {selected}
                          </span>
                          <button
                            type="button"
                            onClick={() => setTradeOffer(prev => ({ ...prev, [k]: Math.min(owned, prev[k] + 1) }))}
                            className="bg-[var(--bg-panel)] border border-[var(--border-dark)] text-[var(--text-primary)] hover:border-[var(--border-copper)] w-4.5 h-4.5 rounded text-[10px] font-bold flex items-center justify-center leading-none"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* YOU REQUEST Column */}
              <div className="flex flex-col gap-1.5">
                <span className="font-cinzel font-bold text-[10px] text-[var(--text-secondary)] uppercase tracking-wider pl-0.5">
                  YOU REQUEST
                </span>
                <div className="flex flex-col gap-1 max-h-[220px] overflow-y-auto bg-[var(--bg-inset)] border border-[var(--border-dark)] rounded-lg p-2">
                  {[...resourceKeys, ...commodityKeys].map((k) => {
                    const isResource = resourceKeys.includes(k as Resource);
                    const selected = tradeRequest[k] || 0;
                    const emoji = isResource 
                      ? (resourceDefs.find(r => r.key === k)?.icon || '')
                      : (commodityDefs.find(c => c.key === k)?.icon || '');
                    
                    const isHighlighted = selected > 0;

                    return (
                      <div
                        key={k}
                        className={`flex items-center justify-between p-1.5 rounded border transition-all ${
                          isHighlighted ? 'border-[var(--border-gold)] bg-[var(--bg-raised)]/35 shadow-inner' : 'border-[var(--border-dark)] bg-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="text-base select-none leading-none">{emoji}</span>
                          <span className="capitalize font-cinzel text-[9px] font-semibold text-[var(--text-primary)] leading-none select-none">
                            {k}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setTradeRequest(prev => ({ ...prev, [k]: Math.max(0, prev[k] - 1) }))}
                            className="bg-[var(--bg-panel)] border border-[var(--border-dark)] text-[var(--text-primary)] hover:border-[var(--border-copper)] w-4.5 h-4.5 rounded text-[10px] font-bold flex items-center justify-center leading-none"
                          >
                            -
                          </button>
                          <span className="w-5 text-center font-cinzel text-[10px] font-bold text-[var(--gold-bright)] select-none">
                            {selected}
                          </span>
                          <button
                            type="button"
                            onClick={() => setTradeRequest(prev => ({ ...prev, [k]: prev[k] + 1 }))}
                            className="bg-[var(--bg-panel)] border border-[var(--border-dark)] text-[var(--text-primary)] hover:border-[var(--border-copper)] w-4.5 h-4.5 rounded text-[10px] font-bold flex items-center justify-center leading-none"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* Target Player Selector */}
            <div className="flex flex-col gap-1.5 mt-1 select-none">
              <span className="font-cinzel font-bold text-[9px] text-[var(--text-secondary)] uppercase tracking-wider pl-0.5">
                Select target player:
              </span>
              <div className="flex gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setTradeTarget('bank')}
                  className={`px-3 py-1.5 rounded-full font-cinzel text-[9px] font-bold border tracking-wider transition-all duration-150 uppercase ${
                    tradeTarget === 'bank'
                      ? 'bg-[var(--border-copper)] border-[var(--border-gold)] text-[var(--bg-deep)] shadow-sm'
                      : 'bg-[var(--bg-inset)] border-[var(--border-dark)] text-[var(--text-secondary)] hover:border-[var(--border-copper)]'
                  }`}
                >
                  Bank
                </button>
                {gameState.players.filter(p => p.id !== playerId).map(p => {
                  const isSelected = tradeTarget === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setTradeTarget(p.id)}
                      className={`px-3 py-1.5 rounded-full font-cinzel text-[9px] font-bold border tracking-wider transition-all duration-150 uppercase ${
                        isSelected
                          ? 'bg-[var(--border-copper)] border-[var(--border-gold)] text-[var(--bg-deep)] shadow-sm'
                          : 'bg-[var(--bg-inset)] border-[var(--border-dark)] text-[var(--text-secondary)] hover:border-[var(--border-copper)]'
                      }`}
                    >
                      {p.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Error notifications */}
            {getTradeError() && (
              <div className="text-[9.5px] text-red-400 font-serif bg-[var(--danger)]/10 border border-[var(--danger)]/20 p-2 rounded leading-tight">
                ⚠️ {getTradeError()}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-col items-center gap-3 mt-2 select-none">
              <button
                type="button"
                onClick={handleSendTrade}
                disabled={getTradeError() !== null}
                style={{
                  background: 'linear-gradient(180deg, #5a3010, #2e1808)',
                  border: '1px solid var(--border-gold)',
                  color: 'var(--gold-bright)',
                  fontFamily: "'Cinzel', serif",
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  padding: '10px 24px',
                  borderRadius: '6px',
                  width: '100%'
                }}
                className="hover:scale-[1.01] hover:shadow-[0_0_8px_var(--gold-dim)] disabled:opacity-45 disabled:scale-100 disabled:shadow-none disabled:cursor-not-allowed transition-all duration-150 uppercase tracking-widest text-center"
              >
                PROPOSE TRADE
              </button>

              <button
                type="button"
                onClick={handleDismissModal}
                className="font-cinzel text-[10px] font-semibold text-[var(--text-secondary)] hover:text-white uppercase tracking-wider leading-none select-none transition-all duration-150"
              >
                [ Cancel ]
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
};
