const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Configure CORS for Socket.io
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3001",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Store rooms and users
const rooms = new Map();
const users = new Map();

// Helper functions
const getRoomInfo = (roomId) => {
  const room = rooms.get(roomId);
  
  if (!room) return null;
  
  return {
    id: roomId,
    userCount: room.users.size,
    users: Array.from(room.users.values()).map(user => ({
      id: user.id,
      name: user.name,
      isAudioEnabled: user.isAudioEnabled,
      isVideoEnabled: user.isVideoEnabled
    })),
    createdAt: room.createdAt,
    roomType: room.roomType
  };
};

const getActiveRooms = () => {
  const activeRooms = [];
  
  rooms.forEach((room, roomId) => {
    if (room.users.size > 0) {
      activeRooms.push({
        id: roomId,
        userCount: room.users.size,
        createdAt: room.createdAt,
        roomType: room.roomType
      });
    }
  });
  
  // Sort rooms by user count (descending)
  return activeRooms.sort((a, b) => b.userCount - a.userCount);
};

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running!', version: '1.0.0' });
});

app.get('/api/rooms', (req, res) => {
  res.json(getActiveRooms());
});

app.get('/api/rooms/:roomId', (req, res) => {
  const { roomId } = req.params;
  const roomInfo = getRoomInfo(roomId);
  
  if (roomInfo) {
    res.json(roomInfo);
  } else {
    res.json({
      id: roomId,
      userCount: 0,
      users: [],
      exists: false
    });
  }
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);
  
  // Setup heartbeat/ping to keep connections alive
  let heartbeatInterval;
  
  const startHeartbeat = () => {
    // Clear any existing interval
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
    }
    
    // Send ping every 5 seconds to keep connection alive
    heartbeatInterval = setInterval(() => {
      socket.emit('ping', { timestamp: Date.now() });
    }, 5000);
  };
  
  // Start heartbeat on connection
  startHeartbeat();
  
  // Respond to client pongs
  socket.on('pong', (data) => {
    const latency = Date.now() - data.timestamp;
    socket.emit('latency', { value: latency });
    
    // If we detect high latency, notify the client
    if (latency > 300) { // 300ms threshold
      socket.emit('connection-warning', { 
        type: 'high-latency',
        value: latency,
        message: 'High network latency detected'
      });
    }
  });
  
  // Handle heartbeat from client
  socket.on('heartbeat', () => {
    // Reset the heartbeat interval to avoid drift
    startHeartbeat();
  });

  // Get active rooms
  socket.on('get-active-rooms', () => {
    socket.emit('active-rooms', getActiveRooms());
  });

  // Join room
  socket.on('join-room', ({ roomId, userName, roomType = 'video' }) => {
    // Check if user is already in a room
    if (socket.roomId) {
      // If trying to join the same room, ignore
      if (socket.roomId === roomId) {
        return;
      }
      
      // Leave current room first
      const currentRoom = rooms.get(socket.roomId);
      if (currentRoom) {
        currentRoom.users.delete(socket.id);
        socket.leave(socket.roomId);
        
        // Notify others in the old room
        socket.to(socket.roomId).emit('user-left', {
          userId: socket.id,
          userCount: currentRoom.users.size
        });
        
        // Delete room if empty
        if (currentRoom.users.size === 0) {
          rooms.delete(socket.roomId);
          io.emit('room-deleted', socket.roomId);
        }
      }
    }
    
    console.log(`User ${userName} (${socket.id}) joining room ${roomId}`);
    
    // Create user object
    const user = {
      id: socket.id,
      name: userName || `User-${socket.id.substring(0, 6)}`,
      socketId: socket.id,
      isAudioEnabled: true,
      isVideoEnabled: roomType === 'video'
    };
    
    // Store user
    users.set(socket.id, user);
    
    // Create room if it doesn't exist
    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        id: roomId,
        users: new Map(),
        createdAt: new Date(),
        roomType
      });
    }
    
    const room = rooms.get(roomId);
    room.users.set(socket.id, user);
    
    // Join socket room
    socket.join(roomId);
    socket.roomId = roomId;
    
    // Notify other users in the room
    socket.to(roomId).emit('user-joined', {
      userId: socket.id,
      userName: user.name,
      userCount: room.users.size
    });
    
    // Send room info to the joining user
    socket.emit('joined-room', {
      roomId,
      userId: socket.id,
      userName: user.name,
      users: Array.from(room.users.values())
        .filter(u => u.id !== socket.id)
        .map(u => ({
          id: u.id,
          name: u.name,
          isAudioEnabled: u.isAudioEnabled,
          isVideoEnabled: u.isVideoEnabled
        })),
      userCount: room.users.size,
      roomType: room.roomType
    });
    
    // Broadcast updated room info
    io.emit('room-updated', {
      id: roomId,
      userCount: room.users.size,
      createdAt: room.createdAt,
      roomType: room.roomType
    });
  });

  // Handle WebRTC signaling
  socket.on('offer', ({ offer, targetUserId }) => {
    console.log(`Offer from ${socket.id} to ${targetUserId}`);
    const user = users.get(socket.id);
    
    socket.to(targetUserId).emit('offer', {
      offer,
      fromUserId: socket.id,
      fromUserName: user?.name
    });
  });

  socket.on('answer', ({ answer, targetUserId }) => {
    console.log(`Answer from ${socket.id} to ${targetUserId}`);
    const user = users.get(socket.id);
    
    socket.to(targetUserId).emit('answer', {
      answer,
      fromUserId: socket.id,
      fromUserName: user?.name
    });
  });

  socket.on('ice-candidate', ({ candidate, targetUserId }) => {
    console.log(`ICE candidate from ${socket.id} to ${targetUserId}`);
    socket.to(targetUserId).emit('ice-candidate', {
      candidate,
      fromUserId: socket.id
    });
  });

  // Handle media controls
  socket.on('toggle-audio', ({ roomId, isAudioEnabled }) => {
    const user = users.get(socket.id);
    const room = rooms.get(roomId);
    
    if (user && room) {
      user.isAudioEnabled = isAudioEnabled;
      room.users.set(socket.id, user);
      
      socket.to(roomId).emit('user-audio-toggle', {
        userId: socket.id,
        isAudioEnabled
      });
    }
  });

  socket.on('toggle-video', ({ roomId, isVideoEnabled }) => {
    const user = users.get(socket.id);
    const room = rooms.get(roomId);
    
    if (user && room) {
      user.isVideoEnabled = isVideoEnabled;
      room.users.set(socket.id, user);
      
      socket.to(roomId).emit('user-video-toggle', {
        userId: socket.id,
        isVideoEnabled
      });
    }
  });

  // Handle chat messages
  socket.on('chat-message', ({ roomId, message }) => {
    const user = users.get(socket.id);
    const room = rooms.get(roomId);
    
    if (!user || !room) return;
    
    const chatMessage = {
      id: uuidv4(),
      userId: socket.id,
      userName: user.name || 'Anonymous',
      message,
      timestamp: new Date()
    };
    
    io.to(roomId).emit('chat-message', chatMessage);
  });

  // Handle screen sharing
  socket.on('start-screen-share', ({ roomId }) => {
    const user = users.get(socket.id);
    
    if (user) {
      socket.to(roomId).emit('user-screen-share-started', {
        userId: socket.id,
        userName: user.name
      });
    }
  });

  socket.on('stop-screen-share', ({ roomId }) => {
    socket.to(roomId).emit('user-screen-share-stopped', {
      userId: socket.id
    });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    
    // Clear heartbeat interval
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
    }
    
    const user = users.get(socket.id);
    const roomId = socket.roomId;
    
    if (roomId && rooms.has(roomId)) {
      const room = rooms.get(roomId);
      room.users.delete(socket.id);
      
      // Notify other users
      socket.to(roomId).emit('user-left', {
        userId: socket.id,
        userName: user?.name,
        userCount: room.users.size
      });
      
      // Broadcast updated room info if room still exists
      if (room.users.size > 0) {
        io.emit('room-updated', {
          id: roomId,
          userCount: room.users.size,
          createdAt: room.createdAt,
          roomType: room.roomType
        });
        console.log(`Room ${roomId} now has ${room.users.size} users`);
      } else {
        // Clean up empty rooms
        rooms.delete(roomId);
        io.emit('room-deleted', roomId);
        console.log(`Room ${roomId} deleted (empty)`);
      }
    }
    
    users.delete(socket.id);
  });

  // Handle leave room
  socket.on('leave-room', () => {
    const roomId = socket.roomId;
    const user = users.get(socket.id);
    
    if (roomId && rooms.has(roomId) && user) {
      const room = rooms.get(roomId);
      
      room.users.delete(socket.id);
      socket.leave(roomId);
      
      socket.to(roomId).emit('user-left', {
        userId: socket.id,
        userName: user.name,
        userCount: room.users.size
      });
      
      socket.roomId = null;
      
      // Broadcast updated room info if room still exists
      if (room.users.size > 0) {
        io.emit('room-updated', {
          id: roomId,
          userCount: room.users.size,
          createdAt: room.createdAt,
          roomType: room.roomType
        });
      } else {
        // Clean up empty rooms
        rooms.delete(roomId);
        io.emit('room-deleted', roomId);
        console.log(`Room ${roomId} deleted (empty)`);
      }
    }
  });
});

