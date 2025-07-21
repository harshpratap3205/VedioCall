         import { useState, useRef, useCallback, useEffect } from 'react';

// Enhanced ICE servers configuration with more reliable servers
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  // More reliable TURN servers
  {
    urls: 'turn:numb.viagenie.ca',
    credential: 'muazkh',
    username: 'webrtc@live.com'
  },
  {
    urls: 'turn:turn.anyfirewall.com:443?transport=tcp',
    credential: 'webrtc',
    username: 'webrtc'
  },
  // Additional TURN servers for better reliability
  {
    urls: 'turn:openrelay.metered.ca:80',
    credential: 'openrelayproject',
    username: 'openrelayproject'
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    credential: 'openrelayproject',
    username: 'openrelayproject'
  }
];

// Connection timeout constants
const CONNECTION_TIMEOUT = 30000; // 30 seconds
const ICE_GATHERING_TIMEOUT = 10000; // 10 seconds

export const usePeerConnection = () => {
  const [remotePeers, setRemotePeers] = useState({});
  const [remoteStreams, setRemoteStreams] = useState({});
  const [connectionStatus, setConnectionStatus] = useState({});
  const [connectionError, setConnectionError] = useState(null);
  const [connectionStats, setConnectionStats] = useState({});

  const peerConnectionsRef = useRef({});
  const iceCandidatesQueueRef = useRef({});
  const remoteStreamsRef = useRef({});
  const connectionTimeoutsRef = useRef({});
  const statsIntervalsRef = useRef({});

  // Check browser WebRTC support with detailed capability detection
  const checkWebRTCSupport = useCallback(() => {
    const support = {
      peerConnection: !!window.RTCPeerConnection,
      getUserMedia: !!navigator.mediaDevices?.getUserMedia,
      dataChannel: false,
      addTransceiver: false
    };

    if (support.peerConnection) {
      try {
        const pc = new RTCPeerConnection();
        support.dataChannel = typeof pc.createDataChannel === 'function';
        support.addTransceiver = typeof pc.addTransceiver === 'function';
        pc.close();
      } catch (e) {
        console.warn('WebRTC support check failed:', e);
      }
    }

    if (!support.peerConnection || !support.getUserMedia) {
      const error = 'WebRTC is not supported in this browser';
      console.error(error);
      setConnectionError(error);
      return false;
    }

    console.log('WebRTC support:', support);
    return true;
  }, []);

  // Enhanced connection statistics
  const startStatsCollection = useCallback((peerId) => {
    const pc = peerConnectionsRef.current[peerId];
    if (!pc) return;

    const interval = setInterval(async () => {
      try {
        const stats = await pc.getStats();
        const statsData = {
          audio: { bytesReceived: 0, bytesSent: 0, packetsLost: 0 },
          video: { bytesReceived: 0, bytesSent: 0, packetsLost: 0 },
          connection: { rtt: 0, availableOutgoingBitrate: 0 }
        };

        stats.forEach(report => {
          if (report.type === 'inbound-rtp') {
            if (report.mediaType === 'audio') {
              statsData.audio.bytesReceived = report.bytesReceived || 0;
              statsData.audio.packetsLost = report.packetsLost || 0;
            } else if (report.mediaType === 'video') {
              statsData.video.bytesReceived = report.bytesReceived || 0;
              statsData.video.packetsLost = report.packetsLost || 0;
            }
          } else if (report.type === 'outbound-rtp') {
            if (report.mediaType === 'audio') {
              statsData.audio.bytesSent = report.bytesSent || 0;
            } else if (report.mediaType === 'video') {
              statsData.video.bytesSent = report.bytesSent || 0;
            }
          } else if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            statsData.connection.rtt = report.currentRoundTripTime || 0;
            statsData.connection.availableOutgoingBitrate = report.availableOutgoingBitrate || 0;
          }
        });

        setConnectionStats(prev => ({ ...prev, [peerId]: statsData }));
      } catch (error) {
        console.error(`Stats collection error for ${peerId}:`, error);
      }
    }, 1000);

    statsIntervalsRef.current[peerId] = interval;
  }, []);

  const stopStatsCollection = useCallback((peerId) => {
    if (statsIntervalsRef.current[peerId]) {
      clearInterval(statsIntervalsRef.current[peerId]);
      delete statsIntervalsRef.current[peerId];
    }
  }, []);

  // Process queued ICE candidates with better error handling
  const processIceCandidateQueue = useCallback(async (peerId) => {
    const pc = peerConnectionsRef.current[peerId];
    const queue = iceCandidatesQueueRef.current[peerId] || [];
    
    if (pc && pc.remoteDescription && queue.length > 0) {
      console.log(`Processing ${queue.length} queued ICE candidates for ${peerId}`);
      
      const results = await Promise.allSettled(
        queue.map(candidate => pc.addIceCandidate(new RTCIceCandidate(candidate)))
      );
      
      const failed = results.filter(r => r.status === 'rejected');
      if (failed.length > 0) {
        console.warn(`${failed.length} ICE candidates failed to add for ${peerId}`);
      }
      
      iceCandidatesQueueRef.current[peerId] = [];
    }
  }, []);

  // Enhanced peer connection creation with timeout handling
  const createPeerConnection = useCallback(async (peerId, localStream, onIceCandidate) => {
    if (!checkWebRTCSupport()) return null;

    try {
      console.log(`Creating peer connection for: ${peerId}`);
      
      const configuration = {
        iceServers: ICE_SERVERS,
        iceCandidatePoolSize: 10,
        iceTransportPolicy: 'all',
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require',
        sdpSemantics: 'unified-plan'
      };

      const pc = new RTCPeerConnection(configuration);
      peerConnectionsRef.current[peerId] = pc;
      
      // Initialize queues and state
      if (!iceCandidatesQueueRef.current[peerId]) {
        iceCandidatesQueueRef.current[peerId] = [];
      }
      
      setConnectionStatus(prev => ({ ...prev, [peerId]: 'connecting' }));
      
      // Set connection timeout
      connectionTimeoutsRef.current[peerId] = setTimeout(() => {
        if (pc.connectionState === 'connecting') {
          console.warn(`Connection timeout for ${peerId}`);
          setConnectionError(`Connection timeout for ${peerId}`);
          closePeerConnection(peerId);
        }
      }, CONNECTION_TIMEOUT);

      // Add local tracks with better error handling
      if (localStream) {
        for (const track of localStream.getTracks()) {
          try {
            console.log(`Adding local ${track.kind} track to ${peerId}`);
            const sender = pc.addTrack(track, localStream);
            
            // Configure encoding parameters for better quality
            if (track.kind === 'video') {
              const params = sender.getParameters();
              if (params.encodings && params.encodings.length > 0) {
                params.encodings[0].maxBitrate = 1000000; // 1 Mbps
                params.encodings[0].maxFramerate = 30;
                await sender.setParameters(params);
              }
            }
          } catch (err) {
            console.error(`Error adding ${track.kind} track:`, err);
          }
        }
      }

      // Enhanced ICE candidate handling
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          console.log(`ICE candidate for ${peerId}:`, event.candidate.type);
          onIceCandidate?.(event.candidate);
        }
      };

      // ICE gathering state handling
      pc.onicegatheringstatechange = () => {
        console.log(`ICE gathering state (${peerId}): ${pc.iceGatheringState}`);
        if (pc.iceGatheringState === 'complete') {
          // Clear ICE gathering timeout
          if (connectionTimeoutsRef.current[`${peerId}_ice`]) {
            clearTimeout(connectionTimeoutsRef.current[`${peerId}_ice`]);
            delete connectionTimeoutsRef.current[`${peerId}_ice`];
          }
        }
      };
      
      // Enhanced ICE connection state handling
      pc.oniceconnectionstatechange = () => {
        const state = pc.iceConnectionState;
        console.log(`ICE state (${peerId}): ${state}`);
        
        setConnectionStatus(prev => ({ ...prev, [peerId]: state }));
        
        if (state === 'connected') {
          // Clear connection timeout
          if (connectionTimeoutsRef.current[peerId]) {
            clearTimeout(connectionTimeoutsRef.current[peerId]);
            delete connectionTimeoutsRef.current[peerId];
          }
          // Start stats collection
          startStatsCollection(peerId);
        } else if (state === 'failed') {
          console.warn(`ICE failed for ${peerId}, attempting restart...`);
          setTimeout(() => restartIce(peerId), 2000);
        } else if (state === 'disconnected') {
          stopStatsCollection(peerId);
          setTimeout(() => {
            if (pc.iceConnectionState === 'disconnected') {
              restartIce(peerId);
            }
          }, 5000);
        }
      };

      // Enhanced connection state handling
      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        console.log(`Connection state (${peerId}): ${state}`);
        
        if (state === 'failed') {
          setConnectionError(`Connection failed for ${peerId}`);
        } else if (state === 'closed') {
          stopStatsCollection(peerId);
        }
      };

      // Enhanced remote track handling
      pc.ontrack = (event) => {
        console.log(`Received ${event.track.kind} track from ${peerId}`);
        
        const [stream] = event.streams;
        let remoteStream = stream;
        
        if (!remoteStream) {
          remoteStream = remoteStreamsRef.current[peerId] || new MediaStream();
          remoteStream.addTrack(event.track);
        }
        
        // Update refs and state
        remoteStreamsRef.current[peerId] = remoteStream;
        setRemoteStreams(prev => ({ ...prev, [peerId]: remoteStream }));
        
        // Track event handlers
        event.track.enabled = true;
        event.track.onended = () => {
          console.log(`Track ended: ${peerId} ${event.track.kind}`);
          // Handle track ended - could trigger reconnection
        };
        
        event.track.onmute = () => {
          console.log(`Track muted: ${peerId} ${event.track.kind}`);
        };
        
        event.track.onunmute = () => {
          console.log(`Track unmuted: ${peerId} ${event.track.kind}`);
        };
      };

      return pc;
    } catch (error) {
      console.error(`Peer connection creation failed (${peerId}):`, error);
      setConnectionError(`Connection failed: ${error.message}`);
      return null;
    }
  }, [checkWebRTCSupport, startStatsCollection, stopStatsCollection]);

  // Enhanced offer creation with better SDP handling
  const createOffer = useCallback(async (peerId, options = {}) => {
    const pc = peerConnectionsRef.current[peerId];
    if (!pc) return null;

    try {
      const offerOptions = {
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
        ...options
      };

      const offer = await pc.createOffer(offerOptions);
      
      // Modify SDP for better compatibility if needed
      const modifiedOffer = {
        ...offer,
        sdp: offer.sdp
      };
      
      await pc.setLocalDescription(modifiedOffer);
      
      // Set ICE gathering timeout
      connectionTimeoutsRef.current[`${peerId}_ice`] = setTimeout(() => {
        if (pc.iceGatheringState !== 'complete') {
          console.warn(`ICE gathering timeout for ${peerId}`);
        }
      }, ICE_GATHERING_TIMEOUT);
      
      setRemotePeers(prev => ({ 
        ...prev, 
        [peerId]: { type: 'offer', connected: false } 
      }));
      
      return modifiedOffer;
    } catch (error) {
      console.error(`Offer creation failed (${peerId}):`, error);
      setConnectionError(`Offer failed: ${error.message}`);
      return null;
    }
  }, []);

  // Enhanced offer handling
  const handleOffer = useCallback(async (peerId, offer, localStream, onIceCandidate) => {
    try {
      let pc = peerConnectionsRef.current[peerId];
      if (!pc) {
        pc = await createPeerConnection(peerId, localStream, onIceCandidate);
        if (!pc) return null;
      }
      
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      // Process queued ICE candidates
      await processIceCandidateQueue(peerId);
      
      setRemotePeers(prev => ({
        ...prev,
        [peerId]: { type: 'answer', connected: true }
      }));
      
      return answer;
    } catch (error) {
      console.error(`Offer handling failed (${peerId}):`, error);
      setConnectionError(`Offer processing failed: ${error.message}`);
      return null;
    }
  }, [createPeerConnection, processIceCandidateQueue]);

  // Enhanced answer handling
  const handleAnswer = useCallback(async (peerId, answer) => {
    const pc = peerConnectionsRef.current[peerId];
    if (!pc) return false;

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      await processIceCandidateQueue(peerId);
      
      setRemotePeers(prev => ({
        ...prev,
        [peerId]: { ...prev[peerId], connected: true }
      }));
      return true;
    } catch (error) {
      console.error(`Answer handling failed (${peerId}):`, error);
      return false;
    }
  }, [processIceCandidateQueue]);

  // Enhanced ICE candidate handling
  const addIceCandidate = useCallback(async (peerId, candidate) => {
    const pc = peerConnectionsRef.current[peerId];
    
    if (!pc || !pc.remoteDescription) {
      if (!iceCandidatesQueueRef.current[peerId]) {
        iceCandidatesQueueRef.current[peerId] = [];
      }
      iceCandidatesQueueRef.current[peerId].push(candidate);
      console.log(`Queued ICE candidate for ${peerId} (${candidate.type})`);
      return false;
    }

    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
      console.log(`Added ICE candidate for ${peerId} (${candidate.type})`);
      return true;
    } catch (error) {
      console.error(`ICE candidate error (${peerId}):`, error);
      return false;
    }
  }, []);

  // Enhanced stream replacement
  const updateStream = useCallback(async (peerId, newStream) => {
    const pc = peerConnectionsRef.current[peerId];
    if (!pc) return false;

    try {
      const senders = pc.getSenders();
      
      // Replace existing tracks
      for (const track of newStream.getTracks()) {
        const sender = senders.find(s => s.track?.kind === track.kind);
        if (sender) {
          await sender.replaceTrack(track);
          console.log(`Replaced ${track.kind} track for ${peerId}`);
        } else {
          pc.addTrack(track, newStream);
          console.log(`Added new ${track.kind} track for ${peerId}`);
        }
      }
      
      return true;
    } catch (error) {
      console.error(`Stream update failed (${peerId}):`, error);
      return false;
    }
  }, []);

  // Enhanced ICE restart
  const restartIce = useCallback(async (peerId) => {
    const pc = peerConnectionsRef.current[peerId];
    if (!pc) return null;

    try {
      if (pc.signalingState === 'stable') {
        console.log(`Restarting ICE for ${peerId}`);
        const offer = await pc.createOffer({ iceRestart: true });
        await pc.setLocalDescription(offer);
        return offer;
      }
      return null;
    } catch (error) {
      console.error(`ICE restart failed (${peerId}):`, error);
      return null;
    }
  }, []);

  // Enhanced peer connection cleanup
  const closePeerConnection = useCallback((peerId) => {
    const pc = peerConnectionsRef.current[peerId];
    if (!pc) return false;

    console.log(`Closing peer connection for ${peerId}`);
    
    // Clear timeouts
    if (connectionTimeoutsRef.current[peerId]) {
      clearTimeout(connectionTimeoutsRef.current[peerId]);
      delete connectionTimeoutsRef.current[peerId];
    }
    
    if (connectionTimeoutsRef.current[`${peerId}_ice`]) {
      clearTimeout(connectionTimeoutsRef.current[`${peerId}_ice`]);
      delete connectionTimeoutsRef.current[`${peerId}_ice`];
    }
    
    // Stop stats collection
    stopStatsCollection(peerId);
    
    // Close connection
    pc.close();
    
    // Clean up references
    delete peerConnectionsRef.current[peerId];
    delete iceCandidatesQueueRef.current[peerId];
    delete remoteStreamsRef.current[peerId];
    
    // Update state
    setRemotePeers(prev => {
      const newPeers = { ...prev };
      delete newPeers[peerId];
      return newPeers;
    });
    
    setRemoteStreams(prev => {
      const newStreams = { ...prev };
      delete newStreams[peerId];
      return newStreams;
    });
    
    setConnectionStatus(prev => {
      const newStatus = { ...prev };
      delete newStatus[peerId];
      return newStatus;
    });
    
    setConnectionStats(prev => {
      const newStats = { ...prev };
      delete newStats[peerId];
      return newStats;
    });
    
    return true;
  }, [stopStatsCollection]);

  // Close all connections
  const closeAllPeerConnections = useCallback(() => {
    Object.keys(peerConnectionsRef.current).forEach(closePeerConnection);
    setRemotePeers({});
    setRemoteStreams({});
    setConnectionStatus({});
    setConnectionStats({});
    iceCandidatesQueueRef.current = {};
    remoteStreamsRef.current = {};
    connectionTimeoutsRef.current = {};
  }, [closePeerConnection]);

  // Get remote stream
  const getRemoteStream = useCallback((peerId) => {
    return remoteStreamsRef.current[peerId] || remoteStreams[peerId];
  }, [remoteStreams]);

  // Get connection statistics
  const getConnectionStats = useCallback((peerId) => {
    return connectionStats[peerId];
  }, [connectionStats]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      closeAllPeerConnections();
      // Clear all timeouts
      Object.values(connectionTimeoutsRef.current).forEach(clearTimeout);
      Object.values(statsIntervalsRef.current).forEach(clearInterval);
    };
  }, [closeAllPeerConnections]);

  return {
    remotePeers,
    remoteStreams,
    connectionStatus,
    connectionError,
    connectionStats,
    createPeerConnection,
    createOffer,
    handleOffer,
    handleAnswer,
    addIceCandidate,
    closePeerConnection,
    closeAllPeerConnections,
    updateStream,
    restartIce,
    getRemoteStream,
    getConnectionStats
  };
};