import React, { useState, useEffect, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { useSocket } from '../hooks/useSocket';
import { useMedia } from '../hooks/useMedia';
import { usePeerConnection } from '../hooks/usePeerConnection';
import Chat from './Chat';

const AudioContainer = styled.div`
  height: 100vh;
  background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
  display: flex;
  flex-direction: column;
  position: relative;
`;

const ParticipantsGrid = styled.div`
  flex: 1;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 2rem;
  padding: 2rem;
  align-items: center;
  justify-items: center;
`;

const ParticipantCard = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  min-width: 180px;
  transition: all 0.3s ease;
  
  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  }
`;

const Avatar = styled.div`
  width: 100px;
  height: 100px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 3rem;
  margin-bottom: 1rem;
  position: relative;
  
  ${props => props.isSpeaking && `
    animation: pulse 1.5s infinite;
    box-shadow: 0 0 30px rgba(102, 126, 234, 0.6);
  `}
  
  @keyframes pulse {
    0% { box-shadow: 0 0 30px rgba(102, 126, 234, 0.6); }
    50% { box-shadow: 0 0 50px rgba(102, 126, 234, 0.8); }
    100% { box-shadow: 0 0 30px rgba(102, 126, 234, 0.6); }
  }
`;

const ParticipantName = styled.div`
  color: white;
  font-weight: 600;
  font-size: 1.1rem;
  text-align: center;
  margin-bottom: 0.5rem;