// Periodic cleanup of stale rooms and disconnected users
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
const ROOM_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours
const USER_INACTIVITY = 30 * 60 * 1000; // 30 minutes

setInterval(() => {
  const now = Date.now();
  
  // Clean up inactive users
  users.forEach((user, userId) => {
    const inactiveTime = now - (user.lastActive || 0);
    
    if (inactiveTime > USER_INACTIVITY) {
      const socket = io.sockets.sockets.get(userId);
      
      if (!socket || !socket.connected) {
        users.delete(userId);
        console.log(`Removed inactive user: ${userId}`);
        
        // Clean up from rooms
        if (user.roomId && rooms.has(user.roomId)) {
          const room = rooms.get(user.roomId);
          room.users.delete(userId);
          
          if (room.users.size === 0) {
            rooms.delete(user.roomId);
            io.emit('room-deleted', user.roomId);
            console.log(`Room ${user.roomId} deleted (inactive user)`);
          } else {
            io.emit('room-updated', {
              id: user.roomId,
              userCount: room.users.size,
              createdAt: room.createdAt,
              roomType: room.roomType
            });
          }
        }
      }
    }
  });
  
  // Clean up old empty rooms
  rooms.forEach((room, roomId) => {
    const roomAge = now - room.createdAt.getTime();
    
    if (room.users.size === 0 && roomAge > ROOM_EXPIRY) {
      rooms.delete(roomId);
      io.emit('room-deleted', roomId);
      console.log(`Room ${roomId} deleted (expired)`);
    }
  });
}, CLEANUP_INTERVAL);

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Client URL: ${process.env.CLIENT_URL || "http://localhost:3000"}`);
}); 