// import { useEffect, useRef, useState } from 'react';
// import io from 'socket.io-client';

// const SERVER_URL = process.env.REACT_APP_SERVER_URL || 'http://localhost:5000';

// // Check if we're in a production environment (Vercel deployment)
// const isProduction = process.env.NODE_ENV === 'production';

// export const useSocket = () => {
//   const socketRef = useRef(null);
//   const [isConnected, setIsConnected] = useState(false);
//   const [connectionError, setConnectionError] = useState(null);
//   const reconnectAttempts = useRef(0);
//   const maxReconnectAttempts = 10;

//   useEffect(() => {
//     // Clear any existing errors
//     setConnectionError(null);

//     // Safety check for browser environment
//     if (typeof window === 'undefined') return;

//     console.log('Attempting to connect to server at:', SERVER_URL); 
//     console.log('Environment:', process.env.NODE_ENV);

//     try {
//       // Create socket connection with more robust options
//       socketRef.current = io(SERVER_URL, {
//         transports: ['websocket', 'polling'], // Try WebSocket first, then fallback to polling
//         reconnectionAttempts: maxReconnectAttempts,
//         reconnectionDelay: 1000,
//         timeout: 20000,
//         autoConnect: true,
//         forceNew: false,
//         secure: isProduction, // Force secure connections in production
//         rejectUnauthorized: false // Allow self-signed certificates
//       });

//       const socket = socketRef.current;

//       // Connection event handlers
//       socket.on('connect', () => {
//         console.log('Connected to server:', socket.id);
//         setIsConnected(true);
//         setConnectionError(null);
//         reconnectAttempts.current = 0;
        
//         // Send heartbeat every minute to keep connection alive
//         const heartbeatInterval = setInterval(() => {
//           if (socket.connected) {
//             socket.emit('heartbeat');
//           }
//         }, 60000);
        
//         // Handle server pings to measure latency
//         socket.on('ping', (data) => {
//           socket.emit('pong', data);
//         });
        
//         // Handle latency information
//         socket.on('latency', (data) => {
//           console.log(`Current connection latency: ${data.value}ms`);
//         });
        
//         // Handle connection warnings
//         socket.on('connection-warning', (warning) => {
//           console.warn(`Connection warning: ${warning.message} (${warning.value}ms)`);
          
//           // If we have high latency, reduce video quality
//           if (warning.type === 'high-latency' && warning.value > 300) {
//             document.dispatchEvent(new CustomEvent('reduce-video-quality', { 
//               detail: { latency: warning.value }
//             }));
//           }
//         });
        
//         return () => {
//           clearInterval(heartbeatInterval);
//           socket.off('ping');
//           socket.off('latency');
//           socket.off('connection-warning');
//         };
//       });

//       socket.on('disconnect', (reason) => {
//         console.log('Disconnected from server. Reason:', reason);
//         setIsConnected(false);
        
//         if (reason === 'io server disconnect') {
//           // The server has forcefully disconnected the socket
//           console.log('Server disconnected the socket. Attempting to reconnect...');
//           socket.connect();
//         }
//       });

//       socket.on('connect_error', (error) => {
//         reconnectAttempts.current++;
//         console.error(`Connection error (attempt ${reconnectAttempts.current}/${maxReconnectAttempts}):`, error.message);
//         setConnectionError(`Failed to connect to server: ${error.message}. Attempt ${reconnectAttempts.current} of ${maxReconnectAttempts}`);
//         setIsConnected(false);
        
//         if (reconnectAttempts.current >= maxReconnectAttempts) {
//           console.error('Max reconnection attempts reached. Please check your connection and try again later.');
//           socket.disconnect();
//         }
//       });
      
//       socket.on('reconnect', (attemptNumber) => {
//         console.log('Reconnected to server after', attemptNumber, 'attempts');
//         setIsConnected(true);
//         setConnectionError(null);
//       });

//       socket.on('reconnect_error', (error) => {
//         console.error('Reconnection error:', error);
//       });

//       socket.on('error', (error) => {
//         console.error('Socket error:', error);
//         setConnectionError(`Socket error: ${error.message}`);
//       });

//       // Cleanup on unmount
//       return () => {
//         console.log('Cleaning up socket connection');
//         if (socket) {
//           socket.disconnect();
//           socketRef.current = null;
//         }
//       };
//     } catch (error) {
//       console.error('Failed to initialize socket:', error);
//       setConnectionError(`Failed to initialize socket: ${error.message}`);
//       return () => {};
//     }
//   }, []);

//   // Helper functions
//   const emit = (event, data) => {
//     if (!socketRef.current) {
//       console.error('Cannot emit event: socket not initialized');
//       return;
//     }

//     try {
//       socketRef.current.emit(event, data);
//     } catch (error) {
//       console.error(`Error emitting ${event}:`, error);
//     }
//   };

//   const on = (event, callback) => {
//     if (!socketRef.current) {
//       console.error('Cannot add event listener: socket not initialized');
//       return;
//     }

//     socketRef.current.on(event, callback);
//   };

