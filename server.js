import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3001;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || '*';

// Security Headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), display-capture=(self)');
  next();
});

app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());

// -------------------------------------------------------------
// Ephemeral Rate Limiting (Localhost exempt)
// -------------------------------------------------------------
class EphemeralRateLimiter {
  constructor(windowMs, maxRequests) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.hits = new Map();

    setInterval(() => this.prune(), 5 * 60 * 1000);
  }

  isRateLimited(ip) {
    if (
      !ip ||
      ip === '127.0.0.1' ||
      ip === '::1' ||
      ip === '::ffff:127.0.0.1' ||
      ip === 'localhost' ||
      ip.includes('127.0.0.1')
    ) {
      return false;
    }

    const now = Date.now();
    const timestamps = this.hits.get(ip) || [];
    const valid = timestamps.filter(t => now - t < this.windowMs);

    if (valid.length >= this.maxRequests) {
      return true;
    }

    valid.push(now);
    this.hits.set(ip, valid);
    return false;
  }

  prune() {
    const now = Date.now();
    for (const [ip, list] of this.hits.entries()) {
      const active = list.filter(t => now - t < this.windowMs);
      if (active.length === 0) {
        this.hits.delete(ip);
      } else {
        this.hits.set(ip, active);
      }
    }
  }
}

const createRoomLimiter = new EphemeralRateLimiter(5 * 60 * 1000, 100);
const joinRoomLimiter = new EphemeralRateLimiter(5 * 60 * 1000, 200);

// -------------------------------------------------------------
// Ephemeral Room Store (Zero Disk, Zero DB, Auto-Expires)
// -------------------------------------------------------------
const rooms = new Map();

const ROOM_TTL_MS = 60 * 60 * 1000; // 1 hour
const EMPTY_ROOM_GRACE_MS = 30 * 1000; // 30s grace for page reloads

function generateRoomId() {
  // Clean, human-friendly 6-character format: e.g. veil-749-218
  const part1 = Math.floor(100 + Math.random() * 900);
  const part2 = Math.floor(100 + Math.random() * 900);
  return `veil-${part1}-${part2}`;
}

// Sweep expired rooms periodically
setInterval(() => {
  const now = Date.now();
  for (const [roomId, room] of rooms.entries()) {
    if (now > room.expiresAt) {
      if (room.pendingDeletionTimer) clearTimeout(room.pendingDeletionTimer);
      rooms.delete(roomId);
    }
  }
}, 30 * 1000);

// -------------------------------------------------------------
// REST API Endpoints
// -------------------------------------------------------------

app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    service: 'VEILORA Secure Ephemeral Signaling',
    activeEphemeralRooms: rooms.size,
    timestamp: Date.now()
  });
});

// CREATE PRIVATE ROOM
app.post('/api/rooms/create', (req, res) => {
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';

  if (createRoomLimiter.isRateLimited(clientIp)) {
    return res.status(429).json({
      error: 'Rate limit exceeded. Please wait a moment before creating another room.'
    });
  }

  // Generate unique room ID
  let roomId = generateRoomId();
  while (rooms.has(roomId)) {
    roomId = generateRoomId();
  }

  const now = Date.now();
  const expiresAt = now + ROOM_TTL_MS;

  rooms.set(roomId, {
    id: roomId,
    createdAt: now,
    expiresAt,
    participants: new Map(),
    pendingDeletionTimer: null
  });

  return res.status(201).json({
    roomId,
    expiresAt,
    maxParticipants: 2
  });
});

// VERIFY ROOM (Only Room ID needed!)
app.post('/api/rooms/verify', (req, res) => {
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';

  if (joinRoomLimiter.isRateLimited(clientIp)) {
    return res.status(429).json({
      error: 'Too many verification attempts. Please wait before retrying.'
    });
  }

  const rawId = req.body?.roomId;
  if (!rawId) {
    return res.status(400).json({ error: 'Room ID is required.' });
  }

  const roomId = String(rawId).trim().toLowerCase();
  const room = rooms.get(roomId);

  if (!room) {
    return res.status(404).json({
      error: 'Room not found. Please double-check the Room ID or create a new room.'
    });
  }

  if (room.participants.size >= 2) {
    return res.status(409).json({
      error: 'Room is already full (maximum 2 participants reached).'
    });
  }

  return res.json({
    valid: true,
    roomId,
    participantCount: room.participants.size,
    expiresAt: room.expiresAt
  });
});

// Serve frontend build
const clientDist = path.join(__dirname, 'client', 'dist');
app.use(express.static(clientDist));
app.use((req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
    return next();
  }
  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (err) {
      res.status(200).send('VEILORA Signaling Server Online');
    }
  });
});

// -------------------------------------------------------------
// Real-Time WebRTC Signaling (Socket.io)
// -------------------------------------------------------------
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 10000,
  pingInterval: 15000,
});

