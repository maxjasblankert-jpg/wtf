import React, { useRef, useEffect, useState } from 'react';
import { useGameStore, ClientActionType, getActivePlayerId } from '../store/gameStore';
import { useSocket } from '../hooks/useSocket';
import { Vertex, Edge, HexTile, Knight } from '@shared/types';

export const Board: React.FC = () => {
  const { gameState, playerId, selection, selectVertex, selectEdge, selectHex, setSelectionAction, clearSelection } = useGameStore();
  const { sendAction } = useSocket();

  const colorMap: Record<string, string> = {
    red: '#b01818',
    blue: '#1848a0',
    green: '#2a5e3a',
    orange: '#c85a10',
    white: '#e8e0d0'
  };

  const getPlayerColor = (pId: string) => {
    const p = gameState?.players.find(pl => pl.id === pId);
    if (!p) return '#ffffff';
    return colorMap[p.color.toLowerCase()] || p.color;
  };

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [dimensions, setDimensions] = useState({ width: 700, height: 600 });
  const [hoveredNode, setHoveredNode] = useState<{ type: 'vertex' | 'edge' | 'hex'; id: string } | null>(null);

  // Board constants (match server values)
  const S = 100;
  const W = Math.sqrt(3) * S;

  // Handle resizing
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight || 550
        });
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Setup Phase auto-selection effect
  useEffect(() => {
    if (!gameState || !playerId) return;
    const activePlayerId = getActivePlayerId(gameState);
    const isMyTurn = playerId === activePlayerId;
    const isSetup = gameState.phase === 'setup';

    if (isSetup && isMyTurn) {
      const orderLen = gameState.turnOrder.length;
      const idx = gameState.currentPlayerIndex;
      const round = idx < orderLen ? 1 : 2;
      const playerBuildings = gameState.vertices.filter(v => v.building && v.building.playerId === playerId);
      const playerRoads = gameState.edges.filter(e => e.road && e.road.playerId === playerId);

      if (round === 1) {
        if (playerBuildings.length === 0) {
          if (selection.actionType !== 'build_settlement') {
            setSelectionAction('build_settlement');
          }
        } else if (playerRoads.length === 0) {
          if (selection.actionType !== 'build_road') {
            setSelectionAction('build_road');
          }
        } else {
          if (selection.actionType !== 'none') {
            clearSelection();
          }
        }
      } else { // round === 2
        if (playerBuildings.length === 1) {
          if (selection.actionType !== 'build_city') {
            setSelectionAction('build_city');
          }
        } else if (playerRoads.length === 1) {
          if (selection.actionType !== 'build_road') {
            setSelectionAction('build_road');
          }
        } else {
          if (selection.actionType !== 'none') {
            clearSelection();
          }
        }
      }
    } else if (isSetup && !isMyTurn) {
      if (selection.actionType !== 'none') {
        clearSelection();
      }
    }
  }, [gameState, playerId, selection.actionType, setSelectionAction, clearSelection]);

  if (!gameState || !playerId) {
    return (
      <div className="w-full h-full flex items-center justify-center text-slate-500 italic">
        Loading board...
      </div>
    );
  }

  const { hexTiles, vertices, edges, knights, merchant } = gameState;
  const player = gameState.players.find(p => p.id === playerId);
  const activePlayerId = getActivePlayerId(gameState);
  const isMyTurn = playerId === activePlayerId;

  // Coordinates translation & scaling
  const getTransforms = () => {
    const tx = dimensions.width / 2;
    const ty = dimensions.height / 2;
    // Scale down to fit standard Catan radius-3 board (approx 1000x900 in raw coords)
    const scale = Math.min(dimensions.width / 1000, dimensions.height / 900, 0.85);
    return { tx, ty, scale };
  };

  // Convert canvas pixel back to board coordinate
  const canvasToBoard = (mx: number, my: number) => {
    const { tx, ty, scale } = getTransforms();
    return {
      x: (mx - tx) / scale,
      y: (my - ty) / scale
    };
  };

  // Convert board coordinate to canvas pixel
  const boardToCanvas = (bx: number, by: number) => {
    const { tx, ty, scale } = getTransforms();
    return {
      x: tx + bx * scale,
      y: ty + by * scale
    };
  };

  const getHexCenter = (hex: HexTile) => {
    return {
      x: S * Math.sqrt(3) * (hex.q + hex.r / 2),
      y: S * 1.5 * hex.r
    };
  };

  // Distance from point (x,y) to line segment (x1,y1) -> (x2,y2)
  const getDistToSegment = (x: number, y: number, x1: number, y1: number, x2: number, y2: number) => {
    const A = x - x1;
    const B = y - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    if (lenSq !== 0) param = dot / lenSq;

    let xx, yy;

    if (param < 0) {
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      xx = x2;
      yy = y2;
    } else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }

    const dx = x - xx;
    const dy = y - yy;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Click & Hover detectors
  const findClosestNode = (mx: number, my: number) => {
    const { x, y } = canvasToBoard(mx, my);

    // 1. Check vertices first (radius 18 in coordinate space)
    for (const v of vertices) {
      const dist = Math.sqrt((v.q - x) ** 2 + (v.r - y) ** 2);
      if (dist <= 25) {
        return { type: 'vertex' as const, id: v.id };
      }
    }

    // 2. Check edges (line segment distance <= 15)
    for (const e of edges) {
      const vA = vertices.find(v => v.id === e.adjacentVertexIds[0])!;
      const vB = vertices.find(v => v.id === e.adjacentVertexIds[1])!;
      const dist = getDistToSegment(x, y, vA.q, vA.r, vB.q, vB.r);
      if (dist <= 18) {
        return { type: 'edge' as const, id: e.id };
      }
    }

    // 3. Check hex centers (radius <= 85)
    for (const h of hexTiles) {
      const hc = getHexCenter(h);
      const dist = Math.sqrt((hc.x - x) ** 2 + (hc.y - y) ** 2);
      if (dist <= 85) {
        return { type: 'hex' as const, id: h.id };
      }
    }

    return null;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const closest = findClosestNode(mx, my);
    setHoveredNode(closest);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!hoveredNode) return;

    const { type, id } = hoveredNode;
    const { actionType } = selection;

    // Route actions based on active selection mode
    if (type === 'vertex') {
      selectVertex(id);
      if (actionType === 'build_settlement') {
        sendAction({ type: 'BUILD', buildType: 'settlement', targetId: id });
      } else if (actionType === 'build_city') {
        sendAction({ type: 'BUILD', buildType: 'city', targetId: id });
      } else if (actionType === 'build_city_wall') {
        sendAction({ type: 'BUILD', buildType: 'city_wall', targetId: id });
      } else if (actionType === 'recruit_knight') {
        sendAction({ type: 'RECRUIT_KNIGHT', vertexId: id });
      } else if (actionType === 'upgrade_knight') {
        // Find knight on this vertex
        const kn = knights.find(k => k.vertexId === id);
        if (kn) {
          if (kn.level === 2 && gameState.players.find(p => p.id === playerId)?.cityImprovements.yellow < 3) {
            alert("Requires Politics Level 3 to promote to Mighty Knight!");
            return;
          }
          sendAction({ type: 'UPGRADE_KNIGHT', knightId: kn.id });
        }
      } else if (actionType === 'activate_knight') {
        const kn = knights.find(k => k.vertexId === id);
        if (kn) {
          sendAction({ type: 'ACTIVATE_KNIGHT', knightId: kn.id });
        }
      } else if (actionType === 'move_knight') {
        if (selection.vertexId) {
          // Vertex previously selected contains knight to move
          const kn = knights.find(k => k.vertexId === selection.vertexId);
          if (kn) {
            sendAction({ type: 'MOVE_KNIGHT', knightId: kn.id, targetVertexId: id });
          }
        }
      } else if (actionType === 'displace_knight') {
        if (selection.vertexId) {
          const kn = knights.find(k => k.vertexId === selection.vertexId);
          const targetKn = knights.find(k => k.vertexId === id);
          if (kn && targetKn) {
            if (kn.level <= targetKn.level) {
              alert("Displacing knight must be strictly stronger than the target knight!");
              return;
            }
            sendAction({ type: 'USE_KNIGHT_ACTION', knightId: kn.id, actionType: 'displace', targetId: id });
          }
        }
      } else if (actionType === 'break_road') {
        if (selection.vertexId) {
          const kn = knights.find(k => k.vertexId === selection.vertexId);
          if (kn) {
            sendAction({ type: 'USE_KNIGHT_ACTION', knightId: kn.id, actionType: 'break_road', targetId: id });
          }
        }
      } else if (actionType === 'deserter_select') {
        // Deserter progress card: first select enemy knight vertex, then select vacant place vertex
        if (!selection.tempSelections.enemyKnightId) {
          const targetKn = knights.find(k => k.vertexId === id && k.playerId !== playerId);
          if (targetKn) {
            useGameStore.getState().setTempSelection('enemyKnightId', targetKn.id);
            useGameStore.getState().setTempSelection('targetPlayerId', targetKn.playerId);
            alert('Enemy knight selected. Now click a vacant vertex connected to your roads to place it.');
          }
        } else {
          sendAction({
            type: 'PLAY_PROGRESS_CARD',
            cardId: selection.cardId,
            params: {
              knightId: selection.tempSelections.enemyKnightId,
              targetPlayerId: selection.tempSelections.targetPlayerId,
              vertexId: id
            }
          });
        }
      }
    } else if (type === 'edge') {
      selectEdge(id);
      if (actionType === 'build_road') {
        sendAction({ type: 'BUILD', buildType: 'road', targetId: id });
      } else if (actionType === 'diplomat_select') {
        sendAction({ type: 'PLAY_PROGRESS_CARD', cardId: selection.cardId, params: { edgeId: id } });
      }
    } else if (type === 'hex') {
      selectHex(id);
      if (gameState.pendingRobberMove) {
        sendAction({ type: 'MOVE_ROBBER', hexId: id });
      } else if (actionType === 'chase_robber') {
        if (selection.vertexId) {
          const kn = knights.find(k => k.vertexId === selection.vertexId);
          if (kn) {
            sendAction({ type: 'USE_KNIGHT_ACTION', knightId: kn.id, actionType: 'chase_robber', targetId: id });
          }
        }
      } else if (actionType === 'inventor_select') {
        // Inventor progress card: select 2 land hexes
        if (!selection.tempSelections.hexIdA) {
          useGameStore.getState().setTempSelection('hexIdA', id);
          alert('First hex selected. Select second hex to swap numbers.');
        } else {
          sendAction({
            type: 'PLAY_PROGRESS_CARD',
            cardId: selection.cardId,
            params: {
              hexIdA: selection.tempSelections.hexIdA,
              hexIdB: id
            }
          });
        }
      }
    }
  };

  // Canvas drawing loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, dimensions.width, dimensions.height);

    const { scale } = getTransforms();

    // 1. Draw Sea and Land Hexes
    for (const hex of hexTiles) {
      const { x: cx, y: cy } = getHexCenter(hex);
      const canvasCenter = boardToCanvas(cx, cy);

      ctx.save();
      ctx.beginPath();
      // Draw pointy-topped hexagon path
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 180) * (60 * i - 30);
        const vx = canvasCenter.x + S * scale * Math.cos(angle);
        const vy = canvasCenter.y + S * scale * Math.sin(angle);
        if (i === 0) ctx.moveTo(vx, vy);
        else ctx.lineTo(vx, vy);
      }
      ctx.closePath();

      // Hex terrain colors matching FIX 4 specs
      let fillStyle: any;
      if (hex.terrain === 'forest') {
        fillStyle = '#1e5e1e';
      } else if (hex.terrain === 'pasture') {
        fillStyle = '#5aaa30';
      } else if (hex.terrain === 'fields') {
        fillStyle = '#d4a020';
      } else if (hex.terrain === 'hills') {
        fillStyle = '#c44e20';
      } else if (hex.terrain === 'mountains') {
        fillStyle = '#7a7a8a';
      } else if (hex.terrain === 'desert') {
        fillStyle = '#d4c090';
      } else {
        // Sea hexes: deep dark blue gradient
        let gradient = ctx.createRadialGradient(canvasCenter.x, canvasCenter.y, 10, canvasCenter.x, canvasCenter.y, S * scale);
        gradient.addColorStop(0, '#1a3a5a');
        gradient.addColorStop(1, '#0d1f33');
        fillStyle = gradient;
      }

      ctx.fillStyle = fillStyle;
      ctx.fill();

      // Border lines
      ctx.lineWidth = 1;
      if (hex.terrain === 'sea') {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.stroke();
      } else {
        ctx.strokeStyle = 'rgba(0,0,0,0.4)';
        ctx.stroke();
      }

      // Highlight if hovered hex selection
      const isHoveredHex = hoveredNode?.type === 'hex' && hoveredNode.id === hex.id;
      const isSelectedHex = selection.hexId === hex.id || selection.tempSelections.hexIdA === hex.id;
      if (isHoveredHex || isSelectedHex) {
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#6366f1';
        ctx.stroke();
      }

      ctx.restore();

      // Draw Number Tokens (only for land, excluding Desert)
      if (hex.terrain !== 'sea' && hex.terrain !== 'desert' && hex.number !== null) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(canvasCenter.x, canvasCenter.y, 16 * scale, 0, 2 * Math.PI);
        ctx.fillStyle = '#f8f9fa';
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 8 * scale;
        ctx.fill();

        ctx.strokeStyle = '#212529';
        ctx.lineWidth = 1.5 * scale;
        ctx.shadowBlur = 0; // reset shadow for stroke
        ctx.stroke();

        // Draw Token Number text
        ctx.fillStyle = (hex.number === 6 || hex.number === 8) ? '#e63946' : '#212529';
        ctx.font = `bold ${16 * scale}px Outfit, Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(hex.number.toString(), canvasCenter.x, canvasCenter.y - 2 * scale);

        // Pip dots (representing probability)
        const pipsCount: Record<number, number> = {
          2: 1, 12: 1, 3: 2, 11: 2, 4: 3, 10: 3, 5: 4, 9: 4, 6: 5, 8: 5
        };
        const pips = pipsCount[hex.number] || 0;
        const pipRadius = 1.5 * scale;
        const pipSpacing = 3 * scale;
        const pipY = canvasCenter.y + 8 * scale;

        ctx.fillStyle = (hex.number === 6 || hex.number === 8) ? '#e63946' : '#212529';
        for (let p = 0; p < pips; p++) {
          const pipX = canvasCenter.x + (p - (pips - 1) / 2) * pipSpacing;
          ctx.beginPath();
          ctx.arc(pipX, pipY, pipRadius, 0, 2 * Math.PI);
          ctx.fill();
        }
        ctx.restore();
      }

      // Draw Robber
      if (hex.hasRobber) {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.beginPath();
        ctx.arc(canvasCenter.x, canvasCenter.y, 12 * scale, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2 * scale;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${10 * scale}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('THIEF', canvasCenter.x, canvasCenter.y);
        ctx.restore();
      }

      // Draw Merchant
      if (merchant.hexId === hex.id) {
        const mPlayerColor = getPlayerColor(merchant.playerId);
        ctx.save();
        ctx.fillStyle = mPlayerColor;
        ctx.beginPath();
        ctx.arc(canvasCenter.x - 22 * scale, canvasCenter.y - 22 * scale, 10 * scale, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5 * scale;
        ctx.stroke();

        ctx.fillStyle = '#1a1208';
        ctx.font = `bold ${9 * scale}px Cinzel, serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('M', canvasCenter.x - 22 * scale, canvasCenter.y - 22 * scale);
        
        // Floating 2:1 label above the merchant in gold Cinzel
        ctx.fillStyle = '#e8b84b';
        ctx.font = `bold ${10 * scale}px Cinzel, serif`;
        ctx.fillText('2:1', canvasCenter.x - 22 * scale, canvasCenter.y - 36 * scale);
        ctx.restore();
      }
    }

    // 2. Draw Edges (Roads)
    for (const edge of edges) {
      const vNodeA = vertices.find(v => v.id === edge.adjacentVertexIds[0])!;
      const vNodeB = vertices.find(v => v.id === edge.adjacentVertexIds[1])!;

      const posA = boardToCanvas(vNodeA.q, vNodeA.r);
      const posB = boardToCanvas(vNodeB.q, vNodeB.r);

      const isHoveredEdge = hoveredNode?.type === 'edge' && hoveredNode.id === edge.id;
      const isSelectedEdge = selection.edgeId === edge.id;

      if (edge.road) {
        const roadColor = getPlayerColor(edge.road.playerId);
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(posA.x, posA.y);
        ctx.lineTo(posB.x, posB.y);
        ctx.lineWidth = 7 * scale;
        ctx.strokeStyle = roadColor;
        ctx.lineCap = 'round';
        // Stroke shadow
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 4 * scale;
        ctx.stroke();

        // Stroke dark borders
        ctx.shadowBlur = 0;
        ctx.lineWidth = 1.5 * scale;
        ctx.strokeStyle = '#020617';
        ctx.stroke();
        ctx.restore();
      } else if (isHoveredEdge || isSelectedEdge) {
        // Draw highlighted hovered road placement
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(posA.x, posA.y);
        ctx.lineTo(posB.x, posB.y);
        ctx.lineWidth = 6 * scale;
        ctx.strokeStyle = selection.actionType !== 'none' ? getPlayerColor(playerId) : 'rgba(255,255,255,0.4)';
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.restore();
      }
    }

    // 2.5 Group and Draw Coastal Ports - FIX 3
    const harborPairs: { type: string; vA: Vertex; vB: Vertex }[] = [];
    const visitedHarbors = new Set<string>();
    for (const v of vertices) {
      if (v.harbor && !visitedHarbors.has(v.id)) {
        const partner = vertices.find(v2 => 
          v.adjacentVertexIds.includes(v2.id) && 
          v2.harbor === v.harbor && 
          !visitedHarbors.has(v2.id)
        );
        if (partner) {
          visitedHarbors.add(v.id);
          visitedHarbors.add(partner.id);
          harborPairs.push({ type: v.harbor, vA: v, vB: partner });
        }
      }
    }

    for (const pair of harborPairs) {
      const { type, vA, vB } = pair;
      const midX = (vA.q + vB.q) / 2;
      const midY = (vA.r + vB.r) / 2;

      const seaHex = hexTiles.find(h => 
        h.terrain === 'sea' && 
        vA.adjacentHexIds.includes(h.id) && 
        vB.adjacentHexIds.includes(h.id)
      );

      const sc = seaHex ? getHexCenter(seaHex) : { x: 0, y: 0 };
      const seaX = seaHex ? sc.x : 0;
      const seaY = seaHex ? sc.y : 0;

      const dx = seaX - midX;
      const dy = seaY - midY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const dirX = dist > 0 ? dx / dist : 0;
      const dirY = dist > 0 ? dy / dist : 0;

      const tokenBoardX = midX + dirX * 35;
      const tokenBoardY = midY + dirY * 35;

      const tokenPos = boardToCanvas(tokenBoardX, tokenBoardY);
      const posA = boardToCanvas(vA.q, vA.r);
      const posB = boardToCanvas(vB.q, vB.r);

      // Connecting lines to the two intersections it covers
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(tokenPos.x, tokenPos.y);
      ctx.lineTo(posA.x, posA.y);
      ctx.moveTo(tokenPos.x, tokenPos.y);
      ctx.lineTo(posB.x, posB.y);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 1.2 * scale;
      ctx.stroke();
      ctx.restore();

      // Rounded rectangle token
      ctx.save();
      const rw = 50 * scale;
      const rh = 30 * scale;

      let bgColor = '#4a2e12';
      let rateText = '3:1';
      if (type === '2:1_lumber') { bgColor = '#1e5e1e'; rateText = '2:1 🪵'; }
      else if (type === '2:1_brick') { bgColor = '#c44e20'; rateText = '2:1 🧱'; }
      else if (type === '2:1_wool') { bgColor = '#5aaa30'; rateText = '2:1 🐑'; }
      else if (type === '2:1_grain') { bgColor = '#d4a020'; rateText = '2:1 🌾'; }
      else if (type === '2:1_ore') { bgColor = '#7a7a8a'; rateText = '2:1 🪨'; }

      ctx.fillStyle = bgColor;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(tokenPos.x - rw / 2, tokenPos.y - rh / 2, rw, rh, 4 * scale);
      } else {
        ctx.rect(tokenPos.x - rw / 2, tokenPos.y - rh / 2, rw, rh);
      }
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1 * scale;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.max(12, 12 * scale)}px Outfit, Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(rateText, tokenPos.x, tokenPos.y);
      ctx.restore();
    }

    // 3. Draw Vertices (Settlements, Cities, Metropolises & Knights)
    for (const v of vertices) {
      const pos = boardToCanvas(v.q, v.r);
      const isHoveredVertex = hoveredNode?.type === 'vertex' && hoveredNode.id === v.id;
      const isSelectedVertex = selection.vertexId === v.id || selection.tempSelections.enemyKnightId === v.id;

      // Draw Buildings
      if (v.building) {
        const bColor = getPlayerColor(v.building.playerId);
        ctx.save();

        ctx.fillStyle = bColor;
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1.5 * scale;
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 6 * scale;

        if (v.building.type === 'settlement') {
          // Draw small house shape
          ctx.beginPath();
          ctx.moveTo(pos.x, pos.y - 8 * scale);
          ctx.lineTo(pos.x + 8 * scale, pos.y - 2 * scale);
          ctx.lineTo(pos.x + 8 * scale, pos.y + 7 * scale);
          ctx.lineTo(pos.x - 8 * scale, pos.y + 7 * scale);
          ctx.lineTo(pos.x - 8 * scale, pos.y - 2 * scale);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        } else if (v.building.type === 'city') {
          // Draw double-tower fortress shape
          ctx.beginPath();
          ctx.moveTo(pos.x - 10 * scale, pos.y - 10 * scale);
          ctx.lineTo(pos.x - 4 * scale, pos.y - 10 * scale);
          ctx.lineTo(pos.x - 4 * scale, pos.y - 4 * scale);
          ctx.lineTo(pos.x + 4 * scale, pos.y - 4 * scale);
          ctx.lineTo(pos.x + 4 * scale, pos.y - 10 * scale);
          ctx.lineTo(pos.x + 10 * scale, pos.y - 10 * scale);
          ctx.lineTo(pos.x + 10 * scale, pos.y + 8 * scale);
          ctx.lineTo(pos.x - 10 * scale, pos.y + 8 * scale);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        } else if (v.building.type === 'metropolis') {
          // Metropolis: large castle shape with gold crown
          ctx.beginPath();
          ctx.moveTo(pos.x - 12 * scale, pos.y - 12 * scale);
          ctx.lineTo(pos.x - 6 * scale, pos.y - 12 * scale);
          ctx.lineTo(pos.x - 6 * scale, pos.y - 6 * scale);
          ctx.lineTo(pos.x + 6 * scale, pos.y - 6 * scale);
          ctx.lineTo(pos.x + 6 * scale, pos.y - 12 * scale);
          ctx.lineTo(pos.x + 12 * scale, pos.y - 12 * scale);
          ctx.lineTo(pos.x + 12 * scale, pos.y + 10 * scale);
          ctx.lineTo(pos.x - 12 * scale, pos.y + 10 * scale);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Crown highlight border
          ctx.strokeStyle = '#c8922a'; // primary gold
          ctx.lineWidth = 2 * scale;
          ctx.stroke();

          // Distinctive metropolis circle arch overlay badge (arch / M circle)
          ctx.save();
          ctx.beginPath();
          ctx.arc(pos.x + 10 * scale, pos.y - 10 * scale, 8 * scale, 0, 2 * Math.PI);
          ctx.fillStyle = '#c8922a';
          ctx.fill();
          ctx.strokeStyle = '#e8b84b';
          ctx.lineWidth = 1 * scale;
          ctx.stroke();

          ctx.fillStyle = '#1a1208';
          ctx.font = `bold ${9 * scale}px Cinzel, serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('M', pos.x + 10 * scale, pos.y - 9 * scale);
          ctx.restore();
        }

        // Draw City Wall brick badge under building: small 8x8px badge in var(--border-copper)
        if (v.building.hasWall) {
          ctx.save();
          ctx.fillStyle = '#8b5e2a'; // var(--border-copper)
          ctx.strokeStyle = '#3d2810'; // var(--border-dark)
          ctx.lineWidth = 0.8 * scale;
          const bx = pos.x;
          const by = pos.y + 10 * scale; // bottom-center of building
          ctx.beginPath();
          // Draw small 8x8 square centered
          ctx.rect(bx - 4 * scale, by - 4 * scale, 8 * scale, 8 * scale);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }

        ctx.restore();
      }

      // Draw Knights
      const kn = knights.find(k => k.vertexId === v.id);
      if (kn) {
        const knColor = getPlayerColor(kn.playerId);
        ctx.save();
        
        // Translate to piece center for rotation transforms
        ctx.translate(pos.x, pos.y);
        
        // Active vs Inactive state
        if (!kn.isActive) {
          ctx.rotate(Math.PI / 2); // Rotated 90 degrees flat for inactive knights
          ctx.globalAlpha = 0.7; // Inactive knight opacity: 0.7
        } else {
          // Active knight: subtle drop-shadow gold-dim glow
          ctx.shadowColor = '#7a5a1a'; // var(--gold-dim)
          ctx.shadowBlur = 6 * scale;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
        }

        // Standing/lying flat capsule shape
        ctx.beginPath();
        const kw = 8 * scale;
        const kh = 14 * scale;
        if (ctx.roundRect) {
          ctx.roundRect(-kw, -kh, kw * 2, kh * 2, 5 * scale);
        } else {
          ctx.rect(-kw, -kh, kw * 2, kh * 2);
        }
        ctx.fillStyle = knColor;
        ctx.fill();

        ctx.strokeStyle = '#3d2810'; // var(--border-dark)
        ctx.lineWidth = 1.5 * scale;
        ctx.stroke();

        // Print level text inside the knight
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${9 * scale}px Cinzel, serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = '#000000';
        ctx.shadowBlur = 3;
        ctx.fillText(`K${kn.level}`, 0, 0);

        ctx.restore();
      }

      // Draw click targets for construction actions
      if (selection.actionType !== 'none') {
        const isActionVertex = [
          'build_settlement', 'build_city', 'build_city_wall',
          'recruit_knight', 'upgrade_knight', 'activate_knight',
          'move_knight', 'displace_knight', 'break_road',
          'deserter_select'
        ].includes(selection.actionType);

        if (isActionVertex) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, (isHoveredVertex || isSelectedVertex ? 9 : 4) * scale, 0, 2 * Math.PI);
          ctx.fillStyle = isHoveredVertex || isSelectedVertex ? '#6366f1' : 'rgba(99, 102, 241, 0.4)';
          ctx.fill();
          if (isHoveredVertex || isSelectedVertex) {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1 * scale;
            ctx.stroke();
          }
          ctx.restore();
        }
      }
    }
  }, [dimensions, hexTiles, vertices, edges, knights, merchant, hoveredNode, selection]);

  return (
    <div ref={containerRef} className="w-full h-full relative flex items-center justify-center overflow-hidden">
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        onMouseMove={handleMouseMove}
        onClick={handleCanvasClick}
        className="cursor-crosshair transition-all duration-300 border-2 border-[var(--border-copper)] bg-[#0d1f33] rounded-[12px] shadow-inner max-w-full max-h-full"
      />
    </div>
  );
};
