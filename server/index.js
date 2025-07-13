// const express = require('express');
// const http = require('http');
// const socketIo = require('socket.io');
// const cors = require('cors');
// const { v4: uuidv4 } = require('uuid');
// require('dotenv').config();

// const app = express();
// const server = http.createServer(app);

// // Configure CORS for Socket.io
// const io = socketIo(server, {
//   cors: {
//     origin: process.env.CLIENT_URL || "http://localhost:3000",
//     methods: ["GET", "POST"]
//   }
// });

// // Middleware
// app.use(cors());
// app.use(express.json());

// // Store rooms and users
// const rooms = new Map();
// const users = new Map();

// // Helper functions
// const getRoomInfo = (roomId) => {
//   const room = rooms.get(roomId);
  
//   if (!room) return null;
  
//   return {
//     id: roomId,
//     userCount: room.users.size,
//     users: Array.from(room.users.values()).map(user => ({
//       id: user.id,
//       name: user.name,
//       isAudioEnabled: user.isAudioEnabled,
//       isVideoEnabled: user.isVideoEnabled
//     })),
//     createdAt: room.createdAt,
//     roomType: room.roomType
//   };
// };

// const getActiveRooms = () => {
//   const activeRooms = [];
  
//   rooms.forEach((room, roomId) => {
//     if (room.users.size > 0) {
//       activeRooms.push({
//         id: roomId,
//         userCount: room.users.size,
//         createdAt: room.createdAt,
//         roomType: room.roomType
//       });
//     }
//   });
  
//   // Sort rooms by user count (descending)
//   return activeRooms.sort((a, b) => b.userCount - a.userCount);
// };

// // API Routes
// app.get('/api/health', (req, res) => {
//   res.json({ status: 'Server is running!', version: '1.0.0' });
// });

// app.get('/api/rooms', (req, res) => {
//   res.json(getActiveRooms());
// });

// app.get('/api/rooms/:roomId', (req, res) => {
//   const { roomId } = req.params;
//   const roomInfo = getRoomInfo(roomId);
  
//   if (roomInfo) {
//     res.json(roomInfo);
//   } else {
//     res.json({
//       id: roomId,
//       userCount: 0,
//       users: [],
//       exists: false
//     });
//   }
// });

// // Socket.io connection handling
// io.on('connection', (socket) => {
//   console.log(`User connected: ${socket.id}`);
  
//   // Setup heartbeat/ping to keep connections alive
//   let heartbeatInterval;
  
//   const startHeartbeat = () => {
//     // Clear any existing interval
//     if (heartbeatInterval) {
//       clearInterval(heartbeatInterval);
//     }
    
//     // Send ping every 5 seconds to keep connection alive
//     heartbeatInterval = setInterval(() => {
//       socket.emit('ping', { timestamp: Date.now() });
//     }, 5000);
//   };
  
//   // Start heartbeat on connection
//   startHeartbeat();
  
//   // Respond to client pongs
//   socket.on('pong', (data) => {
//     const latency = Date.now() - data.timestamp;
//     socket.emit('latency', { value: latency });
    
//     // If we detect high latency, notify the client
//     if (latency > 300) { // 300ms threshold
//       socket.emit('connection-warning', { 
//         type: 'high-latency',
//         value: latency,
//         message: 'High network latency detected'
//       });
//     }
//   });
  
//   // Handle heartbeat from client
//   socket.on('heartbeat', () => {
//     // Reset the heartbeat interval to avoid drift
//     startHeartbeat();
//   });

//   // Get active rooms
//   socket.on('get-active-rooms', () => {
//     socket.emit('active-rooms', getActiveRooms());
//   });

//   // Join room
//   socket.on('join-room', ({ roomId, userName, roomType = 'video' }) => {
//     // Check if user is already in a room
//     if (socket.roomId) {
//       // If trying to join the same room, ignore
//       if (socket.roomId === roomId) {
//         return;
//       }
      
//       // Leave current room first
//       const currentRoom = rooms.get(socket.roomId);
//       if (currentRoom) {
//         currentRoom.users.delete(socket.id);
//         socket.leave(socket.roomId);
        
