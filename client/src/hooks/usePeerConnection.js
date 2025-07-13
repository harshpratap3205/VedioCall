import { useState, useRef, useCallback, useEffect } from 'react';

// STUN/TURN servers for NAT traversal
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  // Public TURN servers - replace with your own in production
  {
    urls: 'turn:numb.viagenie.ca',
    credential: 'muazkh',
    username: 'webrtc@live.com'
  },
  {
    urls: 'turn:turn.anyfirewall.com:443?transport=tcp',
    credential: 'webrtc',
    username: 'webrtc'
  }
];

export const usePeerConnection = () => {
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
        iceServers: ICE_SERVERS,
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
      
      // Handle ICE candidate events
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          console.log(`New ICE candidate for peer ${peerId}:`, event.candidate);
          
          if (onIceCandidate && typeof onIceCandidate === 'function') {
            onIceCandidate(event.candidate);
          } else {
            console.warn(`No ICE candidate handler for peer: ${peerId}`);
          }
        }
      };
      
      // Handle ICE connection state changes
      pc.oniceconnectionstatechange = () => {
        console.log(`ICE connection state for ${peerId}:`, pc.iceConnectionState);
        
        // Update connection status based on ICE state
        switch (pc.iceConnectionState) {
          case 'connected':
          case 'completed':
            setConnectionStatus(prev => ({
              ...prev,
              [peerId]: 'connected'
            }));
            break;
            
          case 'failed':
            console.error(`ICE connection failed for peer: ${peerId}`);
            setConnectionStatus(prev => ({
              ...prev,
              [peerId]: 'failed'
            }));
            
            // Try to restart ICE connection
            console.log(`Attempting to restart ICE connection for peer: ${peerId}`);
            restartIce(peerId);
            break;
            
          case 'disconnected':
            console.warn(`ICE connection disconnected for peer: ${peerId}`);
            setConnectionStatus(prev => ({
              ...prev,
              [peerId]: 'disconnected'
            }));
            
            // Wait briefly and check again (sometimes it auto-recovers)
            setTimeout(() => {
              const currentPC = peerConnectionsRef.current[peerId];
              if (currentPC && currentPC.iceConnectionState === 'disconnected') {
                console.log(`ICE still disconnected for peer: ${peerId}, attempting to restart`);
                restartIce(peerId);
              }
            }, 5000);
            break;
            
          case 'closed':
            setConnectionStatus(prev => ({
              ...prev,
              [peerId]: 'closed'
            }));
            break;
            
          default:
            break;
        }
      };
      
      // Handle ICE gathering state changes
      pc.onicegatheringstatechange = () => {
        console.log(`ICE gathering state for ${peerId}:`, pc.iceGatheringState);
      };
      
      // Handle signaling state changes
      pc.onsignalingstatechange = () => {
        console.log(`Signaling state for ${peerId}:`, pc.signalingState);
      };
      
      // Handle connection state changes
      pc.onconnectionstatechange = () => {
        console.log(`Connection state for ${peerId}:`, pc.connectionState);
        
        if (pc.connectionState === 'failed') {
          console.error(`Connection failed for peer: ${peerId}`);
          
          // Attempt to reconnect
          restartIce(peerId);
        }
      };
      
      // Handle remote track events
      pc.ontrack = (event) => {
        console.log(`Received remote track from ${peerId}:`, event.streams);
        
        if (event.streams && event.streams[0]) {
          // Save remote stream
          setRemoteStreams(prev => ({
            ...prev,
            [peerId]: event.streams[0]
          }));
          
          // Update connection status
          setConnectionStatus(prev => ({
            ...prev,
            [peerId]: 'connected'
          }));
        }
      };
      
      // Process any queued ICE candidates
      if (iceCandidatesQueueRef.current[peerId] && iceCandidatesQueueRef.current[peerId].length > 0) {
        console.log(`Processing ${iceCandidatesQueueRef.current[peerId].length} queued ICE candidates for peer: ${peerId}`);
        
        const candidates = [...iceCandidatesQueueRef.current[peerId]];
        iceCandidatesQueueRef.current[peerId] = [];
        
        candidates.forEach(candidate => {
          pc.addIceCandidate(candidate)
            .catch(err => console.error(`Error adding queued ICE candidate for ${peerId}:`, err));
        });
      }
      
      return pc;
    } catch (error) {
      console.error(`Error creating peer connection for ${peerId}:`, error);
      setConnectionError(`Failed to create connection: ${error.message}`);
      return null;
    }
  }, [checkWebRTCSupport]);

  // Create offer
  const createOffer = useCallback(async (peerId) => {
    const pc = peerConnectionsRef.current[peerId];
    
    if (!pc) {
      console.error(`Cannot create offer: No peer connection for ${peerId}`);
      return null;
    }
    
    try {
      console.log(`Creating offer for peer: ${peerId}`);
      
      // Create offer with options for better compatibility
      const offerOptions = {
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
        voiceActivityDetection: true,
        iceRestart: true
      };
      
      const offer = await pc.createOffer(offerOptions);
      
      console.log(`Setting local description (offer) for peer: ${peerId}`);
      await pc.setLocalDescription(offer);
      
      // Update remote peers state
      setRemotePeers(prev => ({
        ...prev,
        [peerId]: { type: 'offer', connected: false }
      }));
      
      return offer;
    } catch (error) {
      console.error(`Error creating offer for ${peerId}:`, error);
      setConnectionError(`Failed to create call offer: ${error.message}`);
      return null;
    }
  }, []);

  // Handle received answer from remote peer
  const handleAnswer = useCallback(async (peerId, answer) => {
    const pc = peerConnectionsRef.current[peerId];
    
    if (!pc) {
      console.error(`Cannot handle answer: No peer connection for ${peerId}`);
      return false;
    }
    
    try {
      console.log(`Setting remote description (answer) for peer: ${peerId}`);
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      
      // Update remote peers
      setRemotePeers(prev => ({
        ...prev,
        [peerId]: { ...prev[peerId], connected: true }
      }));
      
      return true;
    } catch (error) {
      console.error(`Error handling answer from ${peerId}:`, error);
      setConnectionError(`Failed to process call response: ${error.message}`);
      return false;
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
      const answer = await pc.createAnswer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      
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

  // Add ICE candidate
  const addIceCandidate = useCallback(async (peerId, candidate) => {
    const pc = peerConnectionsRef.current[peerId];
    
    if (!pc) {
      console.warn(`Cannot add ICE candidate: No peer connection for ${peerId}, queuing...`);
      
      // Queue the ICE candidate for later
      if (!iceCandidatesQueueRef.current[peerId]) {
        iceCandidatesQueueRef.current[peerId] = [];
      }
      
      iceCandidatesQueueRef.current[peerId].push(candidate);
      return false;
    }
    
    try {
      if (pc.remoteDescription && pc.remoteDescription.type) {
        console.log(`Adding ICE candidate for peer: ${peerId}`);
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
        return true;
      } else {
        // Queue ICE candidate if remote description is not set yet
        console.log(`Remote description not set for ${peerId}, queuing ICE candidate`);
        if (!iceCandidatesQueueRef.current[peerId]) {
          iceCandidatesQueueRef.current[peerId] = [];
        }
        
        iceCandidatesQueueRef.current[peerId].push(candidate);
        return true;
      }
    } catch (error) {
      console.error(`Error adding ICE candidate for ${peerId}:`, error);
      return false;
    }
  }, []);

  // Update stream for an existing peer connection
  const updateStream = useCallback(async (peerId, newStream) => {
    const pc = peerConnectionsRef.current[peerId];
    
    if (!pc) {
      console.error(`Cannot update stream: No peer connection for ${peerId}`);
      return false;
    }
    
    try {
      console.log(`Updating stream for peer: ${peerId}`);
      
      // Get all current senders (tracks)
      const senders = pc.getSenders();
      
      // For each track in the new stream, find the corresponding sender and replace it
      const promises = newStream.getTracks().map(track => {
        const sender = senders.find(s => s.track && s.track.kind === track.kind);
        
        if (sender) {
          return sender.replaceTrack(track);
        } else {
          return pc.addTrack(track, newStream);
        }
      });
      
      await Promise.all(promises);
      return true;
    } catch (error) {
      console.error(`Error updating stream for ${peerId}:`, error);
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

  // Get connection statistics (useful for debugging)
  const getStats = useCallback(async (peerId) => {
    const pc = peerConnectionsRef.current[peerId];
    
    if (!pc) {
      console.error(`Cannot get stats: No peer connection for ${peerId}`);
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