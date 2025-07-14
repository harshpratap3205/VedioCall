import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { useSocket } from '../hooks/useSocket';
import { useMedia } from '../hooks/useMedia';
import { usePeerConnection } from '../hooks/usePeerConnection';
import Chat from './Chat';

const VideoContainer = styled.div`
  height: 100vh;
  background: #1a1a1a;
  display: flex;
  flex-direction: column;
  position: relative;
`;

const VideoGrid = styled.div`
  flex: 1;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1rem;
  padding: 1rem;
  overflow: auto;
`;

const VideoCard = styled.div`
  position: relative;
  background: #2a2a2a;
  border-radius: 12px;
  overflow: hidden;
  aspect-ratio: 16/9;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const Video = styled.video`
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: ${props => props.mirrored ? 'scaleX(-1)' : 'none'};
  will-change: transform; /* Optimize GPU rendering */
  transition: opacity 0.2s ease;
  opacity: ${props => props.loading ? 0.5 : 1};
`;

const VideoPlaceholder = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  color: white;
  font-size: 3rem;
`;

const UserLabel = styled.div`
  position: absolute;
  bottom: 10px;
  left: 10px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-size: 0.9rem;
  font-weight: 600;
`;

const Controls = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  padding: 1.5rem;
  background: rgba(0, 0, 0, 0.8);
`;

const ControlButton = styled.button`
  width: 60px;
  height: 60px;
  border-radius: 50%;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  cursor: pointer;
  transition: all 0.3s ease;
  
  &.audio {
    background: ${props => props.active ? '#28a745' : '#dc3545'};
    color: white;
  }
  
  &.video {
    background: ${props => props.active ? '#28a745' : '#dc3545'};
    color: white;
  }
  
  &.hang-up {
    background: #dc3545;
    color: white;
    width: 70px;
    height: 70px;
  }
  
  &.screen-share {
    background: ${props => props.active ? '#007bff' : '#6c757d'};
    color: white;
  }
  
  &:hover {
    transform: scale(1.1);
  }
`;

const RoomInfo = styled.div`
  position: absolute;
  top: 20px;
  left: 20px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 1rem;
  border-radius: 8px;
  z-index: 100;
`;

const ErrorOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: white;
  z-index: 1000;
  padding: 2rem;
  text-align: center;
`;

const ErrorHeading = styled.h3`
  font-size: 1.8rem;
  margin-bottom: 1rem;
  color: #dc3545;
`;

const ErrorMessage = styled.p`
  font-size: 1.2rem;
  margin-bottom: 2rem;
  max-width: 600px;
`;

const RetryButton = styled.button`
  background: #28a745;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-size: 1.1rem;
  cursor: pointer;
  transition: all 0.3s ease;
  
  &:hover {
    background: #218838;
    transform: scale(1.05);
  }
`;

const Toast = styled.div`
  position: fixed;
  top: 20px;
  right: 20px;
  padding: 1rem 1.5rem;
  background: ${props => props.type === 'error' ? '#dc3545' : props.type === 'success' ? '#28a745' : '#17a2b8'};
  color: white;
  border-radius: 8px;
  z-index: 1000;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  animation: slideIn 0.3s ease-out forwards;
  
  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
`;

const UsernameModal = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
`;

const UsernameForm = styled.div`
  background: #2a2a2a;
  border-radius: 12px;
  padding: 2rem;
  width: 90%;
  max-width: 500px;
  text-align: center;
`;

const UsernameInput = styled.input`
  width: 100%;
  padding: 1rem;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  font-size: 1rem;
  margin: 1rem 0;
  backdrop-filter: blur(10px);
  
  &::placeholder {
    color: rgba(255, 255, 255, 0.6);
  }
  
  &:focus {
    outline: none;
    border-color: rgba(255, 255, 255, 0.4);
  }
`;

const UsernameButton = styled.button`
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 1rem 2rem;
  border-radius: 8px;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  
  &:hover {
    transform: scale(1.05);
  }
`;

// Add a diagnostic button to troubleshoot video and audio issues
const DiagnosticButton = styled.button`
  position: absolute;
  bottom: 100px;
  right: 20px;
  background: rgba(0, 0, 0, 0.5);
  color: white;
  border: none;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  font-size: 18px;
  cursor: pointer;
  z-index: 110;
  display: flex;
  align-items: center;
  justify-content: center;
  
  &:hover {
    background: rgba(0, 0, 0, 0.7);
  }
`;

// Diagnostic overlay component
const DiagnosticOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.9);
  color: white;
  padding: 20px;
  z-index: 1000;
  overflow-y: auto;
  font-family: monospace;
`;

const DiagnosticTitle = styled.h2`
  color: #28a745;
  margin-bottom: 20px;
`;

const DiagnosticSection = styled.div`
  margin-bottom: 15px;
  border-bottom: 1px solid #444;
  padding-bottom: 15px;
`;

const DiagnosticClose = styled.button`
  position: absolute;
  top: 15px;
  right: 15px;
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 5px;
  padding: 8px 15px;
  cursor: pointer;
  
  &:hover {
    background: #bd2130;
  }
`;

const DiagnosticItem = styled.div`
  margin-bottom: 8px;
  display: flex;
  
  &.success { color: #28a745; }
  &.warning { color: #ffc107; }
  &.error { color: #dc3545; }
  &.info { color: #17a2b8; }
`;

