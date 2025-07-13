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
    
    // Use environment variable or default to port 3001
    const serverPort = '3001';
    
    // Check if we're in development or production
    if (process.env.NODE_ENV === 'development') {
      // For development, try to detect the server IP
      const hostname = window.location.hostname;
      
      // If accessing via IP, use the same IP for socket
      if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
        return `http://${hostname}:${serverPort}`;
      }
      
      // Default to localhost for local development
      return `http://localhost:${serverPort}`;
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
      return true;
    } else {
      console.warn(`⚠️ Cannot emit ${event}: Socket not connected`);
      return false;
    }
  }, [isConnected]);

  // On function for event listeners
  const on = useCallback((event, callback) => {
    if (socketRef.current) {
      console.log(`📥 Listening for ${event}`);
      socketRef.current.on(event, callback);
      return true;
    }
    return false;
  }, []);

  // Off function for removing event listeners
  const off = useCallback((event, callback) => {
    if (socketRef.current) {
      console.log(`🔇 Removing listener for ${event}`);
      socketRef.current.off(event, callback);
      return true;
    }
    return false;
  }, []);

  // Manual reconnect function
  const reconnect = useCallback(() => {
    if (socketRef.current) {
      console.log('🔄 Manual reconnect triggered');
      setReconnectAttempts(0);
      setConnectionError(null);
      socketRef.current.connect();
      return true;
    }
    return false;
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