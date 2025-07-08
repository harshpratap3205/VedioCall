import { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';

const SERVER_URL = process.env.REACT_APP_SERVER_URL || 'http://localhost:5000';

export const useSocket = () => {
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  useEffect(() => {
    // Clear any existing errors
    setConnectionError(null);

    console.log('Attempting to connect to server at:', SERVER_URL);

    try {
      // Create socket connection with more robust options
      socketRef.current = io(SERVER_URL, {
        transports: ['websocket', 'polling'],
        reconnectionAttempts: maxReconnectAttempts,
        reconnectionDelay: 1000,
        timeout: 10000
      });

      const socket = socketRef.current;

      // Connection event handlers
      socket.on('connect', () => {
        console.log('Connected to server:', socket.id);
        setIsConnected(true);
        setConnectionError(null);
        reconnectAttempts.current = 0;
        
        // Send heartbeat every minute to keep connection alive
        const heartbeatInterval = setInterval(() => {
          if (socket.connected) {
            socket.emit('heartbeat');
          }
        }, 60000);
        
        // Handle server pings to measure latency
        socket.on('ping', (data) => {
          socket.emit('pong', data);
        });
        
        // Handle latency information
        socket.on('latency', (data) => {
          console.log(`Current connection latency: ${data.value}ms`);
        });
        
        // Handle connection warnings
        socket.on('connection-warning', (warning) => {
          console.warn(`Connection warning: ${warning.message} (${warning.value}ms)`);
          
          // If we have high latency, reduce video quality
          if (warning.type === 'high-latency' && warning.value > 300) {
            document.dispatchEvent(new CustomEvent('reduce-video-quality', { 
              detail: { latency: warning.value }
            }));
          }
        });
        
        return () => {
          clearInterval(heartbeatInterval);
          socket.off('ping');
          socket.off('latency');
          socket.off('connection-warning');
        };
      });

      socket.on('disconnect', (reason) => {
        console.log('Disconnected from server. Reason:', reason);
        setIsConnected(false);
        
        if (reason === 'io server disconnect') {
          // The server has forcefully disconnected the socket
          console.log('Server disconnected the socket. Attempting to reconnect...');
          socket.connect();
        }
      });

      socket.on('connect_error', (error) => {
        reconnectAttempts.current++;
        console.error(`Connection error (attempt ${reconnectAttempts.current}/${maxReconnectAttempts}):`, error.message);
        setConnectionError(`Failed to connect to server: ${error.message}. Attempt ${reconnectAttempts.current} of ${maxReconnectAttempts}`);
        setIsConnected(false);
        
        if (reconnectAttempts.current >= maxReconnectAttempts) {
          console.error('Max reconnection attempts reached. Please check your connection and try again later.');
          socket.disconnect();
        }
      });
      
      socket.on('reconnect', (attemptNumber) => {
        console.log('Reconnected to server after', attemptNumber, 'attempts');
        setIsConnected(true);
        setConnectionError(null);
      });

      socket.on('reconnect_error', (error) => {
        console.error('Reconnection error:', error);
      });

      socket.on('error', (error) => {
        console.error('Socket error:', error);
        setConnectionError(`Socket error: ${error.message}`);
      });

      // Cleanup on unmount
      return () => {
        console.log('Cleaning up socket connection');
        if (socket) {
          socket.disconnect();
          socketRef.current = null;
        }
      };
    } catch (error) {
      console.error('Failed to initialize socket:', error);
      setConnectionError(`Failed to initialize socket: ${error.message}`);
      return () => {};
    }
  }, []);

  // Helper functions
  const emit = (event, data) => {
    if (!socketRef.current) {
      console.error('Cannot emit event: socket not initialized');
      return;
    }

    try {
      socketRef.current.emit(event, data);
    } catch (error) {
      console.error(`Error emitting ${event}:`, error);
    }
  };

  const on = (event, callback) => {
    if (!socketRef.current) {
      console.error('Cannot add event listener: socket not initialized');
      return;
    }

    socketRef.current.on(event, callback);
  };

  const off = (event, callback) => {
    if (!socketRef.current) {
      console.error('Cannot remove event listener: socket not initialized');
      return;
    }

    socketRef.current.off(event, callback);
  };

  const reconnect = () => {
    if (socketRef.current) {
      reconnectAttempts.current = 0;
      setConnectionError(null);
      console.log('Attempting to reconnect...');
      socketRef.current.connect();
    }
  };

  return {
    socket: socketRef.current,
    isConnected,
    connectionError,
    emit,
    on,
    off,
    reconnect
  };
}; 