//   const off = (event, callback) => {
//     if (!socketRef.current) {
//       console.error('Cannot remove event listener: socket not initialized');
//       return;
//     }

//     socketRef.current.off(event, callback);
//   };

//   const reconnect = () => {
//     if (socketRef.current) {
//       reconnectAttempts.current = 0;
//       setConnectionError(null);
//       console.log('Attempting to reconnect...');
//       socketRef.current.connect();
//     }
//   };

//   return {
//     socket: socketRef.current,
//     isConnected,
//     connectionError,
//     emit,
//     on,
//     off,
//     reconnect
//   };
// };     







// hooks/useSocket.js - Updated socket hook for network connections
import { useEffect, useState, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';

export const useSocket = (serverUrl = null) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const socketRef = useRef(null);
  const maxReconnectAttempts = 5;

  // Determine server URL
  const getServerUrl = useCallback(() => {
    if (serverUrl) return serverUrl;
    
    // Check if we're in development or production
    if (process.env.NODE_ENV === 'development') {
      // For development, try to detect the server IP
      const hostname = window.location.hostname;
      const port = process.env.REACT_APP_SERVER_PORT || '3001';
      
      // If accessing via IP, use the same IP for socket
      if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
        return `http://${hostname}:${port}`;
      }
      
      // Default to localhost for local development
      return `http://localhost:${port}`;
    }
    
    // For production, use the same origin
    return window.location.origin;
  }, [serverUrl]);

  useEffect(() => {
    const serverURL = getServerUrl();
    console.log('Connecting to server:', serverURL);

    // Socket.io configuration for cross-network communication
    const socketConfig = {
      transports: ['websocket', 'polling'],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
      // Important: Allow cross-origin requests
      withCredentials: false,
      // Add additional options for better connectivity
      upgrade: true,
      rememberUpgrade: true
    };

    // Create socket connection
    const newSocket = io(serverURL, socketConfig);
    socketRef.current = newSocket;
    setSocket(newSocket);

    // Connection event handlers
    newSocket.on('connect', () => {
      console.log('✅ Connected to server:', newSocket.id);
      setIsConnected(true);
      setConnectionError(null);
      setReconnectAttempts(0);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('❌ Disconnected from server:', reason);
      setIsConnected(false);
      
      // Set error message based on disconnect reason
      if (reason === 'io server disconnect') {
        setConnectionError('Server disconnected the connection');
      } else if (reason === 'transport close') {
        setConnectionError('Connection lost');
      } else {
        setConnectionError(`Disconnected: ${reason}`);
      }
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ Connection error:', error);
      setIsConnected(false);
      
      // Increment reconnect attempts
      setReconnectAttempts(prev => {
        const newAttempts = prev + 1;
        
        if (newAttempts >= maxReconnectAttempts) {
          setConnectionError(`Failed to connect after ${maxReconnectAttempts} attempts. Please check your network connection and server address.`);
        } else {
          setConnectionError(`Connection failed. Retrying... (${newAttempts}/${maxReconnectAttempts})`);
        }
        
        return newAttempts;
      });
    });

    newSocket.on('reconnect', (attemptNumber) => {
      console.log(`✅ Reconnected after ${attemptNumber} attempts`);
      setConnectionError(null);
      setReconnectAttempts(0);
    });

    newSocket.on('reconnect_error', (error) => {
      console.error('❌ Reconnection error:', error);
    });

    newSocket.on('reconnect_failed', () => {
      console.error('❌ Reconnection failed');
      setConnectionError('Failed to reconnect to server. Please refresh the page.');
    });

    // Custom error handler
    newSocket.on('error', (error) => {
      console.error('❌ Socket error:', error);
      setConnectionError(`Server error: ${error.message || error}`);
    });

    // Cleanup function
    return () => {
      console.log('🧹 Cleaning up socket connection');
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setSocket(null);
      setIsConnected(false);
    };
  }, [getServerUrl, maxReconnectAttempts]);

  // Emit function with connection check
  const emit = useCallback((event, data) => {
    if (socketRef.current && isConnected) {
      console.log(`📤 Emitting ${event}:`, data);
      socketRef.current.emit(event, data);
    } else {
      console.warn(`⚠️ Cannot emit ${event}: Socket not connected`);
    }
  }, [isConnected]);

  // On function for event listeners
  const on = useCallback((event, callback) => {
    if (socketRef.current) {
      console.log(`📥 Listening for ${event}`);
      socketRef.current.on(event, callback);
    }
  }, []);

  // Off function for removing event listeners
  const off = useCallback((event, callback) => {
    if (socketRef.current) {
      console.log(`🔇 Removing listener for ${event}`);
      socketRef.current.off(event, callback);
    }
  }, []);

  // Manual reconnect function
  const reconnect = useCallback(() => {
    if (socketRef.current) {
      console.log('🔄 Manual reconnect triggered');
      setReconnectAttempts(0);
      setConnectionError(null);
      socketRef.current.connect();
    }
  }, []);

  return {
    socket,
    isConnected,
    connectionError,
    reconnectAttempts,
    emit,
    on,
    off,
    reconnect
  };
};