//         // Notify others in the old room
//         socket.to(socket.roomId).emit('user-left', {
//           userId: socket.id,
//           userCount: currentRoom.users.size
//         });
        
//         // Delete room if empty
//         if (currentRoom.users.size === 0) {
//           rooms.delete(socket.roomId);
//           io.emit('room-deleted', socket.roomId);
//         }
//       }
//     }
    
//     console.log(`User ${userName} (${socket.id}) joining room ${roomId}`);
    
//     // Create user object
//     const user = {
//       id: socket.id,
//       name: userName || `User-${socket.id.substring(0, 6)}`,
//       socketId: socket.id,
//       isAudioEnabled: true,
//       isVideoEnabled: roomType === 'video',
//       roomId: roomId, // Store roomId in user object
//       lastActive: Date.now() // Update last active timestamp
//     };
    
//     // Store user
//     users.set(socket.id, user);
    
//     // Create room if it doesn't exist
//     if (!rooms.has(roomId)) {
//       rooms.set(roomId, {
//         id: roomId,
//         users: new Map(),
//         createdAt: new Date(),
//         roomType
//       });
//     }
    
//     const room = rooms.get(roomId);
//     room.users.set(socket.id, user);
    
//     // Join socket room
//     socket.join(roomId);
//     socket.roomId = roomId;
    
//     // Notify other users in the room
//     socket.to(roomId).emit('user-joined', {
//       userId: socket.id,
//       userName: user.name,
//       userCount: room.users.size
//     });
    
//     // Send room info to the joining user
//     socket.emit('joined-room', {
//       roomId,
//       userId: socket.id,
//       userName: user.name,
//       users: Array.from(room.users.values())
//         .filter(u => u.id !== socket.id)
//         .map(u => ({
//           id: u.id,
//           name: u.name,
//           isAudioEnabled: u.isAudioEnabled,
//           isVideoEnabled: u.isVideoEnabled
//         })),
//       userCount: room.users.size,
//       roomType: room.roomType
//     });
    
//     // Broadcast updated room info
//     io.emit('room-updated', {
//       id: roomId,
//       userCount: room.users.size,
//       createdAt: room.createdAt,
//       roomType: room.roomType
//     });
//   });

//   // Handle WebRTC signaling
//   socket.on('offer', ({ offer, targetUserId }) => {
//     console.log(`Offer from ${socket.id} to ${targetUserId}`);
//     const user = users.get(socket.id);
    
//     socket.to(targetUserId).emit('offer', {
//       offer,
//       fromUserId: socket.id,
//       fromUserName: user?.name
//     });
//   });

//   socket.on('answer', ({ answer, targetUserId }) => {
//     console.log(`Answer from ${socket.id} to ${targetUserId}`);
//     const user = users.get(socket.id);
    
//     socket.to(targetUserId).emit('answer', {
//       answer,
//       fromUserId: socket.id,
//       fromUserName: user?.name
//     });
//   });

//   socket.on('ice-candidate', ({ candidate, targetUserId }) => {
//     console.log(`ICE candidate from ${socket.id} to ${targetUserId}`);
//     socket.to(targetUserId).emit('ice-candidate', {
//       candidate,
//       fromUserId: socket.id
//     });
//   });

//   // Handle media controls
//   socket.on('toggle-audio', ({ roomId, isAudioEnabled }) => {
//     const user = users.get(socket.id);
//     const room = rooms.get(roomId);
    
//     if (user && room) {
//       user.isAudioEnabled = isAudioEnabled;
//       room.users.set(socket.id, user);
      
//       socket.to(roomId).emit('user-audio-toggle', {
//         userId: socket.id,
//         isAudioEnabled
//       });
//     }
//   });

//   socket.on('toggle-video', ({ roomId, isVideoEnabled }) => {
//     const user = users.get(socket.id);
//     const room = rooms.get(roomId);
    
//     if (user && room) {
//       user.isVideoEnabled = isVideoEnabled;
//       room.users.set(socket.id, user);
      
//       socket.to(roomId).emit('user-video-toggle', {
//         userId: socket.id,
//         isVideoEnabled
//       });
//     }
//   });