`;

const ParticipantStatus = styled.div`
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const Controls = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1.5rem;
  padding: 2rem;
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(10px);
`;

const ControlButton = styled.button`
  width: 70px;
  height: 70px;
  border-radius: 50%;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.8rem;
  cursor: pointer;
  transition: all 0.3s ease;
  
  &.audio {
    background: ${props => props.active ? '#28a745' : '#dc3545'};
    color: white;
  }
  
  &.hang-up {
    background: #dc3545;
    color: white;
    width: 80px;
    height: 80px;
    font-size: 2rem;
  }
  
  &.settings {
    background: #6c757d;
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
  background: rgba(0, 0, 0, 0.5);
  color: white;
  padding: 1rem 1.5rem;
  border-radius: 12px;
  z-index: 100;
  backdrop-filter: blur(10px);
`;

const CenterInfo = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  color: white;
  z-index: 10;
  pointer-events: none;
`;

const RoomTitle = styled.h1`
  font-size: 2.5rem;
  margin-bottom: 1rem;
  opacity: 0.9;
`;

const RoomSubtitle = styled.p`
  font-size: 1.2rem;
  opacity: 0.7;
`;

const AudioCall = () => {
  const { roomId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [participants, setParticipants] = useState([]);
  const [userName] = useState(location.state?.userName || 'Anonymous');
  const [speakingParticipants, setSpeakingParticipants] = useState(new Set());
  const [isConnecting, setIsConnecting] = useState(true);
  const [connectionError, setConnectionError] = useState(null);
  const [toast, setToast] = useState(null);
  
  // Audio level detection
  const audioAnalysersRef = useRef(new Map());
  const audioContextRef = useRef(null);
  
  // Custom hooks
  const { socket, isConnected, connectionError: socketError, emit, on, off } = useSocket();
  const { 
    localStream, 
    isAudioEnabled, 
    mediaError,
    getUserMedia, 
    toggleAudio, 
    stopMedia
  } = useMedia(false); // Audio-only call
  
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
    closeAllPeerConnections
  } = usePeerConnection();

  // Show toast notification
  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };
  
  // Initialize room and media
  useEffect(() => {
    const initializeRoom = async () => {
      try {
        setIsConnecting(true);
        setConnectionError(null);
        
        console.log("Starting audio call initialization for room:", roomId);
        
        // Get user media first (audio only)
        console.log("Requesting audio access...");
        await getUserMedia(false, true);
        console.log("Audio access granted:", localStream);
        
        // Join room when socket is connected
        if (socket && isConnected) {
          console.log("Socket connected, joining room:", roomId);
          emit('join-room', { roomId, userName, roomType: 'audio' });
        } else {
          console.error("Socket not connected!");
          setConnectionError('Not connected to server. Please check your internet connection and try again.');
        }
      } catch (error) {
        console.error('Error initializing audio room:', error);
        setConnectionError(error.message || 'Failed to access microphone');
      } finally {
        setIsConnecting(false);
      }
    };

    if (isConnected) {
      console.log("Socket connected, initializing audio room...");
      initializeRoom();
    } else {
      console.log("Waiting for socket connection...");
    }
    
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(console.error);
      }
    };
  }, [socket, isConnected, roomId, userName, getUserMedia, emit, localStream]);

  // Setup audio analysis when streams change
  useEffect(() => {
    if (!localStream) return;
    
    // Initialize AudioContext if not already created
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    // Setup audio analyser for local stream
    setupAudioAnalyser(localStream, 'self');
    
    // Setup audio analysers for all remote streams
    Object.entries(remoteStreams).forEach(([userId, stream]) => {
      setupAudioAnalyser(stream, userId);
    });
    
    // Start detecting speaking
    const intervalId = setInterval(detectSpeaking, 100);
    
    return () => {
      clearInterval(intervalId);
    };
  }, [localStream, remoteStreams]);
  
  // Socket event handlers for WebRTC signaling
  useEffect(() => {
    if (!socket || !isConnected) return;
    
    console.log("Setting up socket event handlers for WebRTC signaling");

    // User joined the room
    on('user-joined', ({ userId, userName }) => {
      console.log(`User joined: ${userName} (${userId})`);
      showToast(`${userName} joined the call`);
      
      // Create a peer connection for the new user
      if (localStream) {
        console.log("Creating peer connection for new user:", userId);
        
        const handleIceCandidate = (candidate) => {
          emit('ice-candidate', { candidate, targetUserId: userId });
        };
        
        createPeerConnection(userId, localStream, handleIceCandidate)
          .then(() => {
            // Create and send an offer
            return createOffer(userId);
          })
          .then(offer => {
            if (offer) {
              console.log("Sending offer to:", userId);
              emit('offer', { offer, targetUserId: userId });
            }
          })
          .catch(err => {
            console.error("Error creating peer connection:", err);
          });
      }
    });

    // Handle WebRTC offer
    on('offer', async ({ offer, fromUserId, fromUserName }) => {
      console.log(`Received offer from: ${fromUserName} (${fromUserId})`);
      
      try {
        const handleIceCandidate = (candidate) => {
          emit('ice-candidate', { candidate, targetUserId: fromUserId });
        };
        
        // Handle the offer and create an answer
        const answer = await handleOffer(fromUserId, offer, localStream, handleIceCandidate);
        
        if (answer) {
          console.log("Sending answer to:", fromUserId);
          emit('answer', { answer, targetUserId: fromUserId });
        }
      } catch (error) {
        console.error("Error handling offer:", error);
      }
    });

    // Handle WebRTC answer
    on('answer', ({ answer, fromUserId }) => {
      console.log(`Received answer from: ${fromUserId}`);
      handleAnswer(fromUserId, answer);
    });

    // Handle ICE candidates
    on('ice-candidate', ({ candidate, fromUserId }) => {
      console.log(`Received ICE candidate from: ${fromUserId}`);
      addIceCandidate(fromUserId, candidate);
    });

    // User left the room
    on('user-left', ({ userId, userName }) => {
      console.log(`User left: ${userName} (${userId})`);
      showToast(`${userName} left the call`);
      
      // Close the peer connection
      closePeerConnection(userId);
      
      // Remove from participants list
      setParticipants(prev => prev.filter(p => p.id !== userId));
      
      // Remove from speaking participants
      setSpeakingParticipants(prev => {
        const updated = new Set(prev);
        updated.delete(userId);
        return updated;
      });
      
      // Clean up audio analyser
      if (audioAnalysersRef.current.has(userId)) {
        const { source } = audioAnalysersRef.current.get(userId);
        source?.disconnect();
        audioAnalysersRef.current.delete(userId);
      }
    });

    // Joined room successfully
    on('joined-room', ({ users }) => {
      console.log('Joined room successfully, existing users:', users);
      setParticipants(users);
      setIsConnecting(false);
    });

    return () => {
      off('user-joined');
      off('offer');
      off('answer');
      off('ice-candidate');
      off('user-left');
      off('joined-room');
    };
  }, [
    socket, 
    isConnected, 
    localStream, 
    emit, 
    on, 
    off, 
    createPeerConnection, 
    createOffer, 
    handleOffer, 
    handleAnswer, 
    addIceCandidate, 
    closePeerConnection
  ]);
  
  // Effect to handle errors from hooks
  useEffect(() => {
    if (socketError) {
      setConnectionError(`Server connection error: ${socketError}`);
    } else if (mediaError) {
      setConnectionError(`Media error: ${mediaError}`);
    } else if (peerError) {
      setConnectionError(`Connection error: ${peerError}`);
    }
  }, [socketError, mediaError, peerError]);

  // Setup audio analyser for a stream
  const setupAudioAnalyser = (stream, userId) => {
    if (!audioContextRef.current || !stream) return;
    
    try {
      // Clean up existing analyser
      if (audioAnalysersRef.current.has(userId)) {
        const { source } = audioAnalysersRef.current.get(userId);
        source?.disconnect();
      }
      
      // Create audio source from stream
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) return;
      
      const source = audioContextRef.current.createMediaStreamSource(stream);
      const analyser = audioContextRef.current.createAnalyser();
      
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      audioAnalysersRef.current.set(userId, { source, analyser, dataArray });
    } catch (error) {
      console.error('Error setting up audio analyser:', error);
    }
  };
  
  // Detect who is speaking
  const detectSpeaking = () => {
    if (!audioAnalysersRef.current) return;
    
    audioAnalysersRef.current.forEach(({ analyser, dataArray }, userId) => {
      analyser.getByteFrequencyData(dataArray);
      
      // Calculate average volume
      const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
      const threshold = 15;  // Adjust this threshold as needed
      
      if (average > threshold) {
        // User is speaking
        setSpeakingParticipants(prev => {
          const updated = new Set(prev);
          updated.add(userId);
          return updated;
        });
        
        // Reset after a short timeout if no more audio detected
        setTimeout(() => {
          setSpeakingParticipants(prev => {
            const updated = new Set(prev);
            updated.delete(userId);
            return updated;
          });
        }, 500);
      }
    });
  };

  const handleToggleAudio = () => {
    toggleAudio();
    emit('toggle-audio', { roomId, isAudioEnabled: !isAudioEnabled });
  };

  const hangUp = () => {
    // Cleanup
    stopMedia();
    closeAllPeerConnections();
    
    // Clean up audio analysers
    audioAnalysersRef.current.forEach(({ source }) => source?.disconnect());
    audioAnalysersRef.current.clear();
    
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(console.error);
    }
    
    emit('leave-room');
    navigate('/');
  };

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    showToast('Room ID copied to clipboard!', 'success');
  };

  // Show loading or error states
  if (isConnecting) {
    return (
      <AudioContainer>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100vh',
          flexDirection: 'column',
          color: 'white'
        }}>
          <div className="loading-spinner"></div>
          <p style={{ marginTop: '1rem' }}>Connecting to audio room...</p>
        </div>
      </AudioContainer>
    );
  }

  if (connectionError) {
    return (
      <AudioContainer>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100vh',
          flexDirection: 'column',
          color: 'white',
          textAlign: 'center',
          padding: '2rem'
        }}>
          <h2>Connection Error</h2>
          <p>{connectionError}</p>
          <button 
            onClick={() => navigate('/')}
            style={{ marginTop: '1rem', padding: '0.5rem 1rem' }}
          >
            Go Home
          </button>
        </div>
      </AudioContainer>
    );
  }

  const getParticipantEmoji = (participant) => {
    if (participant.isLocal) {
      return speakingParticipants.has(participant.id) ? '🎤' : '👤';
    }
    return speakingParticipants.has(participant.id) ? '🔊' : '👤';
  };

  return (
    <AudioContainer>
      <RoomInfo>
        <div style={{ marginBottom: '0.5rem' }}>
          <strong>Audio Room: {roomId}</strong>
          <button 
            onClick={copyRoomId}
            style={{ 
              marginLeft: '10px', 
              background: 'transparent', 
              border: 'none', 
              color: 'white',
              cursor: 'pointer',
              fontSize: '1.2rem'
            }}
          >
            📋
          </button>
        </div>
        <div>👥 {participants.length} participant{participants.length !== 1 ? 's' : ''}</div>
      </RoomInfo>

      {participants.length === 1 && (
        <CenterInfo>
          <RoomTitle>🎵 Audio Room</RoomTitle>
          <RoomSubtitle>Waiting for others to join...</RoomSubtitle>
        </CenterInfo>
      )}

      <ParticipantsGrid>
        {participants.map((participant) => (
          <ParticipantCard key={participant.id}>
            <Avatar isSpeaking={speakingParticipants.has(participant.id)}>
              {getParticipantEmoji(participant)}
            </Avatar>
            <ParticipantName>
              {participant.name} {participant.isLocal && '(You)'}
            </ParticipantName>
            <ParticipantStatus>
              {participant.isAudioEnabled ? (
                <>
                  🎤 
                  {speakingParticipants.has(participant.id) ? 'Speaking' : 'Connected'}
                </>
              ) : (
                <>🔇 Muted</>
              )}
            </ParticipantStatus>
          </ParticipantCard>
        ))}
      </ParticipantsGrid>

      <Controls>
        <ControlButton 
          className="audio" 
          active={isAudioEnabled}
          onClick={handleToggleAudio}
          title={isAudioEnabled ? 'Mute' : 'Unmute'}
        >
          {isAudioEnabled ? '🎤' : '🔇'}
        </ControlButton>

        <ControlButton 
          className="settings" 
          title="Settings"
        >
          ⚙️
        </ControlButton>

        <ControlButton 
          className="hang-up" 
          onClick={hangUp}
          title="Leave call"
        >
          📞
        </ControlButton>
      </Controls>

      {/* Chat Component */}
      {socket && (
        <Chat 
          socket={socket} 
          roomId={roomId}
          userName={userName}
        />
      )}
      
      {/* Toast notifications */}
      {toast && (
        <div 
          className="toast"
          style={{
            background: toast.type === 'error' ? '#dc3545' : 
                       toast.type === 'success' ? '#28a745' : '#007bff'
          }}
        >
          {toast.message}
        </div>
      )}

      {/* Audio elements for remote streams (hidden) */}
      {Array.from(remoteStreams).map(([userId, stream]) => (
        <audio 
          key={userId} 
          autoPlay 
          ref={el => {
            if (el) {
              el.srcObject = stream;
            }
          }}
        />
      ))}
    </AudioContainer>
  );
};

export default AudioCall; 