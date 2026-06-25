import React from 'react';
import { X, TrendingUp, BarChart2, ShieldAlert, Award } from 'lucide-react';
import { GameState } from '../../shared/types';
import { GameSummary } from '../../shared/statsTypes';

interface StatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Can display live game state stats or a past game summary
  liveGameState?: GameState | null;
  pastGameSummary?: GameSummary | null;
}

export const StatsModal: React.FC<StatsModalProps> = ({
  isOpen,
  onClose,
  liveGameState,
  pastGameSummary
}) => {
  if (!isOpen) return null;

  // Determine source data
  const isLive = !!liveGameState;
  const rollHistory = isLive ? liveGameState?.rollHistory || [] : pastGameSummary?.rollHistory || [];
  const eventHistory = isLive ? liveGameState?.eventHistory || [] : pastGameSummary?.eventHistory || [];
  const progressHistory = isLive ? liveGameState?.progressHistory || [] : pastGameSummary?.progressHistory || [];
  const barbarianAttackCount = isLive ? liveGameState?.barbarianAttackCount || 0 : pastGameSummary?.barbarianAttackCount || 0;
  
  // Format players listing
  const players = isLive 
    ? (liveGameState?.players || []).map(p => ({
        id: p.id,
        name: p.name,
        color: p.color,
        victoryPoints: p.victoryPoints,
        science: p.cityImprovements.blue,
        trade: p.cityImprovements.green,
        politics: p.cityImprovements.yellow
      }))
    : (pastGameSummary?.players || []).map((p, idx) => ({
        id: `p_${idx}`,
        name: p.name,
        color: p.color,
        victoryPoints: p.victoryPoints,
        // Since past summaries don't have final levels inside player list, we can extract from final progress snapshot
        science: progressHistory.filter(s => s.playerName === p.name).slice(-1)[0]?.scienceLevel || 0,
        trade: progressHistory.filter(s => s.playerName === p.name).slice(-1)[0]?.tradeLevel || 0,
        politics: progressHistory.filter(s => s.playerName === p.name).slice(-1)[0]?.politicsLevel || 0
      }));

  const winnerName = isLive 
    ? liveGameState?.winnerId ? liveGameState.players.find(p => p.id === liveGameState.winnerId)?.name : null
    : pastGameSummary?.winnerName;

  const winnerColor = isLive 
    ? liveGameState?.winnerId ? liveGameState.players.find(p => p.id === liveGameState.winnerId)?.color : null
    : pastGameSummary?.winnerColor;

  // 1. Calculate Dice Rolls Frequencies
  const rollCounts = Array(13).fill(0);
  rollHistory.forEach(val => {
    if (val >= 2 && val <= 12) {
      rollCounts[val]++;
    }
  });

  const totalRolls = rollHistory.length;
  const maxRollCount = Math.max(...rollCounts, 1);

  // Expected probabilities out of 36
  const expectedProbs = [0, 0, 1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1]; // 2 to 12
  const expectedPercentages = expectedProbs.map(p => (p / 36) * 100);

  // 2. Calculate Event Die Breakdown
  const eventCounts = { barbarian: 0, science: 0, trade: 0, politics: 0 };
  eventHistory.forEach(face => {
    if (face in eventCounts) {
      eventCounts[face as keyof typeof eventCounts]++;
    }
  });
  const totalEvents = eventHistory.length;

  // 3. Render color mapping helper
  const getPlayerColorClass = (color: string) => {
    switch (color?.toLowerCase()) {
      case 'red': return 'var(--player-red)';
      case 'blue': return 'var(--player-blue)';
      case 'green': return 'var(--player-green)';
      case 'orange': return 'var(--player-orange)';
      case 'white': return 'var(--player-white)';
      default: return 'var(--gold-primary)';
    }
  };

  // 4. SVG Progress Line Chart calculations
  const maxTurn = Math.max(1, ...progressHistory.map(s => s.turnNumber));
  // We want y axis to go up to at least 10 (catan win condition), or max VP achieved
  const maxVP = Math.max(10, ...progressHistory.map(s => s.victoryPoints));

  const chartWidth = 550;
  const chartHeight = 220;
  const paddingLeft = 40;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 30;

  const graphWidth = chartWidth - paddingLeft - paddingRight;
  const graphHeight = chartHeight - paddingTop - paddingBottom;

  // Group progress history by player name
  const playerProgressLines = players.map(p => {
    // Filter history for this player, sorted by turn
    const snaps = progressHistory
      .filter(s => s.playerName === p.name || s.playerId === p.id)
      .sort((a, b) => a.turnNumber - b.turnNumber);
    
    // Always start at turn 0, 2 VP (default setup)
    const points = [{ turn: 0, vp: 2, science: 0, trade: 0, politics: 0 }];
    snaps.forEach(s => {
      points.push({
        turn: s.turnNumber,
        vp: s.victoryPoints,
        science: s.scienceLevel,
        trade: s.tradeLevel,
        politics: s.politicsLevel
      });
    });
    return {
      name: p.name,
      color: p.color,
      points
    };
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto parchment-texture">
      <div className="bg-[var(--bg-panel)] border-2 border-[var(--border-copper)] rounded-xl shadow-2xl w-full max-w-4xl p-6 relative flex flex-col gap-6 max-h-[92vh] overflow-y-auto text-[var(--text-primary)]">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[var(--text-secondary)] hover:text-[var(--gold-bright)] transition-colors p-1 border border-transparent hover:border-[var(--border-copper)] rounded"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="border-b border-[var(--border-dark)] pb-4">
          <h2 className="text-2xl font-cinzel text-[var(--gold-primary)] font-bold tracking-wide flex items-center gap-2">
            📊 GAME STATISTICS & HISTORICAL LOG
          </h2>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            {isLive ? 'Live metrics and progression charts for this session' : 'Archived record of a completed match'}
          </p>
        </div>

        {winnerName && (
          <div className="flex items-center gap-3 bg-[var(--bg-raised)] border border-[var(--border-gold)] p-4 rounded-lg">
            <Award className="w-8 h-8 text-[var(--gold-bright)] flex-shrink-0" />
            <div>
              <h3 className="font-cinzel text-lg text-[var(--gold-bright)] font-bold">
                VICTORY ACHIEVED!
              </h3>
              <p className="text-sm">
                Winner:{' '}
                <span 
                  className="font-bold font-cinzel"
                  style={{ color: getPlayerColorClass(winnerColor || '') }}
                >
                  {winnerName}
                </span>
              </p>
            </div>
          </div>
        )}

        {/* 1. Overall Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-[var(--bg-inset)] border border-[var(--border-dark)] p-3 rounded flex flex-col items-center text-center">
            <TrendingUp className="w-5 h-5 text-[var(--gold-primary)] mb-1" />
            <span className="text-xs text-[var(--text-secondary)]">Total Turns</span>
            <span className="text-xl font-cinzel font-bold text-[var(--text-primary)] mt-1">
              {isLive ? (liveGameState?.players.length ? Math.max(...progressHistory.map(s => s.turnNumber), 0) : 0) : pastGameSummary?.totalTurns || 0}
            </span>
          </div>
          <div className="bg-[var(--bg-inset)] border border-[var(--border-dark)] p-3 rounded flex flex-col items-center text-center">
            <BarChart2 className="w-5 h-5 text-[var(--gold-primary)] mb-1" />
            <span className="text-xs text-[var(--text-secondary)]">Dice Rolls</span>
            <span className="text-xl font-cinzel font-bold text-[var(--text-primary)] mt-1">
              {totalRolls}
            </span>
          </div>
          <div className="bg-[var(--bg-inset)] border border-[var(--border-dark)] p-3 rounded flex flex-col items-center text-center">
            <ShieldAlert className="w-5 h-5 text-[var(--gold-primary)] mb-1" />
            <span className="text-xs text-[var(--text-secondary)]">Barbarian Attacks</span>
            <span className="text-xl font-cinzel font-bold text-[var(--text-primary)] mt-1">
              {barbarianAttackCount}
            </span>
          </div>
          <div className="bg-[var(--bg-inset)] border border-[var(--border-dark)] p-3 rounded flex flex-col items-center text-center">
            <span className="text-xl text-[var(--gold-primary)] mb-1">🎲</span>
            <span className="text-xs text-[var(--text-secondary)]">Most Common Roll</span>
            <span className="text-xl font-cinzel font-bold text-[var(--text-primary)] mt-1">
              {totalRolls > 0 
                ? (() => {
                    let maxVal = 2;
                    for (let i = 3; i <= 12; i++) {
                      if (rollCounts[i] > rollCounts[maxVal]) maxVal = i;
                    }
                    return `${maxVal} (${rollCounts[maxVal]})`;
                  })()
                : 'N/A'
              }
            </span>
          </div>
        </div>

        {/* 2. Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Dice Rolls Distribution */}
          <div className="bg-[var(--bg-raised)] border border-[var(--border-dark)] p-4 rounded-lg flex flex-col gap-3">
            <h3 className="font-cinzel text-sm text-[var(--gold-primary)] font-bold tracking-wider flex items-center gap-1.5 border-b border-[var(--border-dark)] pb-2">
              <span>🎲</span> DICE ROLL DISTRIBUTION
            </h3>
            {totalRolls === 0 ? (
              <div className="h-48 flex items-center justify-center text-sm text-[var(--text-secondary)] italic">
                No rolls recorded yet in this session.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="w-full overflow-x-auto">
                  <svg viewBox="0 0 420 180" className="w-full h-auto min-w-[320px]">
                    {/* Grid lines */}
                    {[0.25, 0.5, 0.75, 1].map((ratio, idx) => (
                      <line
                        key={idx}
                        x1="30"
                        y1={140 - ratio * 120}
                        x2="410"
                        y2={140 - ratio * 120}
                        stroke="var(--border-dark)"
                        strokeDasharray="2,4"
                      />
                    ))}

                    {/* Bars and curve */}
                    {Array.from({ length: 11 }, (_, i) => i + 2).map(num => {
                      const count = rollCounts[num];
                      const pct = totalRolls > 0 ? (count / totalRolls) * 100 : 0;
                      
                      // Scale heights
                      // Let's assume max ratio (pct / maxRollPct) matches height
                      const maxPct = Math.max(...rollCounts.map(c => totalRolls > 0 ? (c / totalRolls) * 100 : 0), 16.6);
                      const barHeight = (pct / maxPct) * 110;
                      
                      const barWidth = 18;
                      const x = 35 + (num - 2) * 33;
                      const y = 140 - barHeight;

                      // Standard expected percentage height mapping
                      const expPct = expectedPercentages[num];
                      const expHeight = (expPct / maxPct) * 110;
                      const expY = 140 - expHeight;

                      return (
                        <g key={num} className="group">
                          {/* Tooltip on hover */}
                          <title>{`Roll ${num}: ${count} times (${pct.toFixed(1)}%) vs Expected ${expPct.toFixed(1)}%`}</title>
                          
                          {/* Expected curve indicator dot */}
                          <circle
                            cx={x + barWidth / 2}
                            cy={expY}
                            r="3"
                            fill="var(--text-secondary)"
                            opacity="0.6"
                          />
                          {/* Line segments between expected points will be drawn below */}

                          {/* Actual count bar */}
                          <rect
                            x={x}
                            y={y}
                            width={barWidth}
                            height={Math.max(barHeight, 2)}
                            rx="2"
                            fill={num === 7 ? 'var(--red-die-bright)' : 'var(--gold-primary)'}
                            className="hover:fill-[var(--gold-bright)] transition-colors cursor-pointer"
                          />
                          
                          {/* Text count above bar */}
                          {count > 0 && (
                            <text
                              x={x + barWidth / 2}
                              y={y - 4}
                              textAnchor="middle"
                              className="text-[10px] fill-[var(--text-primary)] font-semibold"
                            >
                              {count}
                            </text>
                          )}

                          {/* X-axis label */}
                          <text
                            x={x + barWidth / 2}
                            y="156"
                            textAnchor="middle"
                            className="text-xs fill-[var(--text-secondary)] font-cinzel font-bold"
                          >
                            {num}
                          </text>
                        </g>
                      );
                    })}

                    {/* Connect the dots for the bell curve */}
                    <path
                      d={Array.from({ length: 11 }, (_, i) => i + 2)
                        .map(num => {
                          const x = 35 + (num - 2) * 33 + 9;
                          const maxPct = Math.max(...rollCounts.map(c => totalRolls > 0 ? (c / totalRolls) * 100 : 0), 16.6);
                          const expPct = expectedPercentages[num];
                          const expHeight = (expPct / maxPct) * 110;
                          const expY = 140 - expHeight;
                          return `${num === 2 ? 'M' : 'L'} ${x} ${expY}`;
                        })
                        .join(' ')}
                      fill="none"
                      stroke="var(--border-copper)"
                      strokeWidth="1.5"
                      strokeDasharray="3,3"
                      opacity="0.8"
                    />

                    {/* Bottom axis line */}
                    <line x1="25" y1="140" x2="415" y2="140" stroke="var(--border-dark)" strokeWidth="1.5" />
                  </svg>
                </div>
                <div className="flex justify-between items-center text-[11px] text-[var(--text-secondary)] px-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 bg-[var(--gold-primary)] rounded-sm"></div>
                    <span>Actual Rolls</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-0 border-t-2 border-dashed border-[var(--border-copper)]"></div>
                    <span>Expected Bell Curve</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Event Die & Barbarians */}
          <div className="bg-[var(--bg-raised)] border border-[var(--border-dark)] p-4 rounded-lg flex flex-col gap-3">
            <h3 className="font-cinzel text-sm text-[var(--gold-primary)] font-bold tracking-wider flex items-center gap-1.5 border-b border-[var(--border-dark)] pb-2">
              <span>🚢</span> EVENT DIE BREAKDOWN
            </h3>
            {totalEvents === 0 ? (
              <div className="h-48 flex items-center justify-center text-sm text-[var(--text-secondary)] italic">
                No events rolled yet.
              </div>
            ) : (
              <div className="flex flex-col gap-5 justify-center h-full pb-4">
                {/* Horizontal Segmented Bar */}
                <div className="flex h-7 w-full rounded overflow-hidden border border-[var(--border-dark)] bg-[var(--bg-inset)]">
                  {Object.entries(eventCounts).map(([face, count]) => {
                    const pct = totalEvents > 0 ? (count / totalEvents) * 100 : 0;
                    if (count === 0) return null;
                    
                    let bg = 'bg-slate-500';
                    if (face === 'barbarian') bg = 'bg-[var(--barbarian-red)]';
                    if (face === 'science') bg = 'bg-[var(--blue-track-lit)]';
                    if (face === 'trade') bg = 'bg-[var(--green-track-lit)]';
                    if (face === 'politics') bg = 'bg-[var(--purple-track-lit)]';

                    return (
                      <div
                        key={face}
                        style={{ width: `${pct}%` }}
                        className={`${bg} h-full transition-all duration-300 relative group cursor-pointer`}
                      >
                        <title>{`${face.toUpperCase()}: ${count} rolls (${pct.toFixed(1)}%)`}</title>
                      </div>
                    );
                  })}
                </div>

                {/* Legend & Details */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="flex items-center justify-between p-2 rounded bg-[var(--bg-inset)] border border-[var(--border-dark)]">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-[var(--barbarian-red)] rounded-full"></div>
                      <span className="font-bold">Barbarian Ship</span>
                    </div>
                    <span className="font-cinzel">{eventCounts.barbarian} ({((eventCounts.barbarian / (totalEvents || 1)) * 100).toFixed(0)}%)</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-[var(--bg-inset)] border border-[var(--border-dark)]">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-[var(--blue-track-lit)] rounded-full"></div>
                      <span className="font-bold">Science (Blue)</span>
                    </div>
                    <span className="font-cinzel">{eventCounts.science} ({((eventCounts.science / (totalEvents || 1)) * 100).toFixed(0)}%)</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-[var(--bg-inset)] border border-[var(--border-dark)]">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-[var(--green-track-lit)] rounded-full"></div>
                      <span className="font-bold">Trade (Green)</span>
                    </div>
                    <span className="font-cinzel">{eventCounts.trade} ({((eventCounts.trade / (totalEvents || 1)) * 100).toFixed(0)}%)</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-[var(--bg-inset)] border border-[var(--border-dark)]">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-[var(--purple-track-lit)] rounded-full"></div>
                      <span className="font-bold">Politics (Yellow)</span>
                    </div>
                    <span className="font-cinzel">{eventCounts.politics} ({((eventCounts.politics / (totalEvents || 1)) * 100).toFixed(0)}%)</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 3. VP Progress Timeline */}
        <div className="bg-[var(--bg-raised)] border border-[var(--border-dark)] p-4 rounded-lg flex flex-col gap-3">
          <h3 className="font-cinzel text-sm text-[var(--gold-primary)] font-bold tracking-wider flex items-center gap-1.5 border-b border-[var(--border-dark)] pb-2">
            <span>📈</span> PLAYER VICTORY POINTS PROGRESSION
          </h3>
          {progressHistory.length === 0 ? (
            <div className="h-44 flex items-center justify-center text-sm text-[var(--text-secondary)] italic">
              No turn history snapshots recorded yet. Progression curves will populate as players finish turns.
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="w-full overflow-x-auto">
                <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-auto min-w-[500px]">
                  {/* Grid Lines for VP */}
                  {Array.from({ length: maxVP + 1 }).map((_, vpVal) => {
                    // Draw lines at intervals of 2 for VPs
                    if (vpVal % 2 !== 0 && vpVal !== maxVP) return null;
                    const y = paddingTop + graphHeight - (vpVal / maxVP) * graphHeight;
                    return (
                      <g key={vpVal}>
                        <line
                          x1={paddingLeft}
                          y1={y}
                          x2={chartWidth - paddingRight}
                          y2={y}
                          stroke="var(--border-dark)"
                          strokeWidth={vpVal === 2 || vpVal === 10 ? '1' : '0.5'}
                          strokeDasharray={vpVal === 10 ? 'none' : '2,4'}
                        />
                        <text
                          x={paddingLeft - 10}
                          y={y + 4}
                          textAnchor="end"
                          className="text-[10px] fill-[var(--text-secondary)] font-cinzel"
                        >
                          {vpVal} VP
                        </text>
                      </g>
                    );
                  })}

                  {/* Grid Lines for Turns */}
                  {Array.from({ length: maxTurn + 1 }).map((_, turnVal) => {
                    // Show a vertical grid line for each turn (or every 2/5 if there are many)
                    const divisor = maxTurn > 15 ? 5 : maxTurn > 8 ? 2 : 1;
                    if (turnVal % divisor !== 0 && turnVal !== maxTurn) return null;
                    
                    const x = paddingLeft + (turnVal / maxTurn) * graphWidth;
                    return (
                      <g key={turnVal}>
                        <line
                          x1={x}
                          y1={paddingTop}
                          x2={x}
                          y2={paddingTop + graphHeight}
                          stroke="var(--border-dark)"
                          strokeWidth="0.5"
                          strokeDasharray="2,4"
                        />
                        <text
                          x={x}
                          y={paddingTop + graphHeight + 16}
                          textAnchor="middle"
                          className="text-[10px] fill-[var(--text-secondary)] font-cinzel"
                        >
                          T{turnVal}
                        </text>
                      </g>
                    );
                  })}

                  {/* Draw Player Lines */}
                  {playerProgressLines.map((line, playerIdx) => {
                    const color = getPlayerColorClass(line.color);
                    
                    // Create path coordinates
                    const pathData = line.points
                      .map(pt => {
                        const x = paddingLeft + (pt.turn / maxTurn) * graphWidth;
                        const y = paddingTop + graphHeight - (pt.vp / maxVP) * graphHeight;
                        return `${pt.turn === 0 ? 'M' : 'L'} ${x} ${y}`;
                      })
                      .join(' ');

                    return (
                      <g key={playerIdx}>
                        {/* Line path */}
                        <path
                          d={pathData}
                          fill="none"
                          stroke={color}
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />

                        {/* Interactive Data Dots */}
                        {line.points.map((pt, dotIdx) => {
                          const cx = paddingLeft + (pt.turn / maxTurn) * graphWidth;
                          const cy = paddingTop + graphHeight - (pt.vp / maxVP) * graphHeight;

                          return (
                            <circle
                              key={dotIdx}
                              cx={cx}
                              cy={cy}
                              r="4"
                              fill={color}
                              stroke="var(--bg-panel)"
                              strokeWidth="1"
                              className="cursor-pointer hover:scale-150 transition-transform"
                            >
                              <title>{`${line.name}\nTurn ${pt.turn}\nScore: ${pt.vp} VP\nImprovements: Science: ${pt.science}, Trade: ${pt.trade}, Politics: ${pt.politics}`}</title>
                            </circle>
                          );
                        })}
                      </g>
                    );
                  })}

                  {/* Base graph boundaries */}
                  <line
                    x1={paddingLeft}
                    y1={paddingTop}
                    x2={paddingLeft}
                    y2={paddingTop + graphHeight}
                    stroke="var(--border-dark)"
                    strokeWidth="1"
                  />
                  <line
                    x1={paddingLeft}
                    y1={paddingTop + graphHeight}
                    x2={chartWidth - paddingRight}
                    y2={paddingTop + graphHeight}
                    stroke="var(--border-dark)"
                    strokeWidth="1"
                  />
                </svg>
              </div>

              {/* Legends line */}
              <div className="flex flex-wrap justify-center gap-4 text-xs mt-1">
                {players.map(p => (
                  <div key={p.id} className="flex items-center gap-2">
                    <div
                      className="w-3 h-1.5 rounded"
                      style={{ backgroundColor: getPlayerColorClass(p.color) }}
                    ></div>
                    <span className="font-cinzel text-[var(--text-primary)] font-bold">{p.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 4. Player Standings & Level Table */}
        <div className="bg-[var(--bg-raised)] border border-[var(--border-dark)] p-4 rounded-lg">
          <h3 className="font-cinzel text-sm text-[var(--gold-primary)] font-bold tracking-wider border-b border-[var(--border-dark)] pb-2 mb-3">
            👑 CURRENT STANDINGS & CITY IMPROVEMENTS
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[var(--border-dark)] text-[var(--text-secondary)] font-cinzel">
                  <th className="py-2 px-3">Player</th>
                  <th className="py-2 px-3 text-center">Score</th>
                  <th className="py-2 px-3 text-center text-[var(--blue-track-lit)]">Science (Blue)</th>
                  <th className="py-2 px-3 text-center text-[var(--green-track-lit)]">Trade (Green)</th>
                  <th className="py-2 px-3 text-center text-[var(--purple-track-lit)]">Politics (Yellow)</th>
                </tr>
              </thead>
              <tbody>
                {players.map(p => (
                  <tr key={p.id} className="border-b border-[var(--border-dark)]/50 hover:bg-[var(--bg-inset)]/50 transition-colors">
                    <td className="py-2.5 px-3 flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full border border-black/35 flex-shrink-0"
                        style={{ backgroundColor: getPlayerColorClass(p.color) }}
                      ></div>
                      <span className="font-cinzel font-bold text-[var(--text-primary)]">{p.name}</span>
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold text-[var(--gold-bright)]">{p.victoryPoints} VP</td>
                    <td className="py-2.5 px-3 text-center font-cinzel">Lv. {p.science}</td>
                    <td className="py-2.5 px-3 text-center font-cinzel">Lv. {p.trade}</td>
                    <td className="py-2.5 px-3 text-center font-cinzel">Lv. {p.politics}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};