//   // Handle chat messages
//   socket.on('chat-message', ({ roomId, message }) => {
//     const user = users.get(socket.id);
//     const room = rooms.get(roomId);
    
//     if (!user || !room) return;
    
//     const chatMessage = {
//       id: uuidv4(),
//       userId: socket.id,
//       userName: user.name || 'Anonymous',
//       message,
//       timestamp: new Date()
//     };
    
//     io.to(roomId).emit('chat-message', chatMessage);
//   });

//   // Handle screen sharing
//   socket.on('start-screen-share', ({ roomId }) => {
//     const user = users.get(socket.id);
    
//     if (user) {
//       socket.to(roomId).emit('user-screen-share-started', {
//         userId: socket.id,
//         userName: user.name
//       });
//     }
//   });

//   socket.on('stop-screen-share', ({ roomId }) => {
//     socket.to(roomId).emit('user-screen-share-stopped', {
//       userId: socket.id
//     });
//   });

//   // Handle disconnection
//   socket.on('disconnect', () => {
//     console.log(`User disconnected: ${socket.id}`);
    
//     // Clear heartbeat interval
//     if (heartbeatInterval) {
//       clearInterval(heartbeatInterval);
//     }
    
//     const user = users.get(socket.id);
//     const roomId = socket.roomId;
    
//     // Add a short delay before cleaning up to prevent race conditions
//     // between room join and connection establishment
//     setTimeout(() => {
//       if (roomId && rooms.has(roomId)) {
//         const room = rooms.get(roomId);
//         room.users.delete(socket.id);
        
//         // Notify other users
//         io.to(roomId).emit('user-left', {
//           userId: socket.id,
//           userName: user?.name,
//           userCount: room.users.size
//         });
        
//         // Broadcast updated room info if room still exists
//         if (room.users.size > 0) {
//           io.emit('room-updated', {
//             id: roomId,
//             userCount: room.users.size,
//             createdAt: room.createdAt,
//             roomType: room.roomType
//           });
//           console.log(`Room ${roomId} now has ${room.users.size} users`);
//         } else {
//           // Clean up empty rooms
//           rooms.delete(roomId);
//           io.emit('room-deleted', roomId);
//           console.log(`Room ${roomId} deleted (empty)`);
//         }
//       }
      
//       users.delete(socket.id);
//     }, 1000); // Add a 1-second delay
//   });

//   // Handle leave room
//   socket.on('leave-room', () => {
//     const roomId = socket.roomId;
//     const user = users.get(socket.id);
    
//     if (roomId && rooms.has(roomId) && user) {
//       const room = rooms.get(roomId);
      
//       // Set room ID to null immediately to prevent new connections to this room
//       const oldRoomId = socket.roomId;
//       socket.roomId = null;
//       socket.leave(oldRoomId);
      
//       // Add a short delay before cleaning up to prevent race conditions
//       setTimeout(() => {
//         if (rooms.has(oldRoomId)) {
//           const room = rooms.get(oldRoomId);
//           room.users.delete(socket.id);
          
//           // Notify other users
//           io.to(oldRoomId).emit('user-left', {
//             userId: socket.id,
//             userName: user.name,
//             userCount: room.users.size
//           });
          
//           // Broadcast updated room info if room still exists
//           if (room.users.size > 0) {
//             io.emit('room-updated', {
//               id: oldRoomId,
//               userCount: room.users.size,
//               createdAt: room.createdAt,
//               roomType: room.roomType
//             });
//           } else {
//             // Clean up empty rooms
//             rooms.delete(oldRoomId);
//             io.emit('room-deleted', oldRoomId);
//             console.log(`Room ${oldRoomId} deleted (empty)`);
//           }
//         }
//       }, 1000); // Add a 1-second delay
//     }
//   });
// });

// // Periodic cleanup of stale rooms and disconnected users
// const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
// const ROOM_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours
// const USER_INACTIVITY = 30 * 60 * 1000; // 30 minutes

// setInterval(() => {
//   const now = Date.now();
  
//   // Clean up inactive users
//   users.forEach((user, userId) => {
//     const inactiveTime = now - (user.lastActive || 0);
    
