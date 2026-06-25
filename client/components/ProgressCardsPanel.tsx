import React, { useState } from 'react';
import { BookOpen, Scale, Landmark } from 'lucide-react';
import { useGameStore, getActivePlayerId } from '../store/gameStore';
import { useSocket } from '../hooks/useSocket';
import { ProgressCard } from '@shared/types';

export const ProgressCardsPanel: React.FC = () => {
  const { gameState, playerId } = useGameStore();
  const { sendAction } = useSocket();

  const [activePopoverCardId, setActivePopoverCardId] = useState<string | null>(null);

  if (!gameState || !playerId) return null;

  const player = gameState.players.find(p => p.id === playerId);
  if (!player) return null;

  const activePlayerId = getActivePlayerId(gameState);
  const isMyTurn = playerId === activePlayerId;
  const isPreRoll = gameState.turnPhase === 'pre_roll';

  const getCardDeckQty = (name: string): number => {
    const qtyMap: Record<string, number> = {
      alchemist: 2, Alchemy: 2,
      crane: 2, Crane: 2,
      engineer: 1, Engineering: 1,
      inventor: 2, Invention: 2,
      irrigation: 2, Irrigation: 2,
      medicine: 2, Medicine: 2,
      mining: 2, Mining: 2,
      road_building: 2,
      smith: 2, Smithing: 2,
      printer: 1, Printing: 1,
      commercial_harbor: 2,
      master_merchant: 2, guild_dues: 2, 'Guild Dues': 2,
      merchant: 6, Merchant: 6,
      merchant_fleet: 2, 'Merchant Fleet': 2,
      resource_monopoly: 4, 'Resource Monopoly': 4,
      commodity_monopoly: 2, 'Trade Monopoly': 2,
      wedding: 2, Wedding: 2,
      diplomat: 2, Diplomacy: 2,
      warlord: 2, encouragement: 2, Encouragement: 2,
      spy: 3, espionage: 3, Espionage: 3,
      intrigue: 2, Intrigue: 2,
      saboteur: 2, sabotage: 2, Sabotage: 2,
      bishop: 2, taxation: 2, Taxation: 2,
      deserter: 2, treason: 2, Treason: 2,
      constitution: 1, Constitution: 1
    };
    return qtyMap[name.toLowerCase()] || 2;
  };

  const cardDetailsMap: Record<string, { title: string; effect: string }> = {
    alchemist: {
      title: 'Alchemy',
      effect: 'Play BEFORE rolling dice. Set the production dice to any result you choose. Then roll and resolve the event die normally.'
    },
    crane: {
      title: 'Crane',
      effect: 'Build 1 city improvement for 1 commodity less than normal. One Crane per improvement. Can reduce Level 1 cost to 0.'
    },
    engineer: {
      title: 'Engineering',
      effect: 'Build 1 city wall at no cost.'
    },
    inventor: {
      title: 'Invention',
      effect: 'Swap any 2 number discs (cannot swap 2, 6, 8, or 12). Robber does not move with a swapped disc.'
    },
    irrigation: {
      title: 'Irrigation',
      effect: 'Take 2 wheat for each field hex adjacent to at least one of your buildings.'
    },
    medicine: {
      title: 'Medicine',
      effect: 'Upgrade one settlement to a city for 1 wheat + 2 ore (instead of normal cost). One Medicine per settlement upgraded.'
    },
    mining: {
      title: 'Mining',
      effect: 'Take 2 ore for each mountain hex adjacent to at least one of your buildings.'
    },
    road_building: {
      title: 'Road Building',
      effect: 'Build 2 roads at no cost.'
    },
    smith: {
      title: 'Smithing',
      effect: 'Promote up to 2 of your knights at no cost. Each knight may only be promoted once per turn.'
    },
    printer: {
      title: 'Printing',
      effect: 'Play immediately (even if not your turn). Worth 1 VP.'
    },
    commercial_harbor: {
      title: 'Commercial Harbor',
      effect: 'Offer each other player 1 of your resource cards. They must give you 1 commodity of their choice. If they have none, take back your resource. One offer per player, anytime this turn.'
    },
    master_merchant: {
      title: 'Guild Dues',
      effect: 'Look at the hand of a player with MORE VPs than you. Take any 2 cards (resource and/or commodity) from their hand.'
    },
    merchant: {
      title: 'Merchant',
      effect: 'Take control of the merchant piece. Place on any land hex next to one of your buildings. Trade that resource at 2:1 while you control it. Worth 1 VP.'
    },
    merchant_fleet: {
      title: 'Merchant Fleet',
      effect: 'Name 1 resource or commodity. For the rest of this turn, trade that type at 2:1 with supply (unlimited trades).'
    },
    resource_monopoly: {
      title: 'Resource Monopoly',
      effect: 'Name 1 resource type. Each player must give you 2 of that resource (or 1 if they only have 1).'
    },
    commodity_monopoly: {
      title: 'Trade Monopoly',
      effect: 'Name 1 commodity type. Each player must give you 1 of that commodity if they have it.'
    },
    wedding: {
      title: 'Wedding',
      effect: 'Each player with MORE VPs than you gives you 2 resource/commodity cards of their choice (or as many as they have).'
    },
    diplomat: {
      title: 'Diplomacy',
      effect: 'Remove one "open" road from the board. If it\'s your road, immediately build 1 road at no cost.'
    },
    warlord: {
      title: 'Encouragement',
      effect: 'Activate all your knights at no cost.'
    },
    spy: {
      title: 'Espionage',
      effect: 'Look at another player\'s progress card hand. Take 1 card if you choose. VP cards may not be stolen.'
    },
    intrigue: {
      title: 'Intrigue',
      effect: 'Perform the Displace a Knight action without using one of your knights. The displaced knight must start on an intersection connected to at least one of your routes.'
    },
    saboteur: {
      title: 'Sabotage',
      effect: 'Each player with AS MANY OR MORE VPs than you discards half their resource and/or commodity cards (rounded down).'
    },
    bishop: {
      title: 'Taxation',
      effect: 'Move the robber to a new hex. Steal 1 random resource/commodity from EACH player with a building there (only 1 card per player even if multiple buildings). Progress cards cannot be stolen. Only playable after first barbarian attack.'
    },
    deserter: {
      title: 'Treason',
      effect: 'Choose a player. They must remove one of their knights. You may place one of your knights of equal or lesser strength on the board (following normal placement rules) with the same active/inactive status.'
    },
    constitution: {
      title: 'Constitution',
      effect: 'Play immediately (even if not your turn). Worth 1 VP.'
    }
  };

  const handleProgressCardPlay = (card: ProgressCard) => {
    if (card.name === 'alchemist' && !isPreRoll) {
      alert('Alchemy must be played before rolling dice.');
      return;
    }
    if (card.name === 'inventor') {
      useGameStore.getState().setSelectionAction('inventor_select', card.id);
    } else if (card.name === 'deserter') {
      useGameStore.getState().setSelectionAction('deserter_select', card.id);
    } else if (card.name === 'diplomat') {
      useGameStore.getState().setSelectionAction('diplomat_select', card.id);
    } else if (card.name === 'intrigue') {
      useGameStore.getState().setSelectionAction('intrigue_select', card.id);
    } else if (card.name === 'bishop') {
      const hexId = prompt('Enter land/desert hex ID to move robber to (e.g. hex_0_1):');
      if (hexId) {
        sendAction({ type: 'PLAY_PROGRESS_CARD', cardId: card.id, params: { hexId } });
      }
    } else if (card.name === 'merchant') {
      const hexId = prompt('Enter land hex ID adjacent to one of your buildings (e.g. hex_0_1):');
      if (hexId) {
        sendAction({ type: 'PLAY_PROGRESS_CARD', cardId: card.id, params: { hexId } });
      }
    } else if (card.name === 'smith') {
      const knightIdA = prompt('Enter first Knight ID to upgrade:');
      const knightIdB = prompt('Enter second Knight ID to upgrade (optional, press Enter to skip):');
      if (knightIdA) {
        sendAction({ type: 'PLAY_PROGRESS_CARD', cardId: card.id, params: { knightIdA, knightIdB } });
      }
    } else if (card.name === 'commercial_harbor') {
      const payCard = prompt('Enter card in hand to trade (e.g. lumber, cloth):');
      const takeCard1 = prompt('Enter card to receive from player 1:');
      const takeCard2 = prompt('Enter card to receive from player 2 (optional, press Enter to skip):');
      if (payCard && takeCard1) {
        sendAction({ type: 'PLAY_PROGRESS_CARD', cardId: card.id, params: { payCard, takeCard1, takeCard2 } });
      }
    } else {
      sendAction({ type: 'PLAY_PROGRESS_CARD', cardId: card.id });
    }
  };

  const getCardBackStyles = (type: string) => {
    switch (type) {
      case 'science':
        return {
          gradient: 'linear-gradient(160deg, #1a3a22 0%, #0d2015 100%)',
          rune: 'ᛟ',
          runeColor: 'var(--green-track-lit)'
        };
      case 'trade':
        return {
          gradient: 'linear-gradient(160deg, #1a3030 0%, #0d1c1c 100%)',
          rune: 'ᛗ',
          runeColor: 'var(--border-copper)'
        };
      case 'politics':
        return {
          gradient: 'linear-gradient(160deg, #241a3a 0%, #140d25 100%)',
          rune: 'ᚱ',
          runeColor: 'var(--purple-track-lit)'
        };
      default:
        return {
          gradient: 'linear-gradient(160deg, #28180a 0%, #150e05 100%)',
          rune: '★',
          runeColor: 'var(--gold-primary)'
        };
      }
  };

  const activePlayCount = player.progressCards.length;

  return (
    <div className="glass-panel p-2 px-3 rounded-lg border border-[var(--border-dark)] flex items-center justify-between gap-2 relative">
      <div className="flex items-baseline gap-1.5 select-none">
        <span className="font-cinzel font-bold text-[10px] tracking-wide text-[var(--gold-primary)] uppercase">
          PROGRESS CARDS
        </span>
        <span className="font-cinzel text-[9px] text-[var(--text-secondary)] font-bold">
          (Hand: {activePlayCount}/4)
        </span>
      </div>

      {/* Horizontal row of card backs */}
      <div className="flex items-center gap-1.5 flex-grow justify-end relative">
        {player.progressCards.map((card) => {
          const cardBack = getCardBackStyles(card.type);
          const nameOverride = cardDetailsMap[card.name]?.title || card.title;
          const effectOverride = cardDetailsMap[card.name]?.effect || card.effect;
          const qty = getCardDeckQty(card.name);

          const isPopoverOpen = activePopoverCardId === card.id;

          return (
            <div
              key={card.id}
              className="relative cursor-pointer select-none"
              onClick={() => setActivePopoverCardId(isPopoverOpen ? null : card.id)}
              title={nameOverride}
            >
              {/* Card Back container */}
              <div
                style={{
                  background: cardBack.gradient,
                  width: '28px',
                  height: '38px'
                }}
                className="rounded border border-[var(--border-copper)] shadow-[0_2px_6px_rgba(0,0,0,0.5)] hover:border-[var(--border-gold)] hover:scale-105 transition-all duration-150 flex items-center justify-center relative overflow-hidden"
              >
                {/* Centered faint rune symbol */}
                <span
                  style={{ color: cardBack.runeColor }}
                  className="font-serif text-lg font-bold opacity-20 select-none pointer-events-none"
                >
                  {cardBack.rune}
                </span>
              </div>

              {/* Hover Popover containing details and Play actions */}
              {isPopoverOpen && (
                <div
                  className="absolute bottom-[58px] right-0 w-64 bg-[var(--bg-panel)] border border-[var(--border-copper)] p-3 rounded-lg shadow-2xl z-50 text-[11px] text-[var(--text-primary)] font-serif"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex justify-between items-center border-b border-[var(--border-dark)] pb-1 mb-2 font-cinzel">
                    <span className="font-bold text-[10px] text-[var(--gold-primary)] uppercase tracking-wider">
                      {nameOverride} ({qty})
                    </span>
                    <button
                      onClick={() => setActivePopoverCardId(null)}
                      className="text-[var(--text-secondary)] hover:text-white text-xs font-bold leading-none"
                    >
                      ✕
                    </button>
                  </div>
                  
                  <p className="text-[10px] text-[var(--text-primary)] leading-normal mb-2.5">
                    {effectOverride}
                  </p>

                  {isMyTurn && (
                    <button
                      onClick={() => {
                        handleProgressCardPlay(card);
                        setActivePopoverCardId(null);
                      }}
                      className="w-full custom-btn py-1 text-[9px] uppercase tracking-wider"
                    >
                      Play Card
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {player.progressCards.length === 0 && (
          <span className="text-[10px] text-[var(--text-secondary)] italic font-serif py-2.5 pr-2">
            No cards in hand
          </span>
        )}
      </div>
    </div>
  );
};
