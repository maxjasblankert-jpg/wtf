import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useGameStore } from '../store/gameStore';

// Determine Socket server URL based on window.location
// In dev, it runs on port 4000. In production, it's hosted from the same host.
const SOCKET_URL = window.location.hostname === 'localhost' ? 'http://localhost:4000' : window.location.origin;

let socket: Socket | null = null;

export function useSocket() {
  const {
    setConnected,
    setGameState,
    setLobbyPlayers,
    setLobbyStatus,
    joinedRoomId,
    playerName,
    playerColor,
    playerId
  } = useGameStore();

  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!socket) {
      socket = io(SOCKET_URL, {
        autoConnect: true,
        reconnection: true
      });
    }

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to game server.');
      setConnected(true);

      // Rejoin room if we have the info (for reconnects)
      if (joinedRoomId && joinedRoomId !== 'local-game' && playerName && playerColor) {
        const localState = useGameStore.getState().gameState;
        socket?.emit('JOIN_ROOM', { 
          roomId: joinedRoomId, 
          name: playerName, 
          color: playerColor,
          clientGameState: localState 
        });
      }
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from game server.');
      setConnected(false);
    });

    socket.on('LOBBY_UPDATE', ({ players }: { players: any[] }) => {
      if (useGameStore.getState().localMode) return;
      setLobbyPlayers(players);
      setLobbyStatus(true);
    });

    socket.on('STATE_UPDATE', ({ gameState }) => {
      if (useGameStore.getState().localMode) return;
      setGameState(gameState);
      setLobbyStatus(false);
    });

    socket.on('GAME_STOPPED', () => {
      setGameState(null);
      setLobbyStatus(true);
    });

    socket.on('ERROR', ({ message }: { message: string }) => {
      alert(`⚠️ ERROR: ${message}`);
    });

    return () => {
      socket?.off('connect');
      socket?.off('disconnect');
      socket?.off('LOBBY_UPDATE');
      socket?.off('STATE_UPDATE');
      socket?.off('GAME_STOPPED');
      socket?.off('ERROR');
    };
  }, [joinedRoomId, playerName, playerColor]);

  const joinRoom = (roomId: string, name: string, color: string) => {
    const generatedPlayerId = `p_${Math.random().toString(36).substring(2, 7)}`;
    useGameStore.getState().setRoomInfo(roomId, name, color, generatedPlayerId);
    socketRef.current?.emit('JOIN_ROOM', { roomId, name, color });
  };

  const startGame = () => {
    if (joinedRoomId) {
      socketRef.current?.emit('START_GAME', { roomId: joinedRoomId });
    }
  };

  const sendAction = (action: any) => {
    const storeState = useGameStore.getState();
    if (storeState.localMode) {
      storeState.applyLocalAction(action, storeState.playerId || 'player_human');
    } else if (joinedRoomId) {
      socketRef.current?.emit('GAME_ACTION', { roomId: joinedRoomId, action });
    }
  };

  const stopGame = () => {
    const storeState = useGameStore.getState();
    if (storeState.localMode) {
      useGameStore.setState({
        gameState: null,
        isLobby: true,
        localMode: false,
        joinedRoomId: null
      });
    } else if (joinedRoomId) {
      socketRef.current?.emit('STOP_GAME', { roomId: joinedRoomId });
    }
  };

  return {
    socket: socketRef.current,
    joinRoom,
    startGame,
    sendAction,
    stopGame
  };
}
