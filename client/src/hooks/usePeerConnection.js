import { useState, useRef, useCallback, useEffect } from 'react';

// STUN servers for NAT traversal
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

export const usePeerConnection = (socket, localStream) => {
  const [remotePeers, setRemotePeers] = useState({});
  const [remoteStreams, setRemoteStreams] = useState({});
  const [connectionStatus, setConnectionStatus] = useState({});
  const [connectionError, setConnectionError] = useState(null);

  const peerConnectionsRef = useRef({});
  const iceCandidatesQueueRef = useRef({});

  // Check WebRTC browser support
  const checkWebRTCSupport = useCallback(() => {
    if (
      !window.RTCPeerConnection || 
      !navigator.mediaDevices || 
      !navigator.mediaDevices.getUserMedia
    ) {
      const error = 'WebRTC is not supported in this browser. Please use Chrome, Firefox, Safari, or Edge.';
      console.error(error);
      setConnectionError(error);
      return false;
    }
    return true;
  }, []);

  // Initialize a new peer connection
  const createPeerConnection = useCallback(async (peerId, localStream, onIceCandidate) => {
    if (!checkWebRTCSupport()) {
      return null;
    }

    try {
      console.log(`Creating peer connection for peer: ${peerId}`);
      
      // ICE servers configuration (STUN/TURN)
      const configuration = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' }
          // Add TURN servers for production environment
          // {
          //   urls: 'turn:turn.example.com:3478',
          //   username: 'username',
          //   credential: 'password'
          // }
        ],
        iceCandidatePoolSize: 10,
        // Improve connection stability
        iceTransportPolicy: 'all',
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require'
      };

      const pc = new RTCPeerConnection(configuration);
      
      // Store the peer connection
      peerConnectionsRef.current[peerId] = pc;
      
      // Create queue for ICE candidates if not exists
      if (!iceCandidatesQueueRef.current[peerId]) {
        iceCandidatesQueueRef.current[peerId] = [];
      }
      
      // Update peer connection status
      setConnectionStatus(prev => ({
        ...prev,
        [peerId]: 'connecting'
      }));
      
      // Add local tracks to the connection
      if (localStream) {
        console.log(`Adding local tracks to peer connection: ${peerId}`);
        localStream.getTracks().forEach(track => {
          pc.addTrack(track, localStream);
        });
      } else {
        console.warn(`No local stream available for peer: ${peerId}`);
      }
      
      // Handle remote stream
      pc.ontrack = event => {
        console.log(`Received remote track from peer: ${peerId}`, event.streams[0]);
        
        // Store remote stream
        setRemoteStreams(prev => ({
          ...prev,
          [peerId]: event.streams[0]
        }));
        
        // Apply bandwidth optimizations to incoming video
        if (event.track.kind === 'video') {
          try {
            // Set content hint for better processing
            event.track.contentHint = "motion";
            
            // Set up periodic connection quality monitoring
            const statsInterval = setInterval(async () => {
              try {
                if (pc.connectionState === 'connected') {
                  const stats = await pc.getStats(event.track);
                  let hasIssues = false;
                  
                  stats.forEach(stat => {
                    // Look for video issues in stats
                    if (stat.type === 'inbound-rtp' && stat.kind === 'video') {
                      const packetsLost = stat.packetsLost || 0;
                      const packetsReceived = stat.packetsReceived || 1;
                      const lossRate = packetsLost / (packetsLost + packetsReceived);
                      
                      // If loss rate is high, we have connection issues
                      if (lossRate > 0.05) { // 5% packet loss
                        hasIssues = true;
                        console.warn(`High packet loss (${(lossRate*100).toFixed(1)}%) detected for peer ${peerId}`);
                      }
                    }
                  });
                  
                  if (hasIssues && pc.connectionState === 'connected') {
                    console.log(`Connection quality issues detected for peer ${peerId}, attempting to optimize...`);
                    // Could trigger bandwidth adaptation here
                  }
                }
              } catch (e) {
                console.warn('Error monitoring connection stats:', e);
              }
            }, 5000); // Check every 5 seconds
            
            // Clean up interval when track ends
            event.track.onended = () => {
              clearInterval(statsInterval);
            };
          } catch (e) {
            console.warn('Could not optimize incoming video track:', e);
          }
        }
      };
      
      // ICE candidate event
      pc.onicecandidate = event => {
        if (event.candidate) {
          console.log(`Generated ICE candidate for peer: ${peerId}`);
          if (onIceCandidate) {
            onIceCandidate(event.candidate);
          }
        } else {
          console.log(`All ICE candidates generated for peer: ${peerId}`);
        }
      };
      
      // Connection state changes
      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        console.log(`Peer connection state changed for ${peerId}: ${state}`);
        
        setConnectionStatus(prev => ({
          ...prev,
          [peerId]: state
        }));
        
        if (state === 'connected') {
          console.log(`Successfully connected to peer: ${peerId}`);
          setConnectionError(null);
          
          // Apply bandwidth restrictions for more stable video
          try {
            const senders = pc.getSenders();
            senders.forEach(sender => {
              if (sender.track && sender.track.kind === 'video') {
                const params = sender.getParameters();
                
                // Only modify if encodings exist and browser supports it
                if (params.encodings && params.encodings.length > 0) {
                  console.log('Applying bandwidth restrictions to video');
                  
                  // Set reasonable bandwidth limits (1.5 Mbps)
                  params.encodings[0].maxBitrate = 1500000;
                  
                  // Apply the parameters
                  sender.setParameters(params).catch(e => {
                    console.warn('Failed to set encoding parameters:', e);
                  });
                }
              }
            });
          } catch (e) {
            console.warn('Could not apply bandwidth restrictions:', e);
          }
        } else if (state === 'failed' || state === 'disconnected' || state === 'closed') {
          console.error(`Peer connection ${state} for peer: ${peerId}`);
          
          if (state === 'failed') {
            setConnectionError(`Connection to peer ${peerId} failed. Try refreshing the page or check your network.`);
            
            // Attempt recovery by restarting ICE
            if (pc.restartIce) {
              console.log(`Attempting ICE restart for peer: ${peerId}`);
              pc.restartIce();
            }
          }
          
          // Update the remote peers list
          if (state === 'closed') {
            setRemotePeers(prev => {
              const updated = { ...prev };
              delete updated[peerId];
              return updated;
            });
            
            setRemoteStreams(prev => {
              const updated = { ...prev };
              delete updated[peerId];
              return updated;
            });
          }
        }
      };
      
      // ICE connection state changes
      pc.oniceconnectionstatechange = () => {
        const state = pc.iceConnectionState;
        console.log(`ICE connection state changed for ${peerId}: ${state}`);
        
        if (state === 'failed') {
          console.error(`ICE connection failed for peer: ${peerId}`);
          setConnectionError(`ICE connection failed with peer ${peerId}. This may be due to firewall or network issues.`);
          
          // Try ICE restart if possible
          if (pc.restartIce) {
            console.log(`Attempting ICE restart for peer: ${peerId}`);
            pc.restartIce();
          }
        } else if (state === 'disconnected') {
          console.warn(`ICE connection disconnected for peer: ${peerId}, waiting for reconnection...`);
          
          // Set a timeout to check if we recover
          setTimeout(() => {
            if (pc.iceConnectionState === 'disconnected') {
              console.log(`ICE connection still disconnected for peer: ${peerId}, attempting restart`);
              if (pc.restartIce) {
                pc.restartIce();
              }
            }
          }, 5000); // Wait 5 seconds before trying to recover
        }
      };
      
      // Process any queued ICE candidates
      if (iceCandidatesQueueRef.current[peerId].length > 0) {
        console.log(`Processing ${iceCandidatesQueueRef.current[peerId].length} queued ICE candidates for ${peerId}`);
        
        iceCandidatesQueueRef.current[peerId].forEach(candidate => {
          pc.addIceCandidate(new RTCIceCandidate(candidate))
            .catch(err => console.error(`Error adding queued ICE candidate for ${peerId}:`, err));
        });
        
        iceCandidatesQueueRef.current[peerId] = [];
      }
      
      return pc;
    } catch (error) {
      console.error(`Error creating peer connection for ${peerId}:`, error);
      setConnectionError(`Failed to create peer connection: ${error.message}`);
      return null;
    }
  }, [checkWebRTCSupport]);

  // Create and send offer to remote peer
  const createOffer = useCallback(async (peerId) => {
    const pc = peerConnectionsRef.current[peerId];
    
    if (!pc) {
      const error = `Cannot create offer: No peer connection for ${peerId}`;
      console.error(error);
      setConnectionError(error);
      return null;
    }
    
    try {
      console.log(`Creating offer for peer: ${peerId}`);
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      
      console.log(`Setting local description (offer) for peer: ${peerId}`);
      await pc.setLocalDescription(offer);
      
      return offer;
    } catch (error) {
      console.error(`Error creating offer for ${peerId}:`, error);
      setConnectionError(`Failed to create offer: ${error.message}`);
      return null;
    }
  }, []);

  // Handle received offer from remote peer
  const handleOffer = useCallback(async (peerId, offer, localStream, onIceCandidate) => {
    try {
      console.log(`Handling offer from peer: ${peerId}`);
      
      // Create peer connection if it doesn't exist
      let pc = peerConnectionsRef.current[peerId];
      if (!pc) {
        pc = await createPeerConnection(peerId, localStream, onIceCandidate);
        if (!pc) return null;
      }
      
      // Set remote description from offer
      console.log(`Setting remote description (offer) for peer: ${peerId}`);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      
      // Create answer
      console.log(`Creating answer for peer: ${peerId}`);
      const answer = await pc.createAnswer();
      
      // Set local description from answer
      console.log(`Setting local description (answer) for peer: ${peerId}`);
      await pc.setLocalDescription(answer);
      
      // Update remote peers
      setRemotePeers(prev => ({
        ...prev,
        [peerId]: { type: 'answer', connected: true }
      }));
      
      return answer;
    } catch (error) {
      console.error(`Error handling offer from ${peerId}:`, error);
      setConnectionError(`Failed to process incoming call: ${error.message}`);
      return null;
    }
  }, [createPeerConnection]);

  // Handle received answer from remote peer
  const handleAnswer = useCallback(async (peerId, answer) => {
    const pc = peerConnectionsRef.current[peerId];
    
    if (!pc) {
      const error = `Cannot handle answer: No peer connection for ${peerId}`;
      console.error(error);
      setConnectionError(error);
      return false;
    }
    
    try {
      console.log(`Handling answer from peer: ${peerId}`);
      
      if (pc.signalingState === 'have-local-offer') {
        // Set remote description from answer
        console.log(`Setting remote description (answer) for peer: ${peerId}`);
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        
        // Update remote peers
        setRemotePeers(prev => ({
          ...prev,
          [peerId]: { type: 'offer', connected: true }
        }));
        
        return true;
      } else {
        console.warn(`Invalid signaling state for handling answer: ${pc.signalingState}`);
        return false;
      }
    } catch (error) {
      console.error(`Error handling answer from ${peerId}:`, error);
      setConnectionError(`Failed to establish connection: ${error.message}`);
      return false;
    }
  }, []);

  // Add ICE candidate from remote peer
  const addIceCandidate = useCallback((peerId, candidate) => {
    const pc = peerConnectionsRef.current[peerId];
    
    if (!pc) {
      // Queue ICE candidate if peer connection not ready
      console.log(`Queueing ICE candidate for peer: ${peerId}`);
      if (!iceCandidatesQueueRef.current[peerId]) {
        iceCandidatesQueueRef.current[peerId] = [];
      }
      iceCandidatesQueueRef.current[peerId].push(candidate);
      return false;
    }
    
    try {
      // Check if remote description is set
      if (pc.remoteDescription && pc.remoteDescription.type) {
        console.log(`Adding ICE candidate for peer: ${peerId}`);
        pc.addIceCandidate(new RTCIceCandidate(candidate))
          .catch(err => {
            console.error(`Error adding ICE candidate for ${peerId}:`, err);
            setConnectionError(`Failed to process network information: ${err.message}`);
          });
        return true;
      } else {
        // Queue ICE candidate if remote description not set
        console.log(`Queueing ICE candidate (no remote description) for peer: ${peerId}`);
        if (!iceCandidatesQueueRef.current[peerId]) {
          iceCandidatesQueueRef.current[peerId] = [];
        }
        iceCandidatesQueueRef.current[peerId].push(candidate);
        return false;
      }
    } catch (error) {
      console.error(`Error handling ICE candidate for ${peerId}:`, error);
      setConnectionError(`Failed to process network information: ${error.message}`);
      return false;
    }
  }, []);

  // Close peer connection
  const closePeerConnection = useCallback((peerId) => {
    const pc = peerConnectionsRef.current[peerId];
    
    if (pc) {
      console.log(`Closing peer connection for: ${peerId}`);
      pc.close();
      
      // Remove peer connection
      delete peerConnectionsRef.current[peerId];
      delete iceCandidatesQueueRef.current[peerId];
      
      // Update states
      setRemotePeers(prev => {
        const updated = { ...prev };
        delete updated[peerId];
        return updated;
      });
      
      setRemoteStreams(prev => {
        const updated = { ...prev };
        delete updated[peerId];
        return updated;
      });
      
      setConnectionStatus(prev => {
        const updated = { ...prev };
        delete updated[peerId];
        return updated;
      });
      
      return true;
    } else {
      console.warn(`No peer connection found for: ${peerId}`);
      return false;
    }
  }, []);

  // Close all peer connections
  const closeAllPeerConnections = useCallback(() => {
    console.log('Closing all peer connections');
    Object.keys(peerConnectionsRef.current).forEach(peerId => {
      closePeerConnection(peerId);
    });
    
    setRemotePeers({});
    setRemoteStreams({});
    setConnectionStatus({});
    iceCandidatesQueueRef.current = {};
  }, [closePeerConnection]);

  // Check if peer connection exists
  const hasPeerConnection = useCallback((peerId) => {
    return !!peerConnectionsRef.current[peerId];
  }, []);

  // Update stream for existing peer connection
  const updateStream = useCallback((peerId, newStream) => {
    const pc = peerConnectionsRef.current[peerId];
    
    if (!pc) {
      console.warn(`Cannot update stream: No peer connection for ${peerId}`);
      return false;
    }
    
    try {
      console.log(`Updating stream for peer: ${peerId}`);
      
      // Get all senders
      const senders = pc.getSenders();
      
      // Replace all tracks with new ones
      newStream.getTracks().forEach(track => {
        const sender = senders.find(s => {
          return s.track && s.track.kind === track.kind;
        });
        
        if (sender) {
          console.log(`Replacing ${track.kind} track for peer: ${peerId}`);
          sender.replaceTrack(track)
            .catch(err => console.error(`Error replacing track for ${peerId}:`, err));
        } else {
          console.log(`Adding new ${track.kind} track for peer: ${peerId}`);
          pc.addTrack(track, newStream);
        }
      });
      
      return true;
    } catch (error) {
      console.error(`Error updating stream for ${peerId}:`, error);
      setConnectionError(`Failed to update media stream: ${error.message}`);
      return false;
    }
  }, []);

  // Get connection statistics
  const getStats = useCallback(async (peerId) => {
    const pc = peerConnectionsRef.current[peerId];
    
    if (!pc) {
      console.warn(`Cannot get stats: No peer connection for ${peerId}`);
      return null;
    }
    
    try {
      const stats = await pc.getStats();
      return stats;
    } catch (error) {
      console.error(`Error getting stats for ${peerId}:`, error);
      return null;
    }
  }, []);

  // Restart ICE if connection is failing
  const restartIce = useCallback(async (peerId) => {
    const pc = peerConnectionsRef.current[peerId];
    
    if (!pc || !pc.restartIce) {
      console.warn(`Cannot restart ICE: No valid peer connection for ${peerId}`);
      return false;
    }
    
    try {
      console.log(`Restarting ICE for peer: ${peerId}`);
      
      if (pc.signalingState === 'stable') {
        pc.restartIce();
        
        // Try to renegotiate if needed
        const offer = await pc.createOffer({ iceRestart: true });
        await pc.setLocalDescription(offer);
        
        return offer;
      } else {
        console.warn(`Cannot restart ICE: Signaling state not stable (${pc.signalingState})`);
        return null;
      }
    } catch (error) {
      console.error(`Error restarting ICE for ${peerId}:`, error);
      setConnectionError(`Failed to restart connection: ${error.message}`);
      return null;
    }
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      closeAllPeerConnections();
    };
  }, [closeAllPeerConnections]);

  return {
    remotePeers,
    remoteStreams,
    connectionStatus,
    connectionError,
    createPeerConnection,
    createOffer,
    handleOffer,
    handleAnswer,
    addIceCandidate,
    closePeerConnection,
    closeAllPeerConnections,
    hasPeerConnection,
    updateStream,
    getStats,
    restartIce
  };
}; 