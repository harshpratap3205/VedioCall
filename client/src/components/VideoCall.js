import React, { useState, useEffect, useRef } from 'react';
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

const VideoCall = () => {
  const { roomId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [participants, setParticipants] = useState([]);
  const [userName] = useState(location.state?.userName || 'Anonymous');
  const [isConnecting, setIsConnecting] = useState(true);
  const [connectionError, setConnectionError] = useState(null);
  const [toast, setToast] = useState(null);
  
  // Custom hooks
  const { socket, isConnected, connectionError: socketError, emit, on, off } = useSocket();
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
    closeAllPeerConnections
  } = usePeerConnection();

  const remoteVideoRefs = useRef(new Map());
  const hasJoinedRef = useRef(false);

  // Show toast notification
  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Initialize room and media
  useEffect(() => {
    const initializeRoom = async () => {
      if (hasJoinedRef.current) return;
      
      try {
        setIsConnecting(true);
        setConnectionError(null);
        
        console.log("Starting room initialization...");
        
        // Join room when socket is connected
        if (socket && isConnected) {
          console.log("Socket connected, joining room:", roomId);
          emit('join-room', { roomId, userName });
          hasJoinedRef.current = true;
        } else {
          console.error("Socket not connected!");
          setConnectionError('Not connected to server. Please check your internet connection.');
        }
      } catch (error) {
        console.error('Error initializing room:', error);
        setConnectionError(error.message || 'Failed to initialize room');
      } finally {
        setIsConnecting(false);
      }
    };

    initializeRoom();

    // Cleanup function
    return () => {
      if (hasJoinedRef.current) {
        console.log("Cleaning up room connection...");
        emit('leave-room');
        hasJoinedRef.current = false;
      }
    };
  }, [socket, isConnected, roomId, userName, emit]);

  // Initialize media
  useEffect(() => {
    const initializeMedia = async () => {
      if (!localStream) {
        try {
          console.log("Getting user media...");
          await getUserMedia(true, true);
          console.log("Got user media successfully");
        } catch (error) {
          console.error('Error getting user media:', error);
          setConnectionError(error.message || 'Failed to access camera/microphone');
        }
      }
    };

    initializeMedia();
  }, [getUserMedia]);

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

  // Video component to handle rendering and stability
  const VideoComponent = React.memo(({ userId, stream, name }) => {
    const videoRef = useRef(null);
    const [isLoading, setIsLoading] = useState(true);
    const [hasVideo, setHasVideo] = useState(false);
    
    // Check if stream has video tracks and attach stream
    useEffect(() => {
      if (stream) {
        const videoTrack = stream.getVideoTracks()[0];
        const hasVideoTracks = !!videoTrack;
        const isVideoEnabled = hasVideoTracks && videoTrack.enabled;
        setHasVideo(hasVideoTracks && isVideoEnabled);

        // Attach stream to video element
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          console.log(`Attached ${userId} stream to video element`);
        }
        
        if (videoTrack) {
          const handleMute = () => setHasVideo(false);
          const handleUnmute = () => setHasVideo(true);
          
          videoTrack.addEventListener('mute', handleMute);
          videoTrack.addEventListener('unmute', handleUnmute);
          
          return () => {
            videoTrack.removeEventListener('mute', handleMute);
            videoTrack.removeEventListener('unmute', handleUnmute);
          };
        }
      } else {
        setHasVideo(false);
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
      }
    }, [stream, userId]);
    
    // Handle video loading
    const handleVideoLoaded = () => {
      setIsLoading(false);
      console.log(`Video loaded for ${userId}`);
    };
    
    return (
      <VideoCard>
        {stream ? (
          <>
            <Video
              ref={videoRef}
              autoPlay
              playsInline
              muted={userId === 'local'}
              loading={isLoading}
              mirrored={userId === 'local'}
              onLoadedMetadata={handleVideoLoaded}
              style={{
                display: hasVideo ? 'block' : 'none'
              }}
            />
            {!hasVideo && (
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
          const participant = participants.find(p => p.id === userId);
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
      </Controls>
      
      {/* Chat component */}
      <Chat roomId={roomId} userName={userName} />
      
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
    </VideoContainer>
  );
};

export default VideoCall; 