//     if (inactiveTime > USER_INACTIVITY) {
//       const socket = io.sockets.sockets.get(userId);
      
//       if (!socket || !socket.connected) {
//         users.delete(userId);
//         console.log(`Removed inactive user: ${userId}`);
        
//         // Clean up from rooms
//         if (user.roomId && rooms.has(user.roomId)) {
//           const room = rooms.get(user.roomId);
//           room.users.delete(userId);
          
//           if (room.users.size === 0) {
//             rooms.delete(user.roomId);
//             io.emit('room-deleted', user.roomId);
//             console.log(`Room ${user.roomId} deleted (inactive user)`);
//           } else {
//             io.emit('room-updated', {
//               id: user.roomId,
//               userCount: room.users.size,
//               createdAt: room.createdAt,
//               roomType: room.roomType
//             });
//           }
//         }
//       }
//     }
//   });
  
//   // Clean up old empty rooms
//   rooms.forEach((room, roomId) => {
//     const roomAge = now - room.createdAt.getTime();
    
//     if (room.users.size === 0 && roomAge > ROOM_EXPIRY) {
//       rooms.delete(roomId);
//       io.emit('room-deleted', roomId);
//       console.log(`Room ${roomId} deleted (expired)`);
//     }
//   });
// }, CLEANUP_INTERVAL);

// const PORT = process.env.PORT || 5000;

// server.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
//   console.log(`Client URL: ${process.env.CLIENT_URL || "http://localhost:3000"}`);
// }); 





// server.js - Node.js/Express server with Socket.io
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const os = require('os');

const app = express();
const server = http.createServer(app);

// Configure CORS for cross-origin requests
app.use(cors({
  origin: "*", // Allow all origins for development
  credentials: true
}));

