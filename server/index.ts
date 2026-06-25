import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { createInitialState, processAction } from './gameEngine.js';
import { GameState } from '../shared/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Serve client static files in production
const clientBuildPath = path.join(__dirname, '../client/dist');
app.use(express.static(clientBuildPath));
app.get('*', (req, res) => {
  res.sendFile(path.join(clientBuildPath, 'index.html'));
});

interface Room {
  id: string;
  players: { id: string; name: string; color: string; socketId: string; connected?: boolean }[];
  gameStarted: boolean;
  gameState: GameState | null;
}

// In-memory rooms database
const rooms: Map<string, Room> = new Map();

// Helper to find a room by code
function getRoomBySocket(socketId: string): Room | null {
  for (const room of rooms.values()) {
    if (room.players.some(p => p.socketId === socketId)) {
      return room;
    }
  }
  return null;
}

io.on('connection', (socket: Socket) => {
  console.log(`User connected: ${socket.id}`);

  // 1. Join or Create Room
  socket.on('JOIN_ROOM', ({ roomId, name, color }: { roomId: string; name: string; color: string }) => {
    let room = rooms.get(roomId);
    if (!room) {
      room = {
        id: roomId,
        players: [],
        gameStarted: false,
        gameState: null
      };
      rooms.set(roomId, room);
    }

    if (room.gameStarted) {
      // Reconnect check
      const existingPlayer = room.players.find(p => p.name.toLowerCase() === name.toLowerCase());
      if (existingPlayer) {
        existingPlayer.socketId = socket.id;
        existingPlayer.connected = true;
        socket.join(roomId);
        console.log(`Player ${name} reconnected to room ${roomId}`);

        if (room.gameState) {
          const allConnected = room.players.every(p => p.connected !== false);
          if (allConnected) {
            room.gameState.isPaused = false;
            room.gameState.log.push(`✅ Game resumed. All players connected.`);
          } else {
            room.gameState.log.push(`ℹ️ Player ${name} reconnected, waiting for others.`);
          }
        }

        io.to(roomId).emit('STATE_UPDATE', { gameState: room.gameState });
        return;
      } else {
        socket.emit('ERROR', { message: 'Game has already started in this room.' });
        return;
      }
    }

    // Check if color or name is already taken
    if (room.players.some(p => p.color === color)) {
      socket.emit('ERROR', { message: 'Color is already taken.' });
      return;
    }
    if (room.players.some(p => p.name.toLowerCase() === name.toLowerCase())) {
      socket.emit('ERROR', { message: 'Name is already taken.' });
      return;
    }

    // Limit to 4 players
    if (room.players.length >= 4) {
      socket.emit('ERROR', { message: 'Lobby is full (max 4 players).' });
      return;
    }

    const newPlayer = { id: `player_${Math.random().toString(36).substring(2, 7)}`, name, color, socketId: socket.id, connected: true };
    room.players.push(newPlayer);
    socket.join(roomId);

    console.log(`${name} (${color}) joined room ${roomId}`);

    // Broadcast updated player list in lobby
    io.to(roomId).emit('LOBBY_UPDATE', {
      players: room.players.map(p => ({ id: p.id, name: p.name, color: p.color })),
      gameStarted: false
    });
  });

  // 2. Start Game
  socket.on('START_GAME', ({ roomId }: { roomId: string }) => {
    const room = rooms.get(roomId);
    if (!room) {
      socket.emit('ERROR', { message: 'Room not found.' });
      return;
    }
    if (room.players.length < 3) {
      socket.emit('ERROR', { message: 'Need at least 3 players to start Catan: Cities & Knights.' });
      return;
    }

    try {
      const playersConfig = room.players.map(p => ({ id: p.id, name: p.name, color: p.color }));
      room.gameState = createInitialState(playersConfig, true); // can set randomBoard based on player choice
      room.gameStarted = true;

      console.log(`Starting game in room ${roomId}`);
      io.to(roomId).emit('STATE_UPDATE', { gameState: room.gameState });
    } catch (err: any) {
      socket.emit('ERROR', { message: err.message || 'Failed to start game.' });
    }
  });

  // 2.5 Stop Game
  socket.on('STOP_GAME', ({ roomId }: { roomId: string }) => {
    const room = rooms.get(roomId);
    if (!room) {
      socket.emit('ERROR', { message: 'Room not found.' });
      return;
    }

    console.log(`Stopping game in room ${roomId}`);
    room.gameStarted = false;
    room.gameState = null;

    // Reset player connection status
    for (const p of room.players) {
      p.connected = true;
    }

    io.to(roomId).emit('GAME_STOPPED');
    io.to(roomId).emit('LOBBY_UPDATE', {
      players: room.players.map(p => ({ id: p.id, name: p.name, color: p.color })),
      gameStarted: false
    });
  });

  // 3. Process Game Action
  socket.on('GAME_ACTION', ({ roomId, action }: { roomId: string; action: any }) => {
    const room = rooms.get(roomId);
    if (!room || !room.gameState) {
      socket.emit('ERROR', { message: 'Room or active game not found.' });
      return;
    }

    // Identify player ID by socket.id
    const player = room.players.find(p => p.socketId === socket.id);
    if (!player) {
      socket.emit('ERROR', { message: 'Player is not in this room.' });
      return;
    }

    try {
      const oldPhase = room.gameState.phase;
      // Mutate state with action
      const nextState = processAction(room.gameState, action, player.id);
      room.gameState = nextState;

      // Broadcast update
      io.to(roomId).emit('STATE_UPDATE', { gameState: room.gameState });

      // Special alert transmissions
      if (oldPhase !== nextState.phase && nextState.phase === 'barbarian_attack') {
        io.to(roomId).emit('BARBARIAN_ATTACK_ALERT', {
          pendingDowngrades: nextState.pendingDowngrades
        });
      }
    } catch (err: any) {
      console.error(`Action error in room ${roomId} by ${player.name}:`, err.message);
      socket.emit('ERROR', { message: err.message || 'Invalid Action.' });
    }
  });

  // 4. Disconnect Handling
  socket.on('disconnect', () => {
    const room = getRoomBySocket(socket.id);
    if (room) {
      const player = room.players.find(p => p.socketId === socket.id);
      if (player) {
        console.log(`User disconnected: ${player.name} from room ${room.id}`);
        // If game has not started, remove player
        if (!room.gameStarted) {
          room.players = room.players.filter(p => p.socketId !== socket.id);
          io.to(room.id).emit('LOBBY_UPDATE', {
            players: room.players.map(p => ({ id: p.id, name: p.name, color: p.color })),
            gameStarted: false
          });
        } else {
          // Game has started! Mark player as disconnected and pause
          player.connected = false;
          if (room.gameState) {
            room.gameState.isPaused = true;
            room.gameState.log.push(`⚠️ Game paused. ${player.name} disconnected.`);
            io.to(room.id).emit('STATE_UPDATE', { gameState: room.gameState });
          }
        }
      }
    }
  });
});

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