const VideoCall = () => {
  const { roomId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Get username from location state or use 'Anonymous'
  const [userName, setUserName] = useState('');
  const [showUsernamePrompt, setShowUsernamePrompt] = useState(false);
  const [isUserNameSet, setIsUserNameSet] = useState(false);
  
  // Component lifecycle tracking
  const isMountedRef = useRef(true);
  const hasJoinedRef = useRef(false);
  const hasSetupEventHandlersRef = useRef(false);
  const cleanupInProgressRef = useRef(false);
  
  const [participants, setParticipants] = useState([]);
  const [isConnecting, setIsConnecting] = useState(true);
  const [connectionError, setConnectionError] = useState(null);
  const [toast, setToast] = useState(null);
  const [isMediaReady, setIsMediaReady] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [diagnosticData, setDiagnosticData] = useState(null);
  
  // Custom hooks
  const { socket, isConnected, connectionError: socketError, emit: originalEmit, on, off } = useSocket();
  
  // Create a safe emit function that checks socket connection
  const emit = useCallback((event, data) => {
    if (!socket || !isConnected) {
      console.warn(`Cannot emit ${event}: socket not initialized or not connected`);
      return;
    }
    originalEmit(event, data);
  }, [socket, isConnected, originalEmit]);
  
  const { 
    localStream, 
    localVideoRef, 
    isVideoEnabled, 
    isAudioEnabled,
    isScreenSharing,
    mediaError,
    getUserMedia, 
    toggleVideo, 
    toggleAudio,
    startScreenShare,
    stopScreenShare,
    stopMedia
  } = useMedia(true);
  const { 
    remoteStreams, 
    connectionStatus,
    connectionError: peerError,
    createPeerConnection,
    createOffer,
    handleOffer,
    handleAnswer,
    addIceCandidate,
    closePeerConnection,
    closeAllPeerConnections,
    hasPeerConnection
  } = usePeerConnection();

  const remoteVideoRefs = useRef(new Map());

  // Store handlers in refs to maintain stable identity
  const handlersRef = useRef({
    userJoined: null,
    offer: null,
    answer: null,
    iceCandidate: null,
    userLeft: null,
    joinedRoom: null
  });

  // Show toast notification
  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Track component mount status for safer effect cleanup
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Check if we need to prompt for username
  useEffect(() => {
    // First check if we already have a username in location state
    if (location.state?.userName) {
      setUserName(location.state.userName);
      setIsUserNameSet(true);
      return;
    }
    
    // Try to get username from localStorage (recent rooms)
    try {
      const recentRooms = JSON.parse(localStorage.getItem('recentRooms') || '[]');
      const matchingRoom = recentRooms.find(room => room.id === roomId);
      
      if (matchingRoom && matchingRoom.userName) {
        setUserName(matchingRoom.userName);
        setIsUserNameSet(true);
        return;
      }
    } catch (error) {
      console.error('Error checking recent rooms:', error);
    }
    
    // If we still don't have a username, show the prompt
    setShowUsernamePrompt(true);
  }, [location.state, roomId]);

  // Handle username submission
  const handleUsernameSubmit = () => {
    if (userName.trim()) {
      setIsUserNameSet(true);
      setShowUsernamePrompt(false);
      
      // Save to recent rooms
      try {
        const recentRooms = JSON.parse(localStorage.getItem('recentRooms') || '[]');
        const roomExists = recentRooms.some(room => room.id === roomId);
        
        if (!roomExists) {
          const newRoom = {
            id: roomId,
            userName: userName.trim(),
            timestamp: Date.now()
          };
          
          recentRooms.unshift(newRoom);
          localStorage.setItem('recentRooms', JSON.stringify(recentRooms.slice(0, 5)));
        }
      } catch (error) {
        console.error('Error saving to recent rooms:', error);
      }
    }
  };

  // Initialize room and media - only after username is set
  useEffect(() => {
    // Don't do anything if the socket isn't connected or username isn't set
    if (!socket || !isConnected || !isUserNameSet) {
      console.log("Waiting for socket connection or username...");
      return;
    }
    
    // Check if already initialized or cleanup is in progress to prevent re-joining
    if (hasJoinedRef.current || cleanupInProgressRef.current) {
      console.log("Room already initialized or cleanup in progress, skipping initialization");
      return;
    }
    
    const initializeRoom = async () => {
      try {
        setIsConnecting(true);
        setConnectionError(null);
        
        console.log("Starting room initialization...");
        console.log("Socket connected, joining room:", roomId);
        
        // Socket is connected, so we can safely emit the join event
        emit('join-room', { roomId, userName });
        hasJoinedRef.current = true;
      } catch (error) {
        console.error('Error initializing room:', error);
        setConnectionError(error.message || 'Failed to initialize room');
        hasJoinedRef.current = false;
      } finally {
        if (isMountedRef.current) {
          setIsConnecting(false);
        }
      }
    };

    initializeRoom();

    // Cleanup function
    return () => {
      // Prevent multiple cleanup calls
      if (cleanupInProgressRef.current) return;
      
      if (hasJoinedRef.current && isMountedRef.current) {
        cleanupInProgressRef.current = true;
        console.log("Cleaning up room connection...");
        
        emit('leave-room');
        hasJoinedRef.current = false;
        
        // Reset cleanup flag after a short delay to allow for potential remounts
        setTimeout(() => {
          cleanupInProgressRef.current = false;
        }, 500);
      }
    };
  }, [socket, isConnected, roomId, userName, emit, isUserNameSet]);

  // Initialize media
  useEffect(() => {
    const initializeMedia = async () => {
      if (!localStream) {
        try {
          console.log("Getting user media...");
          await getUserMedia(true, true);
          console.log("Got user media successfully");
          setIsMediaReady(true);
        } catch (error) {
          console.error('Error getting user media:', error);
          setConnectionError(error.message || 'Failed to access camera/microphone');
        }
      } else {
        // Media already initialized
        setIsMediaReady(true);
      }
    };

    initializeMedia();
    
    // Clean up media when component unmounts
    return () => {
      // Only stop media if component is truly unmounting
      if (!isMountedRef.current) {
        setIsMediaReady(false);
      }
    };
  }, [getUserMedia, localStream]);

  // Socket event handlers for WebRTC signaling
  useEffect(() => {
    // Wait for socket connection and media stream
    if (!socket || !isConnected) {
      console.log("WebRTC: Waiting for socket connection...");
      return;
    }
    
    if (!isMediaReady || !localStream) {
      console.log("WebRTC: Waiting for local media stream...");
      return;
    }
    
    // Avoid setting up handlers multiple times
    if (hasSetupEventHandlersRef.current) {
      console.log("WebRTC: Event handlers already set up, skipping");
      return;
    }
    
    console.log("Setting up socket event handlers for WebRTC signaling");
    hasSetupEventHandlersRef.current = true;

    // Update handlers in ref
    handlersRef.current = {
      // User joined the room
      userJoined: ({ userId, userName }) => {
        if (!isMountedRef.current) return;
        
        console.log(`User joined: ${userName} (${userId})`);
        showToast(`${userName} joined the call`);
        
        // Wait a brief moment to ensure media tracks are ready
        setTimeout(() => {
          // Create a peer connection for the new user
          if (localStream) {
            console.log("Creating peer connection for new user:", userId);
            
            const handleIceCandidate = (candidate) => {
              if (socket && isConnected && isMountedRef.current) {
                emit('ice-candidate', { candidate, targetUserId: userId });
              } else {
                console.warn("Cannot send ICE candidate: socket not connected or component unmounted");
              }
            };
            
            // CRITICAL FIX: Create connection and immediately send offer
            createPeerConnection(userId, localStream, handleIceCandidate)
              .then(() => {
                console.log("Peer connection created, creating offer...");
                return createOffer(userId);
              })
              .then(offer => {
                if (offer && isMountedRef.current) {
                  console.log("Sending offer to:", userId);
                  emit('offer', { offer, targetUserId: userId });
                }
              })
              .catch(err => {
                console.error("Error creating peer connection:", err);
                
                // Try again after a short delay if it failed
                setTimeout(() => {
                  if (isMountedRef.current) {
                    console.log("Retrying connection setup for:", userId);
                    createPeerConnection(userId, localStream, handleIceCandidate)
                      .then(() => createOffer(userId))
                      .then(offer => {
                        if (offer && isMountedRef.current) {
                          emit('offer', { offer, targetUserId: userId });
                        }
                      })
                      .catch(retryErr => {
                        console.error("Retry failed:", retryErr);
                      });
                  }
                }, 2000);
              });
          }
        }, 1000); // Short delay to ensure everything is ready
      },
      
      // Handle WebRTC offer
      offer: async ({ offer, fromUserId, fromUserName }) => {
        if (!isMountedRef.current) return;
        
        console.log(`Received offer from: ${fromUserName} (${fromUserId})`);
        
        try {
          const handleIceCandidate = (candidate) => {
            if (socket && isConnected && isMountedRef.current) {
              emit('ice-candidate', { candidate, targetUserId: fromUserId });
            } else {
              console.warn("Cannot send ICE candidate: socket not connected or component unmounted");
            }
          };
          
          // CRITICAL FIX: Ensure we have a clean peer connection
          if (hasPeerConnection(fromUserId)) {
            console.log("Closing existing peer connection before handling offer");
            closePeerConnection(fromUserId);
          }
          
          // Handle the offer and create an answer
          console.log("Creating new peer connection for offer");
          const answer = await handleOffer(fromUserId, offer, localStream, handleIceCandidate);
          
          if (answer && isMountedRef.current) {
            console.log("Sending answer to:", fromUserId);
            emit('answer', { answer, targetUserId: fromUserId });
            
            // Update participants list if needed
            const participantExists = participants.some(p => p.id === fromUserId);
            if (!participantExists) {
              setParticipants(prev => [...prev, { id: fromUserId, name: fromUserName }]);
            }
          }
        } catch (error) {
          console.error("Error handling offer:", error);
          
          // Try again after a short delay
          setTimeout(() => {
            if (isMountedRef.current) {
              try {
                console.log("Retrying offer handling for:", fromUserId);
                const handleIceCandidate = (candidate) => {
                  if (socket && isConnected) {
                    emit('ice-candidate', { candidate, targetUserId: fromUserId });
                  }
                };
                
                handleOffer(fromUserId, offer, localStream, handleIceCandidate)
                  .then(answer => {
                    if (answer) {
                      emit('answer', { answer, targetUserId: fromUserId });
                    }
                  });
              } catch (retryErr) {
                console.error("Retry failed:", retryErr);
              }
            }
          }, 2000);
        }
      },
      
      // Handle WebRTC answer
      answer: ({ answer, fromUserId }) => {
        if (!isMountedRef.current) return;
        
        console.log(`Received answer from: ${fromUserId}`);
        handleAnswer(fromUserId, answer);
      },
      
      // Handle ICE candidates
      iceCandidate: ({ candidate, fromUserId }) => {
        if (!isMountedRef.current) return;
        
        console.log(`Received ICE candidate from: ${fromUserId}`);
        addIceCandidate(fromUserId, candidate);
      },
      
      // User left the room
      userLeft: ({ userId, userName }) => {
        if (!isMountedRef.current) return;
        
        console.log(`User left: ${userName} (${userId})`);
        showToast(`${userName} left the call`);
        
        // Close the peer connection
        closePeerConnection(userId);
        
        // Remove from participants list
        setParticipants(prev => prev.filter(p => p.id !== userId));
      },
      
      // Joined room successfully
      joinedRoom: ({ users }) => {
        if (!isMountedRef.current) return;
        
        console.log('Joined room successfully, existing users:', users);
        setParticipants(users);
        setIsConnecting(false);
      }
    };

    // Set up event listeners using handlers from ref
    on('user-joined', handlersRef.current.userJoined);
    on('offer', handlersRef.current.offer);
    on('answer', handlersRef.current.answer);
    on('ice-candidate', handlersRef.current.iceCandidate);
    on('user-left', handlersRef.current.userLeft);
    on('joined-room', handlersRef.current.joinedRoom);

    return () => {
      // Only clean up if we set up the handlers and component is unmounting for real
      if (hasSetupEventHandlersRef.current && !isMountedRef.current) {
        console.log("Cleaning up WebRTC event handlers");
        off('user-joined', handlersRef.current.userJoined);
        off('offer', handlersRef.current.offer);
        off('answer', handlersRef.current.answer);
        off('ice-candidate', handlersRef.current.iceCandidate);
        off('user-left', handlersRef.current.userLeft);
        off('joined-room', handlersRef.current.joinedRoom);
        
        hasSetupEventHandlersRef.current = false;
      }
    };
  }, [socket, isConnected, localStream, isMediaReady, emit, createPeerConnection, createOffer, handleOffer, handleAnswer, addIceCandidate, closePeerConnection, hasPeerConnection, participants]);

  // Log important state changes
  useEffect(() => {
    if (isMediaReady && localStream) {
      console.log("✅ Media is ready and stream available:", localStream.id);
    }
  }, [isMediaReady, localStream]);

  useEffect(() => {
    if (socket && isConnected) {
      console.log("✅ Socket connected:", socket.id);
    }
  }, [socket, isConnected]);

  // Effect to handle errors from hooks
  useEffect(() => {
    if (socketError) {
      setConnectionError(`Server connection error: ${socketError}`);
      console.error("❌ Socket error:", socketError);
    } else if (mediaError) {
      setConnectionError(`Media error: ${mediaError}`);
      console.error("❌ Media error:", mediaError);
    } else if (peerError) {
      setConnectionError(`Connection error: ${peerError}`);
      console.error("❌ Peer connection error:", peerError);
    }
  }, [socketError, mediaError, peerError]);

  // Handle toggle audio
  const handleToggleAudio = () => {
    toggleAudio();
    emit('audio-toggle', { isEnabled: !isAudioEnabled });
  };

  // Handle toggle video
  const handleToggleVideo = () => {
    toggleVideo();
    emit('video-toggle', { isEnabled: !isVideoEnabled });
  };

  // Handle toggle screen share
  const handleToggleScreenShare = async () => {
    try {
      if (isScreenSharing) {
        stopScreenShare();
      } else {
        const screenStream = await startScreenShare();
        if (screenStream) {
          // Update the video track for all peer connections
          Object.keys(connectionStatus).forEach(peerId => {
            // Get the video track from the screen share stream
            const videoTrack = screenStream.getVideoTracks()[0];
            if (videoTrack) {
              // Get peer connection from the WebRTC hook
              const senders = [];
              try {
                // Use the connection status to find active connections
                if (connectionStatus[peerId] === 'connected') {
                  // Replace video track directly in remoteStreams
                  Object.values(remoteStreams).forEach(remoteStream => {
                    const videoTracks = remoteStream.getVideoTracks();
                    if (videoTracks.length > 0) {
                      videoTracks[0].stop();
                      remoteStream.removeTrack(videoTracks[0]);
                      remoteStream.addTrack(videoTrack);
                    }
                  });
                }
              } catch (err) {
                console.error('Error replacing video track:', err);
              }
            }
          });
        }
      }
    } catch (error) {
      console.error('Error toggling screen share:', error);
      showToast('Failed to share screen', 'error');
    }
  };

  // Hang up and leave the call
  const hangUp = () => {
    emit('leave-room');
    stopMedia();
    closeAllPeerConnections();
    navigate('/');
  };

  // Copy room ID to clipboard
  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    showToast('Room ID copied to clipboard', 'success');
  };

  // Handle copy meeting link
  const copyMeetingLink = () => {
    const url = `${window.location.origin}/video/${roomId}`;
    navigator.clipboard.writeText(url)
      .then(() => {
        showToast('Meeting link copied to clipboard!', 'success');
      })
      .catch(err => {
        console.error('Failed to copy:', err);
        showToast('Failed to copy link', 'error');
      });
  };

  // Run diagnostics to troubleshoot video/audio issues
  const runDiagnostics = async () => {
    setDiagnosticData(null);
    setShowDiagnostics(true);
    
    // Force refresh of connection info
    const currentConnectionStatus = { ...connectionStatus };
    const currentRemoteStreams = { ...remoteStreams };
    
    // Check browser audio output settings
    let audioOutputDevice = "Default";
    try {
      const audioDevices = await navigator.mediaDevices.enumerateDevices();
      const outputs = audioDevices.filter(d => d.kind === 'audiooutput');
      if (outputs.length > 0) {
        outputs.forEach(device => {
          console.log(`Available audio output: ${device.label}`);
        });
      }
    } catch (err) {
      console.error("Error checking audio devices:", err);
    }
    
    // Try to force unmute remote audio tracks
    Object.entries(currentRemoteStreams).forEach(([id, stream]) => {
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length > 0) {
        console.log(`Ensuring audio track for ${id} is enabled`);
        audioTracks.forEach(track => {
          track.enabled = true;
        });
      }
    });
    
    const data = {
      browser: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        vendor: navigator.vendor,
        webrtcSupport: !!window.RTCPeerConnection,
        mediaDevicesSupport: !!navigator.mediaDevices?.getUserMedia,
        audioContext: !!(window.AudioContext || window.webkitAudioContext),
        audioOutput: audioOutputDevice
      },
      socket: {
        connected: isConnected,
        socketId: socket?.id || 'Not connected',
        error: socketError || 'None'
      },
      media: {
        localStream: localStream ? {
          id: localStream.id,
          active: localStream.active,
          audioTracks: localStream.getAudioTracks().map(t => ({
            id: t.id,
            label: t.label,
            enabled: t.enabled,
            muted: t.muted,
            readyState: t.readyState,
            settings: t.getSettings()
          })),
          videoTracks: localStream.getVideoTracks().map(t => ({
            id: t.id,
            label: t.label,
            enabled: t.enabled,
            muted: t.muted,
            readyState: t.readyState
          }))
        } : 'No local stream',
        error: mediaError || 'None'
      },
      room: {
        id: roomId,
        participants: participants.length,
        joined: hasJoinedRef.current
      },
      peers: {
        connections: Object.keys(currentConnectionStatus).length,
        status: currentConnectionStatus,
        remoteStreams: Object.entries(currentRemoteStreams).map(([id, stream]) => ({
          id,
          audioTracks: stream.getAudioTracks().length,
          audioEnabled: stream.getAudioTracks().length > 0 ? 
            stream.getAudioTracks()[0].enabled : false,
          audioSettings: stream.getAudioTracks().length > 0 ? 
            stream.getAudioTracks()[0].getSettings() : null,
          videoTracks: stream.getVideoTracks().length,
          active: stream.active
        }))
      }
    };
    
    setDiagnosticData(data);
    
    // Attempt to fix common audio issues
    if (Object.entries(currentRemoteStreams).length > 0) {
      Object.entries(currentRemoteStreams).forEach(([id, stream]) => {
        const audioTracks = stream.getAudioTracks();
        if (audioTracks.length === 0) {
          console.warn(`No audio tracks found for peer ${id} - possible connection issue`);
        } else {
          // Try to unmute audio tracks
          audioTracks.forEach(track => {
            console.log(`Ensuring audio track is enabled for ${id}`);
            track.enabled = true;
          });
          
          // Force the audio element to unmute (if in the video element)
          const videoElements = document.querySelectorAll('video');
          videoElements.forEach(video => {
            if (video.srcObject === stream && video !== localVideoRef.current) {
              console.log(`Ensuring remote video element is not muted`);
              video.muted = false;
              video.volume = 1.0;
              
              // Try to play if paused
              if (video.paused) {
                video.play().catch(e => console.log("Could not auto-play video:", e));
              }
            }
          });
        }
      });
    }
  };
  
  // Format diagnostic data for display
  const renderDiagnostics = () => {
    if (!diagnosticData) return <p>Loading diagnostics...</p>;
    
    return (
      <>
        <DiagnosticTitle>WebRTC Diagnostics</DiagnosticTitle>
        
        <DiagnosticSection>
          <h3>Browser</h3>
          <DiagnosticItem className={diagnosticData.browser.webrtcSupport ? "success" : "error"}>
            WebRTC Support: {diagnosticData.browser.webrtcSupport ? "✅ Yes" : "❌ No"}
          </DiagnosticItem>
          <DiagnosticItem className={diagnosticData.browser.mediaDevicesSupport ? "success" : "error"}>
            Media Devices API: {diagnosticData.browser.mediaDevicesSupport ? "✅ Yes" : "❌ No"}
          </DiagnosticItem>
          <DiagnosticItem className="info">User Agent: {diagnosticData.browser.userAgent}</DiagnosticItem>
        </DiagnosticSection>
        
        <DiagnosticSection>
          <h3>Socket Connection</h3>
          <DiagnosticItem className={diagnosticData.socket.connected ? "success" : "error"}>
            Connected: {diagnosticData.socket.connected ? "✅ Yes" : "❌ No"}
          </DiagnosticItem>
          <DiagnosticItem className="info">Socket ID: {diagnosticData.socket.socketId}</DiagnosticItem>
          <DiagnosticItem className={diagnosticData.socket.error === 'None' ? "success" : "error"}>
            Error: {diagnosticData.socket.error}
          </DiagnosticItem>
        </DiagnosticSection>
        
        <DiagnosticSection>
          <h3>Media Status</h3>
          {typeof diagnosticData.media.localStream === 'string' ? (
            <DiagnosticItem className="error">{diagnosticData.media.localStream}</DiagnosticItem>
          ) : (
            <>
              <DiagnosticItem className="info">Stream ID: {diagnosticData.media.localStream.id}</DiagnosticItem>
              <DiagnosticItem className={diagnosticData.media.localStream.active ? "success" : "error"}>
                Stream Active: {diagnosticData.media.localStream.active ? "✅ Yes" : "❌ No"}
              </DiagnosticItem>
              
              <h4>Audio Tracks ({diagnosticData.media.localStream.audioTracks.length})</h4>
              {diagnosticData.media.localStream.audioTracks.length === 0 ? (
                <DiagnosticItem className="error">❌ No audio tracks found</DiagnosticItem>
              ) : (
                diagnosticData.media.localStream.audioTracks.map((track, i) => (
                  <div key={`audio-${i}`}>
                    <DiagnosticItem className={track.enabled ? "success" : "error"}>
                      Enabled: {track.enabled ? "✅ Yes" : "❌ No"}
                    </DiagnosticItem>
                    <DiagnosticItem className={track.muted ? "error" : "success"}>
                      Muted: {track.muted ? "❌ Yes" : "✅ No"}
                    </DiagnosticItem>
                    <DiagnosticItem className="info">Label: {track.label}</DiagnosticItem>
                  </div>
                ))
              )}
              
              <h4>Video Tracks ({diagnosticData.media.localStream.videoTracks.length})</h4>
              {diagnosticData.media.localStream.videoTracks.length === 0 ? (
                <DiagnosticItem className="error">❌ No video tracks found</DiagnosticItem>
              ) : (
                diagnosticData.media.localStream.videoTracks.map((track, i) => (
                  <div key={`video-${i}`}>
                    <DiagnosticItem className={track.enabled ? "success" : "error"}>
                      Enabled: {track.enabled ? "✅ Yes" : "❌ No"}
                    </DiagnosticItem>
                    <DiagnosticItem className={track.muted ? "error" : "success"}>
                      Muted: {track.muted ? "❌ Yes" : "✅ No"}
                    </DiagnosticItem>
                    <DiagnosticItem className="info">Label: {track.label}</DiagnosticItem>
                  </div>
                ))
              )}
            </>
          )}
        </DiagnosticSection>
        
        <DiagnosticSection>
          <h3>Remote Peers</h3>
          <DiagnosticItem className="info">
            Total Connections: {diagnosticData.peers.connections}
          </DiagnosticItem>
          
          <h4>Remote Streams</h4>
          {diagnosticData.peers.remoteStreams.length === 0 ? (
            <DiagnosticItem className="error">❌ No remote streams found</DiagnosticItem>
          ) : (
            diagnosticData.peers.remoteStreams.map((stream, i) => (
              <div key={`stream-${i}`} style={{marginBottom: '10px'}}>
                <DiagnosticItem className={stream.active ? "success" : "error"}>
                  Stream {i+1} Active: {stream.active ? "✅ Yes" : "❌ No"}
                </DiagnosticItem>
                <DiagnosticItem className={stream.audioTracks > 0 ? "success" : "error"}>
                  Audio Tracks: {stream.audioTracks || "❌ None"}
                </DiagnosticItem>
                <DiagnosticItem className={stream.videoTracks > 0 ? "success" : "error"}>
                  Video Tracks: {stream.videoTracks || "❌ None"}
                </DiagnosticItem>
              </div>
            ))
          )}
          
          <h4>Connection Status</h4>
          {Object.entries(diagnosticData.peers.status).map(([peerId, status]) => (
            <DiagnosticItem 
              key={peerId}
              className={status === 'connected' ? 'success' : status === 'connecting' ? 'warning' : 'error'}
            >
              Peer {peerId.slice(0, 6)}: {status}
            </DiagnosticItem>
          ))}
        </DiagnosticSection>
        
        <DiagnosticSection>
          <h3>Troubleshooting</h3>
          
          {!diagnosticData.socket.connected && (
            <DiagnosticItem className="error">
              ❌ Socket not connected. Check your internet connection and try refreshing the page.
            </DiagnosticItem>
          )}
          
          {typeof diagnosticData.media.localStream === 'string' && (
            <DiagnosticItem className="error">
              ❌ Local media stream not available. Try allowing camera and microphone permissions.
            </DiagnosticItem>
          )}
          
          {diagnosticData.media.localStream && diagnosticData.media.localStream.audioTracks.length === 0 && (
            <DiagnosticItem className="error">
              ❌ No audio track found. Check if your microphone is properly connected and not used by another application.
            </DiagnosticItem>
          )}
          
          {diagnosticData.media.localStream && diagnosticData.media.localStream.videoTracks.length === 0 && (
            <DiagnosticItem className="error">
              ❌ No video track found. Check if your camera is properly connected and not used by another application.
            </DiagnosticItem>
          )}
          
          {diagnosticData.peers.remoteStreams.length === 0 && diagnosticData.room.participants > 0 && (
            <DiagnosticItem className="error">
              ❌ No remote streams despite having participants. WebRTC connection may have failed.
            </DiagnosticItem>
          )}
          
          {diagnosticData.peers.remoteStreams.some(s => s.audioTracks === 0) && (
            <DiagnosticItem className="error">
              ❌ Remote stream missing audio tracks. The other user may have microphone issues.
            </DiagnosticItem>
          )}
        </DiagnosticSection>
      </>
    );
  };

  // Video component to handle rendering and stability
  const VideoComponent = React.memo(({ userId, stream, name }) => {
    const videoRef = useRef(null);
    const [isLoading, setIsLoading] = useState(true);
    const [hasVideo, setHasVideo] = useState(false);
    const [videoPlayError, setVideoPlayError] = useState(null);
    
    // Debug stream contents
    useEffect(() => {
      if (stream) {
        const videoTracks = stream.getVideoTracks();
        const audioTracks = stream.getAudioTracks();
        console.log(`Stream for ${userId} has ${videoTracks.length} video tracks and ${audioTracks.length} audio tracks`);
        
        if (videoTracks.length > 0) {
          console.log(`Video track enabled: ${videoTracks[0].enabled}, muted: ${videoTracks[0].muted}, readyState: ${videoTracks[0].readyState}`);
          setHasVideo(true);
        } else {
          setHasVideo(false);
        }
        
        if (audioTracks.length > 0) {
          console.log(`Audio track enabled: ${audioTracks[0].enabled}, muted: ${audioTracks[0].muted}, readyState: ${audioTracks[0].readyState}`);
        }
      }
    }, [stream, userId]);
    
    // Attach stream to video element with improved handling
    useEffect(() => {
      if (!stream || !videoRef.current) {
        setHasVideo(false);
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
        return;
      }
      
      console.log(`Setting up video for ${userId} with stream:`, stream.id);
      
      // CRITICAL FIX: Create a fresh MediaStream to avoid issues
      try {
        // For remote streams, create a completely new MediaStream with the tracks
        if (userId !== 'local') {
          const newStream = new MediaStream();
          
          // Add all tracks from the original stream to the new one
          stream.getTracks().forEach(track => {
            console.log(`Adding ${track.kind} track to new stream for ${userId}`);
            newStream.addTrack(track);
            
            // Ensure track is enabled
            track.enabled = true;
          });
          
          // Attach the new stream to video element
          videoRef.current.srcObject = newStream;
        } else {
          // For local stream, use it directly
          videoRef.current.srcObject = stream;
        }
        
        // Force play if autoplay doesn't work
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(err => {
            console.warn(`Could not autoplay video for ${userId}:`, err.message);
            setVideoPlayError(`Video playback failed. Click the video to play manually.`);
            
            // Add a click handler to play on user interaction
            if (userId !== 'local') {
              videoRef.current.addEventListener('click', function playOnClick() {
                videoRef.current.play()
                  .then(() => {
                    setVideoPlayError(null);
                  })
                  .catch((e) => {
                    console.error("Play failed after click:", e);
                  });
              });
            }
          });
        }
      } catch (err) {
        console.error(`Error attaching stream for ${userId}:`, err);
      }
      
      // Add a periodic check to ensure remote videos are playing
      if (userId !== 'local') {
        const checkInterval = setInterval(() => {
          if (videoRef.current && videoRef.current.paused) {
            console.log(`Remote video for ${userId} is paused, attempting to play`);
            videoRef.current.play().catch(err => {
              console.warn(`Auto-play retry failed: ${err.message}`);
            });
          }
        }, 5000);
        
        return () => clearInterval(checkInterval);
      }
    }, [stream, userId]);
    
    // Handle video loading
    const handleVideoLoaded = () => {
      setIsLoading(false);
      console.log(`Video loaded for ${userId}`);
      
      // Double check audio output
      if (stream && userId !== 'local') {
        const audioTracks = stream.getAudioTracks();
        console.log(`Audio tracks for ${userId}:`, audioTracks.length, 
                   audioTracks.map(t => `${t.label} (enabled: ${t.enabled})`));
                   
        // Ensure video is not muted for remote streams
        if (videoRef.current) {
          videoRef.current.muted = false;
          videoRef.current.volume = 1.0;
        }
      }
    };
    
    // Force play for remote videos
    const handleManualPlay = () => {
      if (videoRef.current && userId !== 'local') {
        videoRef.current.muted = false;
        videoRef.current.volume = 1.0;
        videoRef.current.play()
          .then(() => setVideoPlayError(null))
          .catch(err => console.error("Manual play failed:", err));
      }
    };
    
    return (
      <VideoCard>
        {stream ? (
          <>
            <Video
              ref={videoRef}
              autoPlay
              playsInline
              controls={userId !== 'local'} // Add controls for remote videos
              muted={userId === 'local'} // Only mute local video
              loading={isLoading}
              mirrored={userId === 'local'}
              onLoadedMetadata={handleVideoLoaded}
              onClick={handleManualPlay}
              style={{
                display: 'block', // Always show the video element
                width: '100%',
                height: '100%',
                objectFit: 'cover'
              }}
            />
            {videoPlayError && userId !== 'local' && (
              <div style={{
                position: 'absolute',
                bottom: '40px',
                left: '10px',
                right: '10px',
                background: 'rgba(0,0,0,0.7)',
                color: 'white',
                padding: '5px',
                borderRadius: '4px',
                fontSize: '12px',
                textAlign: 'center'
              }}>
                {videoPlayError}
              </div>
            )}
            {(!hasVideo || isLoading) && (
              <VideoPlaceholder>
                {name?.charAt(0)?.toUpperCase() || '?'}
              </VideoPlaceholder>
            )}
          </>
        ) : (
          <VideoPlaceholder>
            {name?.charAt(0)?.toUpperCase() || '?'}
          </VideoPlaceholder>
        )}
        <UserLabel>{name || 'Unknown'}</UserLabel>
      </VideoCard>
    );
  });

  // Final cleanup when component unmounts for real
  useEffect(() => {
    // Add event listener for beforeunload to properly close connections
    const handleBeforeUnload = () => {
      console.log("Page unloading - cleaning up connections");
      
      // Leave the room
      emit('leave-room');
      
      // Stop all tracks
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      
      closeAllPeerConnections();
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      // This will only run when the component is truly unmounting
      window.removeEventListener('beforeunload', handleBeforeUnload);
      
      if (!isMountedRef.current) {
        console.log("Component unmounting - final cleanup");
        
        // Clean up all peer connections
        closeAllPeerConnections();
        
        // Leave the room if needed
        if (hasJoinedRef.current) {
          console.log("Leaving room on unmount");
          emit('leave-room');
          hasJoinedRef.current = false;
        }
      }
    };
  }, [emit, closeAllPeerConnections, localStream]);

  // Render username prompt
  if (showUsernamePrompt) {
    return (
      <UsernameModal>
        <UsernameForm>
          <h2 style={{ color: 'white', marginBottom: '1rem' }}>Enter Your Name</h2>
          <p style={{ color: '#ccc', marginBottom: '1.5rem' }}>
            Please enter your name to join the video call
          </p>
          <UsernameInput
            type="text"
            placeholder="Your Name"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleUsernameSubmit()}
            autoFocus
          />
          <UsernameButton 
            onClick={handleUsernameSubmit}
            disabled={!userName.trim()}
          >
            Join Call
          </UsernameButton>
        </UsernameForm>
      </UsernameModal>
    );
  }

  return (
    <VideoContainer>
      {/* Room info */}
      <RoomInfo>
        <div>Room: {roomId} <button onClick={copyRoomId}>Copy</button></div>
        <div>Participants: {participants.length + 1}</div>
      </RoomInfo>
      
      {/* Video grid */}
      <VideoGrid>
        {/* Local video */}
        <VideoComponent 
          key="local"
          userId="local" 
          stream={localStream} 
          name={`${userName} (You)`} 
        />
        
        {/* Remote videos */}
        {Object.entries(remoteStreams).map(([userId, stream]) => {
          const participant = participants.find(p => p.id === userId) || { name: "Unknown User" };
          return (
            <VideoComponent 
              key={userId}
              userId={userId} 
              stream={stream} 
              name={participant?.name} 
            />
          );
        })}
      </VideoGrid>
      
      {/* Controls */}
      <Controls>
        <ControlButton 
          className="audio" 
          active={isAudioEnabled}
          onClick={handleToggleAudio}
        >
          {isAudioEnabled ? '🎙️' : '🔇'}
        </ControlButton>
        
        <ControlButton 
          className="video" 
          active={isVideoEnabled}
          onClick={handleToggleVideo}
        >
          {isVideoEnabled ? '📹' : '🚫'}
        </ControlButton>
        
        <ControlButton 
          className="hang-up"
          onClick={hangUp}
        >
          📞
        </ControlButton>
        
        <ControlButton 
          className="screen-share"
          active={isScreenSharing}
          onClick={handleToggleScreenShare}
        >
          {isScreenSharing ? '💻' : '🖥️'}
        </ControlButton>
        <ControlButton
          onClick={copyMeetingLink}
          style={{ background: '#17a2b8' }}
          title="Copy Meeting Link"
        >
          🔗
        </ControlButton>
      </Controls>
      
      {/* Chat component - pass socket prop to enable messaging */}
      <Chat socket={socket} roomId={roomId} userName={userName} />
      
      {/* Error overlay */}
      {connectionError && (
        <ErrorOverlay>
          <ErrorHeading>Connection Error</ErrorHeading>
          <ErrorMessage>{connectionError}</ErrorMessage>
          <RetryButton onClick={() => window.location.reload()}>Try Again</RetryButton>
        </ErrorOverlay>
      )}
      
      {/* Loading indicator */}
      {isConnecting && !connectionError && (
        <ErrorOverlay>
          <ErrorHeading>Connecting...</ErrorHeading>
          <ErrorMessage>Setting up your video call</ErrorMessage>
        </ErrorOverlay>
      )}
      
      {/* Toast notification */}
      {toast && (
        <Toast type={toast.type}>{toast.message}</Toast>
      )}
      
      {/* Diagnostic button and overlay */}
      <DiagnosticButton onClick={runDiagnostics} title="Diagnostics">
        🔧
      </DiagnosticButton>
      
      {showDiagnostics && (
        <DiagnosticOverlay>
          {renderDiagnostics()}
          <DiagnosticClose onClick={() => setShowDiagnostics(false)}>Close</DiagnosticClose>
        </DiagnosticOverlay>
      )}
    </VideoContainer>
  );
};

export default VideoCall; 