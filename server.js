'use strict';

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const gameLogic = require('./gameLogic');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Serve static files from ./public
app.use(express.static(path.join(__dirname, 'public')));

// In-memory rooms map
// Structure: Map<roomId, { id, hostId, gameState, settings, players }>
// players: Map<socketId, { id, name, isHost }>
const rooms = new Map();

// Generate a 6-char uppercase alphanumeric room ID
function generateRoomId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = '';
  for (let i = 0; i < 6; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

// Generate a unique room ID that doesn't collide with existing rooms
function uniqueRoomId() {
  let id;
  do {
    id = generateRoomId();
  } while (rooms.has(id));
  return id;
}

// Build a public player list from the room's players map
function buildPlayerList(room) {
  return Array.from(room.players.values()).map(p => ({
    id: p.id,
    name: p.name,
    isHost: p.id === room.hostId,
  }));
}

// Strip private data from game state to produce PublicGameState
function buildPublicState(gameState) {
  return {
    phase: gameState.phase,
    currentPlayerIndex: gameState.currentPlayerIndex,
    turnPhase: gameState.turnPhase,
    deckSize: gameState.deck ? gameState.deck.length : 0,
    discardTop: gameState.discardPile && gameState.discardPile.length > 0
      ? gameState.discardPile[gameState.discardPile.length - 1]
      : null,
    tableGroups: gameState.tableGroups || [],
    jokerInfo: gameState.jokerInfo || null,
    settings: gameState.settings || null,
    highestOpenValue: gameState.highestOpenValue || 0,
    players: (gameState.players || []).map(p => ({
      id: p.id,
      name: p.name,
      handSize: p.hand ? p.hand.length : 0,
      hasOpened: p.hasOpened || false,
      openValue: p.openValue || 0,
      isHost: p.isHost || false,
    })),
    winnerName: gameState.winnerName || null,
  };
}

// Find which room a socket belongs to
function findRoomForSocket(socketId) {
  for (const [roomId, room] of rooms) {
    if (room.players.has(socketId)) {
      return room;
    }
  }
  return null;
}

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // -------------------------
  // create-room
  // -------------------------
  socket.on('create-room', ({ playerName, settings } = {}, callback) => {
    if (typeof callback !== 'function') return;

    if (!playerName || typeof playerName !== 'string' || !playerName.trim()) {
      return callback({ error: 'Player name is required.' });
    }

    const roomId = uniqueRoomId();
    const room = {
      id: roomId,
      hostId: socket.id,
      gameState: null,
      settings: {
        competitive: !!(settings && settings.competitive),
        teamMode: !!(settings && settings.teamMode),
      },
      players: new Map(),
    };

    room.players.set(socket.id, {
      id: socket.id,
      name: playerName.trim(),
      isHost: true,
    });

    rooms.set(roomId, room);
    socket.join(roomId);

    console.log(`Room created: ${roomId} by ${playerName.trim()} (${socket.id})`);

    callback(null, { roomId, playerId: socket.id });

    // Broadcast updated player list to room
    io.to(roomId).emit('room-update', { players: buildPlayerList(room) });
  });

  // -------------------------
  // join-room
  // -------------------------
  socket.on('join-room', ({ roomId, playerName } = {}, callback) => {
    if (typeof callback !== 'function') return;

    if (!roomId || !playerName || typeof playerName !== 'string' || !playerName.trim()) {
      return callback({ error: 'Room ID and player name are required.' });
    }

    const room = rooms.get(roomId.toUpperCase());
    if (!room) {
      return callback({ error: 'Room not found.' });
    }

    if (room.gameState !== null) {
      return callback({ error: 'Game has already started.' });
    }

    if (room.players.size >= 4) {
      return callback({ error: 'Room is full (max 4 players).' });
    }

    room.players.set(socket.id, {
      id: socket.id,
      name: playerName.trim(),
      isHost: false,
    });

    socket.join(roomId.toUpperCase());

    console.log(`Player ${playerName.trim()} (${socket.id}) joined room ${roomId.toUpperCase()}`);

    callback(null, { success: true });

    // Broadcast updated player list to room
    io.to(room.id).emit('room-update', { players: buildPlayerList(room) });
  });

  // -------------------------
  // start-game
  // -------------------------
  socket.on('start-game', (callback) => {
    const cb = typeof callback === 'function' ? callback : () => {};

    const room = findRoomForSocket(socket.id);
    if (!room) {
      return cb({ error: 'You are not in a room.' });
    }

    if (room.hostId !== socket.id) {
      return cb({ error: 'Only the host can start the game.' });
    }

    const playerCount = room.players.size;
    if (playerCount < 2 || playerCount > 4) {
      return cb({ error: 'Need between 2 and 4 players to start.' });
    }

    if (room.gameState !== null) {
      return cb({ error: 'Game has already started.' });
    }

    const players = Array.from(room.players.values()).map(p => ({
      id: p.id,
      name: p.name,
      isHost: p.id === room.hostId,
    }));

    let gameState;
    try {
      gameState = gameLogic.createInitialGameState(room.id, players, room.settings);
    } catch (err) {
      console.error('Error creating game state:', err);
      return cb({ error: 'Failed to initialize game.' });
    }

    room.gameState = gameState;

    cb(null, { success: true });

    // Emit game-started to each player individually with their private hand + public state
    for (const player of gameState.players) {
      const playerSocket = io.sockets.sockets.get(player.id);
      if (playerSocket) {
        playerSocket.emit('game-started', {
          hand: player.hand,
          publicState: buildPublicState(gameState),
        });
      }
    }

    // Notify the first player it's their turn
    const firstPlayer = gameState.players[gameState.currentPlayerIndex];
    if (firstPlayer) {
      const firstSocket = io.sockets.sockets.get(firstPlayer.id);
      if (firstSocket) {
        firstSocket.emit('your-turn', { mustDraw: true });
      }
    }
  });

  // -------------------------
  // draw-card
  // -------------------------
  socket.on('draw-card', ({ fromDiscard } = {}, callback) => {
    const cb = typeof callback === 'function' ? callback : () => {};

    const room = findRoomForSocket(socket.id);
    if (!room || !room.gameState) {
      return cb({ error: 'No active game found.' });
    }

    const state = room.gameState;
    const currentPlayer = state.players[state.currentPlayerIndex];

    if (!currentPlayer || currentPlayer.id !== socket.id) {
      return cb({ error: 'It is not your turn.' });
    }

    if (state.turnPhase !== 'draw') {
      return cb({ error: 'You cannot draw right now.' });
    }

    let result;
    try {
      result = gameLogic.applyDrawCard(state, socket.id, !!fromDiscard);
    } catch (err) {
      console.error('Error applying draw-card:', err);
      return cb({ error: err.message || 'Failed to draw card.' });
    }

    room.gameState = result.state || state;

    cb(null, { card: result.card });

    // Send updated hand to the drawing player
    const updatedPlayer = room.gameState.players.find(p => p.id === socket.id);
    if (updatedPlayer) {
      socket.emit('hand-update', { hand: updatedPlayer.hand });
    }

    // Broadcast public state to room
    io.to(room.id).emit('state-update', { publicState: buildPublicState(room.gameState) });
  });

  // -------------------------
  // place-melds
  // -------------------------
  socket.on('place-melds', ({ cardIndices, meldIds } = {}, callback) => {
    const cb = typeof callback === 'function' ? callback : () => {};

    const room = findRoomForSocket(socket.id);
    if (!room || !room.gameState) {
      return cb({ error: 'No active game found.' });
    }

    const state = room.gameState;
    const currentPlayer = state.players[state.currentPlayerIndex];

    if (!currentPlayer || currentPlayer.id !== socket.id) {
      return cb({ error: 'It is not your turn.' });
    }

    if (state.turnPhase !== 'act') {
      return cb({ error: 'You cannot place melds right now.' });
    }

    if (!Array.isArray(cardIndices) || !Array.isArray(meldIds)) {
      return cb({ error: 'Invalid meld data.' });
    }

    let result;
    try {
      result = gameLogic.applyPlaceMelds(state, socket.id, cardIndices, meldIds);
    } catch (err) {
      console.error('Error applying place-melds:', err);
      return cb({ error: err.message || 'Failed to place melds.' });
    }

    room.gameState = result.state || state;

    cb(null, {});

    // Send updated hand to acting player
    const updatedPlayer = room.gameState.players.find(p => p.id === socket.id);
    if (updatedPlayer) {
      socket.emit('hand-update', { hand: updatedPlayer.hand });
    }

    // Check for win
    if (result.win) {
      io.to(room.id).emit('game-ended', {
        scores: result.scores,
        winnerName: result.winnerName,
      });
      return;
    }

    // Broadcast public state to room
    io.to(room.id).emit('state-update', { publicState: buildPublicState(room.gameState) });
  });

  // -------------------------
  // discard-card
  // -------------------------
  socket.on('discard-card', ({ cardIndex } = {}, callback) => {
    const cb = typeof callback === 'function' ? callback : () => {};

    const room = findRoomForSocket(socket.id);
    if (!room || !room.gameState) {
      return cb({ error: 'No active game found.' });
    }

    const state = room.gameState;
    const currentPlayer = state.players[state.currentPlayerIndex];

    if (!currentPlayer || currentPlayer.id !== socket.id) {
      return cb({ error: 'It is not your turn.' });
    }

    if (state.turnPhase !== 'act') {
      return cb({ error: 'You cannot discard right now.' });
    }

    if (typeof cardIndex !== 'number' || cardIndex < 0) {
      return cb({ error: 'Invalid card index.' });
    }

    let result;
    try {
      result = gameLogic.applyDiscard(state, socket.id, cardIndex);
    } catch (err) {
      console.error('Error applying discard-card:', err);
      return cb({ error: err.message || 'Failed to discard card.' });
    }

    room.gameState = result.state || state;

    cb(null, {});

    // Always send updated hand to the player who discarded
    const updatedPlayer = room.gameState.players.find(p => p.id === socket.id);
    if (updatedPlayer) {
      socket.emit('hand-update', { hand: updatedPlayer.hand });
    }

    // Check for win
    if (result.win) {
      io.to(room.id).emit('game-ended', {
        scores: result.scores,
        winnerName: result.winnerName,
      });
      return;
    }

    // Advance to next turn
    let nextState;
    try {
      nextState = gameLogic.nextTurn(room.gameState);
    } catch (err) {
      console.error('Error advancing turn:', err);
      nextState = room.gameState;
    }

    room.gameState = nextState;

    // Broadcast public state to room
    io.to(room.id).emit('state-update', { publicState: buildPublicState(room.gameState) });

    // Notify next player it's their turn
    const nextPlayer = room.gameState.players[room.gameState.currentPlayerIndex];
    if (nextPlayer) {
      const nextSocket = io.sockets.sockets.get(nextPlayer.id);
      if (nextSocket) {
        nextSocket.emit('your-turn', { mustDraw: true });
      }
    }
  });

  // -------------------------
  // rejoin-room (page refresh reconnect)
  // -------------------------
  socket.on('rejoin-room', ({ roomId, playerName } = {}, callback) => {
    const cb = typeof callback === 'function' ? callback : () => {};

    const room = rooms.get((roomId || '').toUpperCase());
    if (!room || !room.gameState) {
      return cb({ error: 'Room not found or game not started.' });
    }

    // Find the player in the game state by name (best we can do after disconnect)
    const existing = room.gameState.players.find(p => p.name === (playerName || '').trim());
    if (!existing) {
      return cb({ error: 'Player not found in this game.' });
    }

    // Re-assign socket id
    const oldId = existing.id;
    existing.id = socket.id;
    if (room.players.has(oldId)) {
      const playerMeta = room.players.get(oldId);
      playerMeta.id = socket.id;
      room.players.delete(oldId);
      room.players.set(socket.id, playerMeta);
    } else {
      room.players.set(socket.id, { id: socket.id, name: existing.name, isHost: room.hostId === oldId });
    }
    if (room.hostId === oldId) room.hostId = socket.id;

    socket.join(room.id);

    cb(null, { success: true });

    socket.emit('game-started', {
      hand: existing.hand,
      publicState: buildPublicState(room.gameState),
    });

    const currentPlayer = room.gameState.players[room.gameState.currentPlayerIndex];
    if (currentPlayer && currentPlayer.id === socket.id) {
      socket.emit('your-turn', { mustDraw: room.gameState.turnPhase === 'draw' });
    }

    console.log(`Player ${existing.name} rejoined room ${room.id} with new socket ${socket.id}`);
  });

  // -------------------------
  // disconnect
  // -------------------------
  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);

    const room = findRoomForSocket(socket.id);
    if (!room) return;

    const wasHost = room.hostId === socket.id;
    const gameInProgress = room.gameState !== null;
    const playerName = room.players.get(socket.id)?.name || 'Unknown';

    room.players.delete(socket.id);

    // If room is now empty, delete it
    if (room.players.size === 0) {
      rooms.delete(room.id);
      console.log(`Room ${room.id} deleted (empty).`);
      return;
    }

    // Notify remaining players of disconnection
    if (gameInProgress) {
      io.to(room.id).emit('error', {
        message: `${playerName} has disconnected from the game.`,
      });
    }

    // If host left and game hasn't started, assign new host or delete room
    if (wasHost && !gameInProgress) {
      const nextPlayer = room.players.values().next().value;
      if (nextPlayer) {
        room.hostId = nextPlayer.id;
        nextPlayer.isHost = true;
        console.log(`New host for room ${room.id}: ${nextPlayer.name} (${nextPlayer.id})`);
        io.to(room.id).emit('room-update', { players: buildPlayerList(room) });
      } else {
        rooms.delete(room.id);
        console.log(`Room ${room.id} deleted (no players left).`);
      }
    } else if (!gameInProgress) {
      // Non-host left before game started — just update the player list
      io.to(room.id).emit('room-update', { players: buildPlayerList(room) });
    }
  });
});

server.listen(PORT, () => {
  console.log(`Concan server listening on port ${PORT}`);
});