// Socket.io configuration for cross-network communication
const io = socketIo(server, {
  cors: {
    origin: "*", // Allow all origins
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling'], // Enable both transport methods
  allowEIO3: true
});

// Serve static files (if you have a build folder)
app.use(express.static(path.join(__dirname, 'build')));

// Store room information and user data
const rooms = new Map();
const users = new Map();

// Utility function to get server IP addresses
function getServerIPs() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  
  for (const name of Object.keys(interfaces)) {
    for (const interface of interfaces[name]) {
      if (interface.family === 'IPv4' && !interface.internal) {
        ips.push(interface.address);
      }
    }
  }
  
  return ips;
}

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);
  
  // Store user information
  users.set(socket.id, {
    id: socket.id,
    name: null,
    roomId: null,
    joinedAt: new Date()
  });

  // Handle joining a room
  socket.on('join-room', ({ roomId, userName }) => {
    try {
      console.log(`User ${userName} (${socket.id}) joining room: ${roomId}`);
      
      // Update user info
      const user = users.get(socket.id);
      if (user) {
        user.name = userName;
        user.roomId = roomId;
      }
      
      // Leave any existing room first
      const currentRooms = Array.from(socket.rooms).filter(room => room !== socket.id);
      currentRooms.forEach(room => {
        socket.leave(room);
        console.log(`User ${socket.id} left room: ${room}`);
      });
      
      // Join the new room
      socket.join(roomId);
      
      // Initialize room if it doesn't exist
      if (!rooms.has(roomId)) {
        rooms.set(roomId, {
          id: roomId,
          users: new Map(),
          createdAt: new Date()
        });
      }
      
      const room = rooms.get(roomId);
      
      // Get existing users in the room (excluding current user)
      const existingUsers = Array.from(room.users.values()).filter(u => u.id !== socket.id);
      
      // Add current user to room
      room.users.set(socket.id, {
        id: socket.id,
        name: userName,
        joinedAt: new Date()
      });
      
      // Notify the joining user about existing users
      socket.emit('joined-room', {
        roomId,
        users: existingUsers
      });
      
      // Notify existing users about the new user
      socket.to(roomId).emit('user-joined', {
        userId: socket.id,
        userName: userName
      });
      
      console.log(`Room ${roomId} now has ${room.users.size} users`);
      
    } catch (error) {
      console.error('Error joining room:', error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

  // Handle WebRTC offer
  socket.on('offer', ({ offer, targetUserId }) => {
    const user = users.get(socket.id);
    if (user) {
      console.log(`Forwarding offer from ${user.name} (${socket.id}) to ${targetUserId}`);
      socket.to(targetUserId).emit('offer', {
        offer,
        fromUserId: socket.id,
        fromUserName: user.name
      });
    }
  });

  // Handle WebRTC answer
  socket.on('answer', ({ answer, targetUserId }) => {
    const user = users.get(socket.id);
    if (user) {
      console.log(`Forwarding answer from ${user.name} (${socket.id}) to ${targetUserId}`);
      socket.to(targetUserId).emit('answer', {
        answer,
        fromUserId: socket.id,
        fromUserName: user.name
      });
    }
  });

  // Handle ICE candidates
  socket.on('ice-candidate', ({ candidate, targetUserId }) => {
    console.log(`Forwarding ICE candidate from ${socket.id} to ${targetUserId}`);
    socket.to(targetUserId).emit('ice-candidate', {
      candidate,
      fromUserId: socket.id
    });
  });

  // Handle audio toggle
  socket.on('audio-toggle', ({ isEnabled }) => {
    const user = users.get(socket.id);
    if (user && user.roomId) {
      socket.to(user.roomId).emit('user-audio-toggle', {
        userId: socket.id,
        isEnabled
      });
    }
  });

  // Handle video toggle
  socket.on('video-toggle', ({ isEnabled }) => {
    const user = users.get(socket.id);
    if (user && user.roomId) {
      socket.to(user.roomId).emit('user-video-toggle', {
        userId: socket.id,
        isEnabled
      });
    }
  });

  // Handle screen share toggle
  socket.on('screen-share-toggle', ({ isEnabled }) => {
    const user = users.get(socket.id);
    if (user && user.roomId) {
      socket.to(user.roomId).emit('user-screen-share-toggle', {
        userId: socket.id,
        isEnabled
      });
    }
  });

  // Handle chat messages
  socket.on('chat-message', ({ message, roomId }) => {
    const user = users.get(socket.id);
    if (user && user.roomId === roomId) {
      const messageData = {
        id: Date.now(),
        userId: socket.id,
        userName: user.name,
        message,
        timestamp: new Date()
      };
      
      // Send to all users in the room including sender
      io.to(roomId).emit('chat-message', messageData);
      console.log(`Chat message in room ${roomId} from ${user.name}: ${message}`);
    }
  });

  // Handle leaving room
  socket.on('leave-room', () => {
    handleUserLeave(socket);
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    handleUserLeave(socket);
  });

  // Function to handle user leaving
  function handleUserLeave(socket) {
    const user = users.get(socket.id);
    if (user && user.roomId) {
      const roomId = user.roomId;
      const room = rooms.get(roomId);
      
      if (room) {
        // Remove user from room
        room.users.delete(socket.id);
        
        // Notify other users in the room
        socket.to(roomId).emit('user-left', {
          userId: socket.id,
          userName: user.name
        });
        
        console.log(`User ${user.name} (${socket.id}) left room ${roomId}`);
        
        // Clean up empty room
        if (room.users.size === 0) {
          rooms.delete(roomId);
          console.log(`Room ${roomId} deleted (empty)`);
        }
      }
    }
    
    // Remove user from global users map
    users.delete(socket.id);
  }
});

// API endpoint to get server info
app.get('/api/server-info', (req, res) => {
  res.json({
    serverIPs: getServerIPs(),
    port: PORT,
    timestamp: new Date(),
    activeRooms: rooms.size,
    activeUsers: users.size
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date(),
    uptime: process.uptime()
  });
});

// Serve React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  const serverIPs = getServerIPs();
  console.log(`\n🚀 Video Call Server running on port ${PORT}`);
  console.log(`📡 Server accessible at:`);
  console.log(`   - Local: http://localhost:${PORT}`);
  
  serverIPs.forEach(ip => {
    console.log(`   - Network: http://${ip}:${PORT}`);
  });
  
  console.log(`\n💡 Other devices can connect using your network IP address`);
  console.log(`📱 Make sure firewall allows connections on port ${PORT}\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});