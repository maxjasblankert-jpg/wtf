import React, { useState } from 'react';
import { Anchor, BookOpen, Scale, Landmark } from 'lucide-react';
import { useGameStore, getActivePlayerId } from '../store/gameStore';
import { useSocket } from '../hooks/useSocket';
import { EventDieFace } from '@shared/types';

export const DicePanel: React.FC = () => {
  const { gameState, playerId } = useGameStore();
  const { sendAction } = useSocket();

  const [isRolling, setIsRolling] = useState(false);
  const [alcWhite, setAlcWhite] = useState(3);
  const [alcRed, setAlcRed] = useState(4);

  if (!gameState || !playerId) return null;

  const { white, red, event, lastRollTotal } = gameState.dice;
  const activePlayerId = getActivePlayerId(gameState);
  const isMyTurn = playerId === activePlayerId;
  const isPreRoll = gameState.turnPhase === 'pre_roll';
  const showRollButton = isMyTurn && isPreRoll && !gameState.alchemistPending;

  const handleRoll = () => {
    setIsRolling(true);
    setTimeout(() => {
      sendAction({ type: 'ROLL_DICE' });
      setIsRolling(false);
    }, 600);
  };

  const handleAlchemistConfirm = () => {
    sendAction({
      type: 'SELECT_ALCHEMIST_DICE',
      white: alcWhite,
      red: alcRed
    });
  };

  // Render dots for dice fitting inside 44px
  const renderDiceDots = (num: number, isRed: boolean) => {
    const dotsMap: Record<number, number[]> = {
      1: [4],
      2: [0, 8],
      3: [0, 4, 8],
      4: [0, 2, 6, 8],
      5: [0, 2, 4, 6, 8],
      6: [0, 2, 3, 5, 6, 8]
    };

    const dots = dotsMap[num] || [];
    // Red die: var(--red-die-bright). Yellow die: bg-slate-900 (dark)
    const dotBg = isRed ? 'bg-[var(--red-die-bright)]' : 'bg-slate-900';

    return (
      <div className="grid grid-cols-3 grid-rows-3 gap-0.5 w-8 h-8 p-0.5 select-none pointer-events-none">
        {Array.from({ length: 9 }).map((_, idx) => (
          <div key={idx} className="flex items-center justify-center">
            {dots.includes(idx) && (
              <div className={`w-2 h-2 rounded-full ${dotBg} shadow-sm`} />
            )}
          </div>
        ))}
      </div>
    );
  };

  // Event die face details (white cube 44x44px) - FIX 10
  const renderEventFace = () => {
    let symbol = '';
    let symbolColor = '#000000';
    if (event === 'barbarian') { symbol = '⚓'; symbolColor = '#6b1010'; }
    else if (event === 'science') { symbol = '📜'; symbolColor = '#2a7a40'; }
    else if (event === 'trade') { symbol = '⚖️'; symbolColor = '#1d9e75'; }
    else if (event === 'politics') { symbol = '🤝'; symbolColor = '#5a2a9a'; }

    return (
      <div
        style={{
          background: '#ffffff',
          border: '2px solid #cccccc',
          borderRadius: '6px',
          width: '44px',
          height: '44px',
          boxShadow: 'inset 0 -2px 4px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.6)'
        }}
        className="flex items-center justify-center relative select-none font-bold text-xl"
      >
        <span style={{ color: symbolColor }}>{symbol}</span>
      </div>
    );
  };

  const renderEventBadgeUnderDie = () => {
    if (event === 'barbarian') return null;
    let bg = 'transparent';
    let text = '';
    if (event === 'science') { bg = '#2a7a40'; text = 'SCIENCE'; }
    if (event === 'trade') { bg = '#1d9e75'; text = 'TRADE'; }
    if (event === 'politics') { bg = '#5a2a9a'; text = 'POLITICS'; }

    return (
      <span
        style={{ backgroundColor: bg }}
        className="px-1.5 py-0.5 rounded-full text-white font-cinzel text-[7px] font-bold tracking-wider leading-none mt-1 select-none pointer-events-none"
      >
        {text}
      </span>
    );
  };

  const getEventBadge = (evFace: EventDieFace) => {
    let bg = 'var(--bg-inset)';
    if (evFace === 'politics') bg = 'var(--purple-track)';
    if (evFace === 'science') bg = 'var(--blue-track)';
    if (evFace === 'trade') bg = 'var(--green-track)';
    if (evFace === 'barbarian') bg = 'var(--barbarian-red)';

    const label = evFace === 'barbarian' ? 'BARB' : evFace.toUpperCase();

    return (
      <span
        style={{ backgroundColor: bg }}
        className="text-[var(--text-primary)] px-2 py-0.5 rounded font-cinzel text-[0.68rem] tracking-wider uppercase font-semibold select-none"
      >
        {label}
      </span>
    );
  };

  return (
    <div className="glass-panel p-3.5 rounded-lg shadow-lg border border-[var(--border-dark)] flex flex-col gap-3.5 w-full relative">
      <h3 className="panel-heading text-center">DICE CONSOLE</h3>

      {/* Alchemist Choice UI */}
      {gameState.alchemistPending && isMyTurn ? (
        <div className="flex flex-col items-center gap-3 w-full border border-[var(--border-copper)] bg-[var(--bg-inset)] p-3 rounded-lg">
          <span className="text-[10px] text-[var(--gold-bright)] font-cinzel font-bold uppercase tracking-wider">Alchemist Selection</span>
          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <label className="text-[9px] text-[var(--text-secondary)] font-cinzel mb-1">Yellow Die</label>
              <select
                value={alcWhite}
                onChange={(e) => setAlcWhite(parseInt(e.target.value))}
                className="bg-[var(--bg-inset)] border border-[var(--border-dark)] text-[var(--text-primary)] px-3 py-1 rounded text-sm outline-none font-cinzel font-bold"
              >
                {[1, 2, 3, 4, 5, 6].map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col items-center">
              <label className="text-[9px] text-[var(--text-secondary)] font-cinzel mb-1">Red Die</label>
              <select
                value={alcRed}
                onChange={(e) => setAlcRed(parseInt(e.target.value))}
                className="bg-[var(--bg-inset)] border border-[var(--border-dark)] text-[var(--text-primary)] px-3 py-1 rounded text-sm outline-none font-cinzel font-bold"
              >
                {[1, 2, 3, 4, 5, 6].map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
          </div>
          <button
            onClick={handleAlchemistConfirm}
            className="w-full custom-btn py-1.5 text-xs font-cinzel font-bold uppercase tracking-wider"
          >
            Confirm Dice Selection
          </button>
        </div>
      ) : (
        /* Regular Dice Panel Display */
        <div className="flex flex-col gap-3 w-full">
          
          {/* Physical Dice Row aligned at top */}
          <div className="flex items-start justify-center gap-4 min-h-[60px]">
            <div className={`flex items-start gap-4 ${isRolling ? 'animate-shake' : ''}`}>
              {/* Yellow production die */}
              <div className="flex flex-col items-center">
                <div
                  style={{
                    background: 'var(--yellow-die)',
                    border: '2px solid #c0a020',
                    borderRadius: '6px',
                    width: '44px',
                    height: '44px',
                    boxShadow: 'inset 0 -2px 4px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.6)'
                  }}
                  className="flex items-center justify-center"
                >
                  {renderDiceDots(white, false)}
                </div>
              </div>

              {/* Red production die */}
              <div className="flex flex-col items-center">
                <div
                  style={{
                    background: 'var(--red-die)',
                    border: '2px solid #c04040',
                    borderRadius: '6px',
                    width: '44px',
                    height: '44px',
                    boxShadow: 'inset 0 -2px 4px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.6)'
                  }}
                  className="flex items-center justify-center"
                >
                  {renderDiceDots(red, true)}
                </div>
              </div>

              {/* Event die */}
              <div className="flex flex-col items-center">
                {renderEventFace()}
                {renderEventBadgeUnderDie()}
              </div>
            </div>
          </div>

          {/* Result Row and Roll Buttons */}
          <div className="w-full flex flex-col gap-2 bg-[var(--bg-inset)] border border-[var(--border-dark)] p-2 rounded-lg">
            
            {/* Results Grid */}
            <div className="grid grid-cols-4 gap-1.5 text-center">
              <div className="flex flex-col gap-0.5">
                <span className="text-[8px] font-cinzel text-[var(--text-secondary)] uppercase">Yellow</span>
                <div
                  className="h-8 bg-[var(--bg-inset)] border border-[var(--border-dark)] rounded flex items-center justify-center font-cinzel font-bold text-[var(--gold-bright)]"
                  style={{ fontSize: '1.25rem' }}
                >
                  {white}
                </div>
              </div>

              <div className="flex flex-col gap-0.5">
                <span className="text-[8px] font-cinzel text-[var(--text-secondary)] uppercase">Red</span>
                <div
                  className="h-8 bg-[var(--bg-inset)] border border-[var(--border-dark)] rounded flex items-center justify-center font-cinzel font-bold text-[var(--gold-bright)]"
                  style={{ fontSize: '1.25rem' }}
                >
                  {red}
                </div>
              </div>

              <div className="flex flex-col gap-0.5">
                <span className="text-[8px] font-cinzel text-[var(--text-secondary)] uppercase">Event</span>
                <div className="h-8 bg-[var(--bg-inset)] border border-[var(--border-dark)] rounded flex items-center justify-center">
                  {getEventBadge(event)}
                </div>
              </div>

              <div className="flex flex-col gap-0.5">
                <span className="text-[8px] font-cinzel text-[var(--text-secondary)] uppercase">Total</span>
                <div
                  className="h-8 bg-[var(--bg-inset)] border border-[var(--border-dark)] rounded flex items-center justify-center font-cinzel font-bold text-[var(--gold-bright)]"
                  style={{ fontSize: '1.25rem' }}
                >
                  {lastRollTotal}
                </div>
              </div>
            </div>

            {/* Buttons Row */}
            {showRollButton && (
              <div className="grid grid-cols-4 gap-1.5 mt-1 select-none">
                <button
                  onClick={handleRoll}
                  disabled={isRolling}
                  className="custom-btn text-[9px] py-1 px-0 text-center col-span-1 uppercase leading-none font-bold"
                >
                  Roll
                </button>
                <button
                  onClick={handleRoll}
                  disabled={isRolling}
                  className="custom-btn text-[9px] py-1 px-0 text-center col-span-1 uppercase leading-none font-bold"
                >
                  Roll
                </button>
                <button
                  onClick={handleRoll}
                  disabled={isRolling}
                  className="custom-btn text-[9px] py-1 px-0 text-center col-span-2 uppercase leading-none font-bold"
                >
                  Total: Roll
                </button>
              </div>
            )}

            {/* Barbarian Ship Notification */}
            {event === 'barbarian' && (
              <div className="text-center mt-0.5 select-none leading-none">
                <span className="text-red-400 font-serif text-[0.72rem] italic">
                  Barbarian Ship Moved!
                </span>
              </div>
            )}
          </div>

          {!isMyTurn && (
            <div className="bg-[var(--bg-inset)] border border-[var(--border-dark)] px-4 py-1 rounded text-[9px] text-[var(--text-secondary)] font-serif italic text-center w-full">
              Waiting for {gameState.players.find(p => p.id === activePlayerId)?.name || 'active player'}...
            </div>
          )}
        </div>
      )}
    </div>
  );
};