io.on('connection', (socket) => {
  let boundRoomId = null;

  // Participant joins room with Room ID
  socket.on('join-room', ({ roomId: rawId, nickname }) => {
    if (!rawId) {
      return socket.emit('join-error', { message: 'Room ID is required.' });
    }

    const roomId = String(rawId).trim().toLowerCase();
    const room = rooms.get(roomId);

    if (!room) {
      return socket.emit('join-error', { message: 'Room not found or has expired.' });
    }

    if (room.participants.size >= 2 && !room.participants.has(socket.id)) {
      return socket.emit('join-error', { message: 'Room is full (max 2 participants).' });
    }

    // Cancel pending deletion timer if active
    if (room.pendingDeletionTimer) {
      clearTimeout(room.pendingDeletionTimer);
      room.pendingDeletionTimer = null;
    }

    boundRoomId = roomId;
    socket.join(roomId);

    const safeNickname = (nickname || 'Anonymous').slice(0, 24);
    room.participants.set(socket.id, {
      nickname: safeNickname,
      joinedAt: Date.now()
    });

    const isInitiator = room.participants.size === 1;

    // Confirm entry to joining socket
    socket.emit('room-joined', {
      roomId,
      isInitiator,
      participantCount: room.participants.size
    });

    // When 2 participants are present, trigger the call!
    if (room.participants.size === 2) {
      const socketIds = Array.from(room.participants.keys());
      const participant1Id = socketIds[0];
      const participant2Id = socketIds[1];

      const p1Data = room.participants.get(participant1Id);
      const p2Data = room.participants.get(participant2Id);

      // Notify Participant 1 about Participant 2
      io.to(participant1Id).emit('peer-joined', {
        peerId: participant2Id,
        nickname: p2Data.nickname
      });

      // Notify Participant 2 about Participant 1
      io.to(participant2Id).emit('peer-joined', {
        peerId: participant1Id,
        nickname: p1Data.nickname
      });

      // Signal ready: Participant 1 is initiator
      io.to(roomId).emit('room-ready', {
        initiatorId: participant1Id,
        receiverId: participant2Id
      });
    }
  });

  // Relay WebRTC SDP Offer
  socket.on('signal-offer', ({ roomId, offer }) => {
    const targetRoom = roomId || boundRoomId;
    if (targetRoom) {
      socket.to(targetRoom).emit('signal-offer', { offer, senderId: socket.id });
    }
  });

  // Relay WebRTC SDP Answer
  socket.on('signal-answer', ({ roomId, answer }) => {
    const targetRoom = roomId || boundRoomId;
    if (targetRoom) {
      socket.to(targetRoom).emit('signal-answer', { answer, senderId: socket.id });
    }
  });

  // Relay ICE Candidate
  socket.on('signal-ice-candidate', ({ roomId, candidate }) => {
    const targetRoom = roomId || boundRoomId;
    if (targetRoom) {
      socket.to(targetRoom).emit('signal-ice-candidate', { candidate, senderId: socket.id });
    }
  });

  // Receiver indicates local media is ready (triggers initiator to send offer safely)
  socket.on('peer-media-ready', ({ roomId }) => {
    const targetRoom = roomId || boundRoomId;
    if (targetRoom) {
      socket.to(targetRoom).emit('peer-media-ready', { senderId: socket.id });
    }
  });

  // Relay Media Toggles (Mic/Cam/Screen)
  socket.on('peer-toggle-media', ({ roomId, type, enabled }) => {
    const targetRoom = roomId || boundRoomId;
    if (targetRoom) {
      socket.to(targetRoom).emit('peer-toggle-media', { type, enabled, senderId: socket.id });
    }
  });

  // Relay Chat Typing
  socket.on('peer-typing', ({ roomId, isTyping }) => {
    const targetRoom = roomId || boundRoomId;
    if (targetRoom) {
      socket.to(targetRoom).emit('peer-typing', { isTyping, senderId: socket.id });
    }
  });

  // Relay Message Reaction
  socket.on('peer-reaction', ({ roomId, emoji, messageId }) => {
    const targetRoom = roomId || boundRoomId;
    if (targetRoom) {
      socket.to(targetRoom).emit('peer-reaction', { emoji, messageId, senderId: socket.id });
    }
  });

  // Relay Encrypted Message Fallback
  socket.on('peer-message', ({ roomId, encryptedPayload }) => {
    const targetRoom = roomId || boundRoomId;
    if (targetRoom && encryptedPayload) {
      socket.to(targetRoom).emit('peer-message', { encryptedPayload, senderId: socket.id });
    }
  });

  // Relay File Handshake Signal
  socket.on('file-signal', ({ roomId, fileSignal }) => {
    const targetRoom = roomId || boundRoomId;
    if (targetRoom) {
      socket.to(targetRoom).emit('file-signal', { fileSignal, senderId: socket.id });
    }
  });

  // Leave room
  socket.on('leave-room', () => {
    handleUserLeave(socket, boundRoomId);
    boundRoomId = null;
  });

  // Disconnect
  socket.on('disconnect', () => {
    if (boundRoomId) {
      handleUserLeave(socket, boundRoomId);
      boundRoomId = null;
    }
  });
});

function handleUserLeave(socket, roomId) {
  if (!roomId) return;
  const room = rooms.get(roomId);
  if (!room) return;

  room.participants.delete(socket.id);
  socket.to(roomId).emit('peer-disconnected', { peerId: socket.id });
  socket.leave(roomId);

  if (room.participants.size === 0) {
    if (room.pendingDeletionTimer) clearTimeout(room.pendingDeletionTimer);
    room.pendingDeletionTimer = setTimeout(() => {
      rooms.delete(roomId);
    }, EMPTY_ROOM_GRACE_MS);
  }
}

server.listen(PORT, () => {
  console.log(`[VEILORA] Ephemeral Signaling Server active on http://localhost:${PORT}`);
});
