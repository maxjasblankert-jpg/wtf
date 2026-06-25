import React, { useState } from 'react';
import { Board } from './components/Board';
import { PlayerHUD } from './components/PlayerHUD';
import { DicePanel } from './components/DicePanel';
import { CityImprovementBoard } from './components/CityImprovementBoard';
import { BarbarianTrack } from './components/BarbarianTrack';
import { ResourcesPanel } from './components/ResourcesPanel';
import { ConstructionPanel } from './components/ConstructionPanel';
import { ProgressCardsPanel } from './components/ProgressCardsPanel';
import { useGameStore, runBotStep } from './store/gameStore';
import { useSocket } from './hooks/useSocket';
import { Compass, Sparkles, Users, RotateCcw, AlertTriangle, Check, ShieldAlert, Trophy, Shield } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Resource, Commodity, PlayerState } from '../shared/types';
import { StatsModal } from './components/StatsModal';
import { GameSummary } from '../shared/statsTypes';
import { getPastGames } from './services/firebaseService';

const App: React.FC = () => {
  const { gameState, lobbyPlayers, joinedRoomId, playerName, playerColor, isLobby, isConnected, playerId, localMode, startLocalGame, localBots } = useGameStore();
  const { joinRoom, startGame, sendAction, stopGame } = useSocket();

  const [inputRoomId, setInputRoomId] = useState(joinedRoomId && joinedRoomId !== 'local-game' ? joinedRoomId : 'catan-ck');
  const [inputName, setInputName] = useState(playerName || '');
  const [inputColor, setInputColor] = useState(playerColor || 'red');
  const [playMode, setPlayMode] = useState<'online' | 'local' | 'history'>(localMode ? 'local' : 'online');
  const [localPlayerCount, setLocalPlayerCount] = useState<number>(3);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [selectedPastGame, setSelectedPastGame] = useState<GameSummary | null>(null);
  const [pastGames, setPastGames] = useState<GameSummary[]>([]);

  // Trigger bot steps on reload/load for active bot turns in local play
  React.useEffect(() => {
    if (localMode && gameState) {
      const currentActiveId = getActivePlayerId();
      if (localBots && localBots.includes(currentActiveId)) {
        const timer = setTimeout(() => {
          runBotStep();
        }, 800);
        return () => clearTimeout(timer);
      }
    }
  }, [localMode, gameState ? getActivePlayerId() : null, localBots]);

  React.useEffect(() => {
    if (playMode === 'history') {
      getPastGames().then(games => {
        setPastGames(games);
      }).catch(err => console.error('Error fetching past games:', err));
    }
  }, [playMode]);

  // Exact 6th Edition color palette styles
  const colorMap: Record<string, string> = {
    red: '#b01818',
    blue: '#1848a0',
    green: '#2a5e3a',
    orange: '#c85a10',
    white: '#e8e0d0'
  };

  const getPlayerColor = (color: string) => colorMap[color.toLowerCase()] || color;

  const availableColors = [
    { name: 'Red', hex: 'red', color: '#b01818' },
    { name: 'Blue', hex: 'blue', color: '#1848a0' },
    { name: 'Green', hex: 'green', color: '#2a5e3a' },
    { name: 'Orange', hex: 'orange', color: '#c85a10' }
  ];

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputName.trim()) {
      alert('Please enter your name.');
      return;
    }
    joinRoom(inputRoomId.trim(), inputName.trim(), inputColor);
  };

  const handleStartGame = () => {
    if (lobbyPlayers.length < 3) {
      alert('⚠️ Need at least 3 players to start Catan: Cities & Knights!');
      return;
    }
    startGame();
  };

  const isDiscardPending = () => {
    if (!gameState || !playerId) return false;
    if (gameState.turnPhase !== 'post_roll') return false;

    const pState = gameState.players.find(p => p.id === playerId);
    if (!pState) return false;

    const limit = 7 + 2 * pState.cityWallCount;
    const totalHand = Object.values(pState.resources).reduce((a, b) => a + b, 0) +
                      Object.values(pState.commodities).reduce((a, b) => a + b, 0);

    return totalHand > limit;
  };

  const handleDiscardSubmit = (resources: any, commodities: any) => {
    sendAction({
      type: 'DISCARD_CARDS',
      resources,
      commodities
    });
  };

  const triggerWinConfetti = () => {
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 }
    });
  };

  if (gameState?.phase === 'end') {
    triggerWinConfetti();
  }

  if (!isLobby && !gameState) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-[var(--bg-deep)] text-[var(--sand)] font-serif">
        <Compass className="w-12 h-12 text-[var(--gold-primary)] animate-spin mb-4" />
        <p className="font-cinzel text-lg font-bold tracking-wider">CONNECTING TO THE BOARD...</p>
      </div>
    );
  }

  // Active turn player details
  const getActivePlayerId = () => {
    if (!gameState) return '';
    let idx = gameState.currentPlayerIndex;
    if (gameState.phase === 'setup' && idx >= gameState.turnOrder.length) {
      idx = 2 * gameState.turnOrder.length - 1 - idx;
    }
    return gameState.turnOrder[idx] || '';
  };

  const activePlayerId = getActivePlayerId();
  const activePlayer = gameState ? gameState.players.find(p => p.id === activePlayerId) : null;
  const activePlayerColor = activePlayer ? getPlayerColor(activePlayer.color) : '#ffffff';
  const isMyTurn = playerId === activePlayerId;

  const getSetupInstruction = () => {
    if (!gameState) return '';
    const orderLen = gameState.turnOrder.length;
    const idx = gameState.currentPlayerIndex;
    const round = idx < orderLen ? 1 : 2;
    return round === 1 ? "Setup: Place Settlement & Road" : "Setup: Place City & Road";
  };

  const getSetupActivePlayerName = () => {
    if (!gameState) return '';
    const orderLen = gameState.turnOrder.length;
    let idx = gameState.currentPlayerIndex;
    if (idx >= orderLen) {
      idx = 2 * orderLen - 1 - idx;
    }
    const pId = gameState.turnOrder[idx];
    const player = gameState.players.find(p => p.id === pId);
    return player ? player.name.replace(/\(bot\)/i, '').trim().toUpperCase() : '';
  };

  // Phase Stepper name mapping
  const getPhaseText = () => {
    if (!gameState) return '';
    if (gameState.phase === 'setup') return 'SETUP';
    if (gameState.turnPhase === 'pre_roll') return 'ROLL DICE';
    if (gameState.turnPhase === 'post_roll') return 'PRODUCTION';
    if (gameState.turnPhase === 'building') return 'ACTION';
    return gameState.phase.toUpperCase();
  };

  // VP hoverable list helper
  const getVpBreakdown = (p: PlayerState) => {
    if (!gameState) return [];
    const settlements = gameState.vertices.filter(v => v.building && v.building.playerId === p.id && v.building.type === 'settlement').length;
    const cities = gameState.vertices.filter(v => v.building && v.building.playerId === p.id && v.building.type === 'city').length;
    const metropolises = gameState.vertices.filter(v => v.building && v.building.playerId === p.id && v.building.type === 'metropolis').length;
    const hasLongest = p.hasLongestRoad;
    const isDefender = p.isDefenderOfCatan;
    const hasMerchant = gameState.merchant.playerId === p.id;
    const hidden = p.hiddenVP;

    const list: string[] = [];
    if (settlements > 0) list.push(`${settlements} Settlement${settlements > 1 ? 's' : ''}: ${settlements} VP`);
    if (cities > 0) list.push(`${cities} City/Cities: ${cities * 2} VP`);
    if (metropolises > 0) list.push(`${metropolises} Metropolis/es: ${metropolises * 4} VP`);
    if (hasLongest) list.push(`Longest Road: 2 VP`);
    if (isDefender) list.push(`Defender of Catan: 1 VP`);
    if (hasMerchant) list.push(`Merchant Control: 1 VP`);
    if (hidden > 0 && p.id === playerId) list.push(`VP Cards (Printing/Constitution): ${hidden} VP`);

    return list;
  };

  // Calculate Barbarian Strength & Defender strength for UI overlay
  const getBarbarianStrengths = () => {
    if (!gameState) return { barbStrength: 0, knightDefense: 0 };
    const barbStrength = gameState.vertices.filter(v => v.building && (v.building.type === 'city' || v.building.type === 'metropolis')).length;
    const knightDefense = gameState.knights.filter(k => k.isActive).reduce((sum, k) => sum + k.level, 0);
    return { barbStrength, knightDefense };
  };

  const { barbStrength, knightDefense } = getBarbarianStrengths();

  return (
    <div className="h-full flex flex-col bg-[var(--bg-deep)] text-[var(--sand)] overflow-hidden">
      
      {/* Top Banner (Status / Gameplay Header) */}
      {!gameState ? (
        // Lobby Header
        <header
          style={{
            background: 'var(--bg-panel)',
            borderBottom: '1px solid var(--border-dark)',
            padding: '12px 24px'
          }}
          className="flex items-center justify-between relative z-40"
        >
          <div className="flex items-center gap-2">
            <Compass className="w-5.5 h-5.5 text-[var(--gold-primary)] animate-spin-slow" />
            <h1 className="font-bold text-base md:text-lg tracking-widest uppercase font-cinzel text-[var(--gold-primary)]">
              CATAN: CITIES &amp; KNIGHTS
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-[var(--text-secondary)] font-cinzel tracking-wider">CONNECTION STATUS:</span>
            <div className="flex items-center gap-1.5">
              {localMode ? (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_#f59e0b] animate-pulse"></span>
                  <span className="text-[10px] font-cinzel font-bold text-amber-400">LOCAL PLAY</span>
                </>
              ) : (
                <>
                  <span className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 'bg-red-500 animate-pulse'}`}></span>
                  <span className="text-[10px] font-cinzel font-bold text-[var(--text-secondary)]">
                    {isConnected ? 'ONLINE' : 'OFFLINE'}
                  </span>
                </>
              )}
            </div>
          </div>
        </header>
      ) : (
        // Gameplay Header matching FIX 1 and FIX 2 specs
        <header
          style={{
            background: 'var(--bg-panel)',
            borderBottom: '1px solid var(--border-dark)'
          }}
          className="top-bar z-40 relative animate-fade-in"
        >
             {/* 1. Turn indicator */}
          <div className="flex items-center gap-2">
            <div className="active-player-pill flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--border-gold)]/40 bg-[var(--bg-inset)]/65">
              <span className="w-3 h-3 rounded-full border border-black/45 shadow" style={{ backgroundColor: activePlayerColor, boxShadow: `0 0 6px ${activePlayerColor}` }}></span>
              <span className="font-cinzel text-xs font-bold text-[var(--text-primary)] uppercase leading-none">
                {activePlayer?.name}'S TURN
              </span>
            </div>
            {isMyTurn && (
              <span className="your-turn-pill border border-[#90EE90]/40 text-[#90EE90] px-3 py-1.5 rounded-full text-[11px] font-bold font-cinzel tracking-widest bg-[#2D5A1E] ml-1 leading-none">
                YOUR TURN
              </span>
            )}
          </div>
 
          {/* 2. Phase / Setup indicator (FIX 2) */}
          <div className="flex flex-col items-center justify-center text-center">
            {gameState.phase === 'setup' ? (
              <div className="flex flex-col items-center justify-center">
                <span className="font-cinzel text-xs font-bold text-[var(--gold-primary)] tracking-widest uppercase">
                  {getSetupInstruction()}
                </span>
                <span className="text-[11px] text-[var(--text-secondary)] font-serif mt-0.5 italic">
                  Waiting for {getSetupActivePlayerName()}
                </span>
              </div>
            ) : (
              <div className="relative pb-0.5">
                <span className="font-cinzel text-sm font-bold text-[var(--gold-primary)] tracking-widest uppercase">
                  {getPhaseText()}
                </span>
                <div className="absolute left-0 right-0 bottom-0 h-[2px] animated-underline"></div>
              </div>
            )}
          </div>
  
          {/* 3. VP Scores: Centered flex row (FIX 1) */}
          <div className="player-scores">
            {gameState.players.map((p, idx) => {
              const isCurrent = p.id === activePlayerId;
              const isMe = p.id === playerId;
              const pColor = getPlayerColor(p.color);
              const breakdown = getVpBreakdown(p);
              const nameText = p.name.replace(/\(bot\)/i, '').trim();
              const isBot = p.name.toLowerCase().includes('(bot)');
 
              return (
                <div
                  key={p.id}
                  style={isCurrent ? { borderBottom: '2px solid var(--gold-primary)', borderRadius: '0px' } : {}}
                  className="player-score-entry px-1 py-1 relative group cursor-help transition-all duration-150"
                >
                  {/* Bullet color indicator dot */}
                  <div
                    style={{
                      backgroundColor: pColor,
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      border: '1px solid rgba(255,255,255,0.3)',
                      boxShadow: `0 0 6px ${pColor}`
                    }}
                  />

                  {/* Player name */}
                  <span className="font-cinzel font-semibold text-[0.8rem] text-[var(--text-primary)]">
                    {nameText} {isBot && <span className="text-[0.6rem] text-[var(--text-secondary)] italic">(BOT)</span>}
                  </span>

                  {/* VP count */}
                  <span className="font-cinzel font-bold text-[0.85rem] text-[var(--gold-bright)] ml-0.5">
                    {p.victoryPoints + (isMe ? p.hiddenVP : 0)} VP
                  </span>

                  {/* VP breakdown tooltip */}
                  <div className="absolute right-0 top-full mt-1.5 hidden group-hover:flex flex-col bg-[var(--bg-panel)] border border-[var(--border-copper)] p-2 rounded shadow-2xl z-50 text-[10px] w-48 text-[var(--text-primary)] text-left font-serif">
                    <span className="font-bold font-cinzel text-[var(--gold-primary)] border-b border-[var(--border-dark)] pb-1 mb-1 block uppercase">VP BREAKDOWN</span>
                    <div className="flex flex-col gap-0.5">
                      {breakdown.map((line, idx) => (
                        <div key={idx}>{line}</div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* View Stats button */}
            <button
              onClick={() => {
                setSelectedPastGame(null);
                setIsStatsOpen(true);
              }}
              className="ml-2 border border-[var(--border-copper)] text-[var(--gold-bright)] hover:text-white hover:border-[var(--gold-bright)] px-2 py-0.5 rounded text-[10px] font-bold font-cinzel tracking-widest bg-[var(--bg-inset)]/40 transition-all select-none"
            >
              STATS
            </button>

            {/* Stop Game button */}
            <button
              onClick={stopGame}
              className="ml-4 border border-red-950 text-red-400 hover:text-red-300 hover:border-red-400 px-2 py-0.5 rounded text-[10px] font-bold font-cinzel tracking-widest bg-red-950/20 transition-all select-none"
            >
              STOP GAME
            </button>
          </div>
 
        </header>
      )}

      {!gameState ? (
        /* Lobby View style overrides */
        <main className="flex-grow flex items-center justify-center p-6 bg-[radial-gradient(circle_at_center,_#261a0c_0%,_#1a1208_100%)]">
          <div className="w-full max-w-md glass-panel p-8 rounded-3xl shadow-2xl border border-[var(--border-subtle)] flex flex-col gap-6 relative overflow-hidden parchment-texture">
            
            <div className="text-center">
              <h2 className="text-2xl font-bold tracking-widest uppercase font-cinzel text-[var(--gold-primary)]">Lobby Console</h2>
              <p className="text-xs font-serif text-[var(--sand-muted)] mt-1">Configure your room and join the table</p>
            </div>

            {/* Play Mode Selector */}
            <div className="flex bg-[var(--bg-deep)]/60 p-1 rounded-xl border border-[var(--border-subtle)] gap-1">
              <button
                type="button"
                onClick={() => setPlayMode('online')}
                className={`flex-grow py-1.5 px-1 rounded-lg text-[9px] font-cinzel font-bold uppercase tracking-wider transition-all ${
                  playMode === 'online'
                    ? 'bg-[var(--gold-primary)] text-[var(--bg-deep)] shadow-md'
                    : 'text-[var(--sand-muted)] hover:text-slate-200'
                }`}
              >
                Online
              </button>
              <button
                type="button"
                onClick={() => setPlayMode('local')}
                className={`flex-grow py-1.5 px-1 rounded-lg text-[9px] font-cinzel font-bold uppercase tracking-wider transition-all ${
                  playMode === 'local'
                    ? 'bg-[var(--gold-primary)] text-[var(--bg-deep)] shadow-md'
                    : 'text-[var(--sand-muted)] hover:text-slate-200'
                }`}
              >
                vs Bots
              </button>
              <button
                type="button"
                onClick={() => setPlayMode('history')}
                className={`flex-grow py-1.5 px-1 rounded-lg text-[9px] font-cinzel font-bold uppercase tracking-wider transition-all ${
                  playMode === 'history'
                    ? 'bg-[var(--gold-primary)] text-[var(--bg-deep)] shadow-md'
                    : 'text-[var(--sand-muted)] hover:text-slate-200'
                }`}
              >
                Past Games
              </button>
            </div>

            {!joinedRoomId ? (
              playMode === 'online' ? (
                /* Online Join Form */
                <form onSubmit={handleJoin} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-cinzel font-bold text-[var(--sand-muted)] tracking-wider">Room Code</label>
                    <input
                      type="text"
                      value={inputRoomId}
                      onChange={(e) => setInputRoomId(e.target.value)}
                      placeholder="Enter Room Code"
                      className="bg-[var(--bg-deep)] border border-[var(--border-subtle)] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--border-accent)] text-[var(--sand)]"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-cinzel font-bold text-[var(--sand-muted)] tracking-wider">Your Name</label>
                    <input
                      type="text"
                      value={inputName}
                      onChange={(e) => setInputName(e.target.value)}
                      placeholder="Enter Player Name"
                      maxLength={12}
                      className="bg-[var(--bg-deep)] border border-[var(--border-subtle)] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--border-accent)] text-[var(--sand)] font-serif"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-cinzel font-bold text-[var(--sand-muted)] tracking-wider">Pick Color</label>
                    <div className="grid grid-cols-4 gap-2 mt-1">
                      {availableColors.map((c) => {
                        const selected = inputColor === c.hex;
                        return (
                          <button
                            key={c.hex}
                            type="button"
                            onClick={() => setInputColor(c.hex)}
                            style={{ backgroundColor: c.color }}
                            className={`py-2 rounded-xl text-xs font-bold text-white transition-all relative ${
                              selected ? 'ring-2 ring-white scale-105 shadow-lg font-black' : 'opacity-65 hover:opacity-100'
                            }`}
                          >
                            {selected && <Check className="w-4 h-4 mx-auto" />}
                            {!selected && c.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full mt-2 custom-btn py-3 text-xs uppercase tracking-widest shadow-lg flex items-center justify-center gap-1.5"
                  >
                    <Users className="w-4 h-4" />
                    <span>Join Room Lobby</span>
                  </button>
                </form>
              ) : playMode === 'local' ? (
                /* Local Offline Match setup */
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-cinzel font-bold text-[var(--sand-muted)] tracking-wider">Your Name</label>
                    <input
                      type="text"
                      value={inputName}
                      onChange={(e) => setInputName(e.target.value)}
                      placeholder="Enter Player Name"
                      maxLength={12}
                      className="bg-[var(--bg-deep)] border border-[var(--border-subtle)] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--border-accent)] text-[var(--sand)] font-serif"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-cinzel font-bold text-[var(--sand-muted)] tracking-wider">Pick Color</label>
                    <div className="grid grid-cols-4 gap-2 mt-1">
                      {availableColors.map((c) => {
                        const selected = inputColor === c.hex;
                        return (
                          <button
                            key={c.hex}
                            type="button"
                            onClick={() => setInputColor(c.hex)}
                            style={{ backgroundColor: c.color }}
                            className={`py-2 rounded-xl text-xs font-bold text-white transition-all relative ${
                              selected ? 'ring-2 ring-white scale-105 shadow-lg' : 'opacity-65 hover:opacity-100'
                            }`}
                          >
                            {selected && <Check className="w-4 h-4 mx-auto" />}
                            {!selected && c.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] uppercase font-cinzel font-bold text-[var(--sand-muted)] tracking-wider">Player Count (including Bots)</label>
                    <div className="flex gap-2">
                      {[3, 4].map((count) => {
                        const isCountSelected = localPlayerCount === count;
                        return (
                          <button
                            key={count}
                            type="button"
                            onClick={() => setLocalPlayerCount(count)}
                            className={`flex-1 py-2 rounded-xl text-xs font-cinzel font-bold uppercase transition-all border ${
                              isCountSelected
                                ? 'bg-[var(--gold-primary)] border-[var(--gold-light)] text-[var(--bg-deep)] shadow-md'
                                : 'bg-[var(--bg-deep)] border-[var(--border-subtle)] text-[var(--sand-muted)] hover:text-slate-200'
                            }`}
                          >
                            {count} Players ({count - 1} Bots)
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      if (!inputName.trim()) {
                        alert('Please enter your name.');
                        return;
                      }
                      startLocalGame(inputName.trim(), inputColor, localPlayerCount);
                    }}
                    className="w-full mt-2 custom-btn py-3 text-xs uppercase tracking-widest shadow-lg flex items-center justify-center gap-1.5"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Start Offline Match</span>
                  </button>
                </div>
              ) : (
                /* Past Matches */
                <div className="flex flex-col gap-3 max-h-[330px] overflow-y-auto pr-1">
                  {pastGames.length === 0 ? (
                    <div className="text-center font-serif text-xs text-[var(--sand-muted)] italic py-8">
                      No past games found. Complete a match to see its stats here!
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2.5">
                      {pastGames.map((game) => (
                        <div
                          key={game.id}
                          className="bg-[var(--bg-deep)]/45 border border-[var(--border-subtle)] hover:border-[var(--border-copper)] transition-all rounded-xl p-3 flex flex-col gap-1.5 relative text-left"
                        >
                          <div className="flex items-center justify-between text-[9px] text-[var(--sand-muted)] border-b border-[var(--border-subtle)]/40 pb-1">
                            <span className="font-cinzel font-bold">
                              {new Date(game.date).toLocaleDateString()} {new Date(game.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className="font-cinzel">
                              {Math.floor(game.durationSeconds / 60)}m {game.durationSeconds % 60}s
                            </span>
                          </div>
                          
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-serif">
                              Winner:{' '}
                              <span
                                className="font-cinzel font-black uppercase text-[11px]"
                                style={{
                                  color:
                                    game.winnerColor === 'red' ? 'var(--player-red)' :
                                    game.winnerColor === 'blue' ? 'var(--player-blue)' :
                                    game.winnerColor === 'green' ? 'var(--player-green)' :
                                    game.winnerColor === 'orange' ? 'var(--player-orange)' :
                                    game.winnerColor === 'white' ? 'var(--player-white)' :
                                    'var(--gold-primary)'
                                }}
                              >
                                {game.winnerName}
                              </span>
                            </span>
                            <span className="text-[10px] text-[var(--sand-muted)] font-cinzel font-bold">
                              {game.totalTurns} Turns
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[9px] text-[var(--sand-muted)]">
                            {game.players.map((p, idx) => (
                              <div key={idx} className="flex items-center gap-1">
                                <span
                                  className="w-1.5 h-1.5 rounded-full"
                                  style={{
                                    backgroundColor:
                                      p.color === 'red' ? 'var(--player-red)' :
                                      p.color === 'blue' ? 'var(--player-blue)' :
                                      p.color === 'green' ? 'var(--player-green)' :
                                      p.color === 'orange' ? 'var(--player-orange)' :
                                      p.color === 'white' ? 'var(--player-white)' :
                                      'var(--gold-primary)'
                                  }}
                                ></span>
                                <span>{p.name.replace(/\(bot\)/i, '').trim()}: {p.victoryPoints} VP</span>
                              </div>
                            ))}
                          </div>

                          <button
                            onClick={() => {
                              setSelectedPastGame(game);
                              setIsStatsOpen(true);
                            }}
                            className="w-full mt-1 border border-[var(--border-copper)] hover:border-[var(--border-gold)] text-[var(--text-primary)] hover:text-white rounded-lg py-1 text-[9px] font-cinzel font-bold uppercase tracking-wider transition-all bg-[var(--bg-panel)] shadow-sm"
                          >
                            Detailed Stats
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            ) : (
              /* Waiting in Lobby */
              <div className="flex flex-col gap-6">
                <div className="bg-[var(--bg-deep)] border border-[var(--border-subtle)] rounded-xl p-4">
                  <span className="text-[9px] uppercase font-cinzel font-bold text-[var(--sand-muted)] tracking-wider">Room code:</span>
                  <div className="text-xl font-cinzel font-bold text-[var(--gold-light)] mt-0.5">{joinedRoomId}</div>
                  <p className="text-[10px] font-serif text-[var(--sand-muted)] mt-2">Open another browser window/tab and join this room code to simulate multiplayer testing!</p>
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-[9px] uppercase font-cinzel font-bold text-[var(--sand-muted)] tracking-wider">Players Joined ({lobbyPlayers.length}/4):</span>
                  <div className="flex flex-col gap-1.5">
                    {lobbyPlayers.map((p) => {
                      const color = getPlayerColor(p.color);
                      return (
                        <div key={p.id} className="flex items-center gap-3 bg-[var(--bg-deep)]/40 border border-[var(--border-subtle)] px-4 py-2 rounded-xl text-sm">
                          <span className="w-3.5 h-3.5 rounded-full border border-black/30" style={{ backgroundColor: color }}></span>
                          <span className="font-cinzel text-xs text-[var(--sand)]">{p.name} {p.id === playerId ? '(You)' : ''}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <button
                  onClick={handleStartGame}
                  disabled={lobbyPlayers.length < 3}
                  className="w-full custom-btn py-3 text-xs uppercase tracking-widest shadow-lg flex items-center justify-center gap-1.5 disabled:opacity-40"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Start Game Match</span>
                </button>
              </div>
            )}
          </div>
        </main>
      ) : (
        /* Gameplay View (Responsive Overhaul: Stacks on small screens) */
        <main className="flex-grow flex flex-col md:grid md:grid-cols-12 overflow-hidden bg-[var(--bg-deep)]">
          {/* Left Sidebar (Col Span 3) - FIX 5 */}
          <section className="md:col-span-3 left-sidebar border-r border-[var(--border-subtle)] md:border-b-0 animate-fade-in">
            <BarbarianTrack />
            <ResourcesPanel />
            <ProgressCardsPanel />
            <CityImprovementBoard />
          </section>

          {/* Main Board Panel (Col Span 6) */}
          <section className="md:col-span-6 flex flex-col h-full border-r border-[var(--border-subtle)] overflow-hidden relative">
            <div className="flex-grow relative h-full">
              <Board />
            </div>
          </section>

          {/* Right Sidebar Panel (Col Span 3) - FIX 8 */}
          <section className="md:col-span-3 right-sidebar animate-fade-in">
            <DicePanel />
            <ConstructionPanel />

            {/* Action Log Console */}
            <div className="glass-panel p-3 rounded-xl shadow-lg border border-[var(--border-subtle)] parchment-texture flex flex-col">
              <span className="text-[9px] font-cinzel font-bold uppercase tracking-widest text-[var(--sand-muted)] border-b border-[var(--border-subtle)] pb-1 mb-1.5 block">Action Ledger</span>
              <div className="action-ledger flex flex-col gap-1 text-[10px] text-[var(--sand)] font-serif pr-0.5 select-text">
                {gameState.log.slice().reverse().map((entry, idx) => (
                  <div key={idx} className="border-l border-[var(--border-accent)]/55 pl-1.5 leading-relaxed text-[10px] text-[var(--sand)]/90">
                    {entry}
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Floating UI Elements (Modals / Action prompts) */}
          <section className="relative z-35">
            <PlayerHUD />
          </section>
        </main>
      )}

      {/* OVERLAY: Barbarian Attack Downgrade Alert (Detailed Step-by-Step) */}
      {gameState?.phase === 'barbarian_attack' && (
        <div className="fixed inset-0 bg-red-950/90 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="glass-panel w-full max-w-lg rounded-2xl p-6 border border-red-500/30 flex flex-col gap-4 shadow-2xl parchment-texture">
            <div className="text-center flex flex-col items-center">
              <div className="w-16 h-16 bg-red-900/30 text-red-500 border border-red-500/30 rounded-full flex items-center justify-center animate-pulse mb-3">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <h2 className="text-3xl font-bold font-cinzel tracking-wider text-[var(--red-alert-text)] animate-pulse">BARBARIANS ATTACK!</h2>
              <p className="text-xs text-[var(--sand-muted)] font-serif mt-1">Enforcing Catan city defense resolution rules</p>
            </div>

            {/* Step 1: Strengths */}
            <div className="border border-[var(--border-subtle)] bg-[var(--bg-deep)]/40 p-3 rounded-xl flex flex-col gap-2">
              <span className="text-[10px] font-cinzel font-bold text-[var(--sand-muted)] uppercase tracking-wider border-b border-[var(--border-subtle)] pb-1">
                Step 1: Calculate Forces
              </span>
              <div className="grid grid-cols-2 text-center text-xs font-cinzel">
                <div className="flex flex-col border-r border-[var(--border-subtle)]">
                  <span className="text-[10px] text-[var(--red-alert-text)] font-bold">BARBARIAN STRENGTH</span>
                  <span className="text-2xl font-bold text-[var(--red-alert-text)]">{barbStrength}</span>
                  <span className="text-[8px] text-[var(--sand-muted)]">(Total Cities & Metropolises)</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-[var(--green-sci-text)] font-bold">DEFENDERS' SHIELD</span>
                  <span className="text-2xl font-bold text-[var(--green-sci-text)]">{knightDefense}</span>
                  <span className="text-[8px] text-[var(--sand-muted)]">(Sum of Active Knight Levels)</span>
                </div>
              </div>
            </div>

            {/* Step 2: Outcomes */}
            <div className="border border-[var(--border-subtle)] bg-[var(--bg-deep)]/40 p-3 rounded-xl flex flex-col gap-2">
              <span className="text-[10px] font-cinzel font-bold text-[var(--sand-muted)] uppercase tracking-wider border-b border-[var(--border-subtle)] pb-1">
                Step 2: Resolution Outcome
              </span>
              {knightDefense >= barbStrength ? (
                // Defenders win
                <div className="flex flex-col gap-1 text-xs">
                  <div className="text-[var(--green-sci-text)] font-cinzel font-bold uppercase tracking-wider">🛡️ defenders win the battle!</div>
                  <p className="text-[11px] font-serif text-[var(--sand)]">
                    The player with the highest active knight contribution earns 1 VP (Defender of Catan). If tied, tied players draw 1 progress card.
                  </p>
                </div>
              ) : (
                // Barbarians win
                <div className="flex flex-col gap-2.5 text-xs">
                  <div className="text-[var(--red-alert-text)] font-cinzel font-bold uppercase tracking-wider">🔥 catan is pillaged!</div>
                  <p className="text-[11px] font-serif text-[var(--sand)]">
                    The player(s) contributing the lowest knight defense must downgrade exactly one city to a settlement. Note: Cities with a Metropolis are immune.
                  </p>
                  
                  <div className="flex flex-col gap-1.5 border-t border-[var(--border-subtle)] pt-2">
                    <span className="text-[9px] font-cinzel text-[var(--sand-muted)]">AFFECTED PLAYERS MUST DOWNGRADE:</span>
                    <div className="flex gap-2 flex-wrap justify-center">
                      {gameState.pendingDowngrades.map((pId) => {
                        const p = gameState.players.find(pl => pl.id === pId)!;
                        return (
                          <div key={pId} className="flex items-center gap-1.5 bg-[var(--bg-raised)] border border-red-500/20 px-3 py-1 rounded">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getPlayerColor(p.color) }}></span>
                            <span className="font-cinzel text-[10px] font-bold text-[var(--sand)]">{p.name} {pId === playerId ? '(YOU)' : ''}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {playerId && gameState.pendingDowngrades.includes(playerId) ? (
              <div className="w-full text-center border-t border-[var(--border-subtle)] pt-4 mt-2">
                <p className="text-[11px] text-[var(--gold-light)] font-cinzel font-bold animate-pulse">
                  ⚠️ CLICK ONE OF YOUR ELIGIBLE CITIES ON THE BOARD TO DOWNGRADE IT TO A SETTLEMENT.
                </p>
              </div>
            ) : (
              <p className="text-[10px] text-[var(--sand-muted)] font-serif italic text-center mt-2">
                Waiting for affected players to resolve downgrades...
              </p>
            )}

          </div>
        </div>
      )}

      {/* OVERLAY: Discard Cards Modal */}
      {isDiscardPending() && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-50">
          {(() => {
            const pState = gameState!.players.find(p => p.id === playerId)!;
            const handLimit = 7 + 2 * pState.cityWallCount;
            const totalHand = Object.values(pState.resources).reduce((a, b) => a + b, 0) +
                              Object.values(pState.commodities).reduce((a, b) => a + b, 0);
            const numToDiscard = Math.floor(totalHand / 2);

            const [selectedResources, setSelectedResources] = useState<Record<string, number>>({ lumber: 0, brick: 0, wool: 0, grain: 0, ore: 0 });
            const [selectedCommodities, setSelectedCommodities] = useState<Record<string, number>>({ paper: 0, cloth: 0, coin: 0 });

            const getSelectedTotal = () => {
              return Object.values(selectedResources).reduce((a, b) => a + b, 0) +
                     Object.values(selectedCommodities).reduce((a, b) => a + b, 0);
            };

            const adjustQty = (item: string, val: number, isRes: boolean) => {
              if (isRes) {
                const max = pState.resources[item as Resource];
                setSelectedResources(prev => {
                  const nextVal = Math.min(max, Math.max(0, prev[item] + val));
                  return { ...prev, [item]: nextVal };
                });
              } else {
                const max = pState.commodities[item as Commodity];
                setSelectedCommodities(prev => {
                  const nextVal = Math.min(max, Math.max(0, prev[item] + val));
                  return { ...prev, [item]: nextVal };
                });
              }
            };

            const handleSubmit = () => {
              if (getSelectedTotal() !== numToDiscard) return;
              handleDiscardSubmit(selectedResources, selectedCommodities);
            };

            return (
              <div className="glass-panel w-full max-w-md rounded-2xl p-6 border border-[var(--border-accent)] flex flex-col gap-4 shadow-2xl parchment-texture">
                <div className="text-center flex flex-col items-center">
                  <div className="w-12 h-12 bg-amber-950/40 text-[var(--gold-light)] border border-[var(--border-accent)]/30 rounded-full flex items-center justify-center mb-2 animate-bounce">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <h2 className="text-lg font-bold font-cinzel tracking-wider text-[var(--gold-primary)] uppercase">Hand Limit Exceeded</h2>
                  <p className="text-xs text-[var(--sand-muted)] font-serif mt-1">
                    You hold {totalHand} cards (limit: {handLimit} due to {pState.cityWallCount} walls). Discard exactly <span className="font-bold text-[var(--gold-light)]">{numToDiscard}</span> cards:
                  </p>
                </div>

                <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto bg-[var(--bg-deep)]/40 border border-[var(--border-subtle)] rounded-xl p-3">
                  {/* Resources */}
                  {Object.entries(pState.resources).filter(([, q]) => q > 0).map(([k, q]) => (
                    <div key={k} className="flex items-center justify-between text-xs py-1 border-b border-[var(--border-subtle)]/40 last:border-0 font-serif">
                      <span className="capitalize">{k} (Own: {q})</span>
                      <div className="flex items-center gap-2">
                        <button onClick={() => adjustQty(k, -1, true)} className="bg-[var(--bg-raised)] border border-[var(--border-subtle)] px-2 py-0.5 rounded">-</button>
                        <span className="w-5 text-center font-cinzel font-bold text-[var(--gold-light)]">{selectedResources[k]}</span>
                        <button onClick={() => adjustQty(k, 1, true)} className="bg-[var(--bg-raised)] border border-[var(--border-subtle)] px-2 py-0.5 rounded">+</button>
                      </div>
                    </div>
                  ))}

                  {/* Commodities */}
                  {Object.entries(pState.commodities).filter(([, q]) => q > 0).map(([k, q]) => (
                    <div key={k} className="flex items-center justify-between text-xs py-1 border-b border-[var(--border-subtle)]/40 last:border-0 font-serif">
                      <span className="capitalize">{k} (Own: {q})</span>
                      <div className="flex items-center gap-2">
                        <button onClick={() => adjustQty(k, -1, false)} className="bg-[var(--bg-raised)] border border-[var(--border-subtle)] px-2 py-0.5 rounded">-</button>
                        <span className="w-5 text-center font-cinzel font-bold text-[var(--gold-light)]">{selectedCommodities[k]}</span>
                        <button onClick={() => adjustQty(k, 1, false)} className="bg-[var(--bg-raised)] border border-[var(--border-subtle)] px-2 py-0.5 rounded">+</button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between border-t border-[var(--border-subtle)] pt-4 mt-2">
                  <span className="text-xs text-[var(--sand-muted)] font-cinzel">Selected: {getSelectedTotal()} / {numToDiscard}</span>
                  <button
                    onClick={handleSubmit}
                    disabled={getSelectedTotal() !== numToDiscard}
                    className="custom-btn py-2 px-5 text-xs font-cinzel font-bold uppercase disabled:opacity-40 shadow-lg"
                  >
                    Confirm Discard
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* OVERLAY: Game Over Banner */}
      {gameState?.phase === 'end' && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="glass-panel w-full max-w-md rounded-2xl p-8 border border-[var(--border-accent)] text-center flex flex-col items-center gap-4 shadow-2xl parchment-texture animate-scale-in">
            <h2 className="text-3xl font-bold font-cinzel tracking-widest text-[var(--gold-primary)] uppercase">
              MATCH COMPLETE!
            </h2>
            <div className="w-12 h-12 bg-[var(--bg-deep)] border border-[var(--border-accent)] rounded-full flex items-center justify-center text-[var(--gold-light)] animate-bounce mt-1">
              <Trophy className="w-6 h-6" />
            </div>
            <p className="text-sm font-serif text-[var(--sand-muted)] mt-1">
              🎉 Player <span className="font-bold text-[var(--sand)]">{gameState.players.find(p => p.id === gameState.winnerId)?.name}</span> has won CATAN: CITIES &amp; KNIGHTS!
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 custom-btn py-3 px-6 text-xs uppercase tracking-widest flex items-center gap-1.5 shadow-lg"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Back to Lobby</span>
            </button>
          </div>
        </div>
      )}

      {/* OVERLAY: Game Paused (reconnect waiting) */}
      {gameState?.isPaused && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="glass-panel w-full max-w-md rounded-2xl p-8 border border-[var(--border-accent)] text-center flex flex-col items-center gap-4 shadow-2xl parchment-texture animate-scale-in">
            <h2 className="text-2xl font-bold font-cinzel tracking-widest text-[var(--gold-primary)] uppercase animate-pulse">
              GAME PAUSED
            </h2>
            <div className="w-12 h-12 bg-amber-950/40 text-amber-500 border border-amber-500/30 rounded-full flex items-center justify-center animate-bounce mt-1">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <p className="text-sm font-serif text-[var(--sand-muted)] mt-1">
              Waiting for disconnected players to rejoin the lobby using the same room code...
            </p>
            <button
              onClick={stopGame}
              className="mt-4 custom-btn py-3 px-6 text-xs uppercase tracking-widest flex items-center gap-1.5 shadow-lg bg-red-950/40 border border-red-500/40 text-red-400 hover:text-red-300"
            >
              <span>Stop Game</span>
            </button>
          </div>
        </div>
      )}

      {/* OVERLAY: Stats Modal */}
      <StatsModal
        isOpen={isStatsOpen}
        onClose={() => setIsStatsOpen(false)}
        liveGameState={selectedPastGame ? undefined : gameState}
        pastGameSummary={selectedPastGame}
      />
    </div>
  );
};

export default App;
