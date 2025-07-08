import { useState, useEffect, useRef, useCallback } from 'react';

export const useMedia = (isVideoCall = true) => {
  const [localStream, setLocalStream] = useState(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(isVideoCall);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [mediaError, setMediaError] = useState(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [hasPermissions, setHasPermissions] = useState({
    audio: false,
    video: false
  });
  const [devices, setDevices] = useState({
    audioInputs: [],
    videoInputs: [],
    audioOutputs: []
  });

  const localVideoRef = useRef(null);
  const screenStreamRef = useRef(null);

  // Check if browser supports getUserMedia
  const checkMediaSupport = useCallback(() => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const error = 'Your browser does not support media devices access. Please try a different browser like Chrome, Firefox or Edge.';
      console.error(error);
      setMediaError(error);
      return false;
    }
    return true;
  }, []);

  // Check permissions without requesting them
  const checkPermissions = useCallback(async () => {
    try {
      const permissions = await navigator.permissions.query({ name: 'camera' })
        .then(cameraPermission => {
          return navigator.permissions.query({ name: 'microphone' })
            .then(microphonePermission => {
              return {
                video: cameraPermission.state === 'granted',
                audio: microphonePermission.state === 'granted'
              };
            });
        })
        .catch(() => {
          // Permissions API might not be supported or failed
          return { video: false, audio: false };
        });
        
      setHasPermissions(permissions);
      return permissions;
    } catch (error) {
      console.error('Error checking permissions:', error);
      return { video: false, audio: false };
    }
  }, []);

  // Get available media devices
  const getDevices = useCallback(async () => {
    try {
      const deviceList = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = deviceList.filter(device => device.kind === 'audioinput');
      const videoInputs = deviceList.filter(device => device.kind === 'videoinput');
      const audioOutputs = deviceList.filter(device => device.kind === 'audiooutput');
      
      setDevices({ audioInputs, videoInputs, audioOutputs });
      
      console.log('Available devices:', {
        audioInputs: audioInputs.length,
        videoInputs: videoInputs.length,
        audioOutputs: audioOutputs.length
      });
      
      // If no devices found, show appropriate error
      if (isVideoCall && videoInputs.length === 0) {
        setMediaError('No camera detected. Please connect a camera and try again.');
      } else if (audioInputs.length === 0) {
        setMediaError('No microphone detected. Please connect a microphone and try again.');
      }
    } catch (error) {
      console.error('Error getting devices:', error);
      setMediaError('Failed to get media devices. Please check your browser permissions.');
    }
  }, [isVideoCall]);

  // Get user media stream
  const getUserMedia = useCallback(async (videoEnabled = isVideoCall, audioEnabled = true) => {
    if (!checkMediaSupport()) {
      throw new Error('Media devices not supported');
    }
    
    setMediaError(null);
    setIsInitializing(true);

    // Stop any existing tracks first
    if (localStream) {
      console.log('Stopping existing tracks before requesting new ones');
      localStream.getTracks().forEach(track => {
        track.stop();
      });
      setLocalStream(null);
    }

    const tryGetUserMedia = async (constraints, retryCount = 0) => {
      try {
        return await navigator.mediaDevices.getUserMedia(constraints);
      } catch (error) {
        if ((error.name === 'NotReadableError' || error.name === 'AbortError') && retryCount < 2) {
          console.log(`Device in use, attempt ${retryCount + 1}/3. Waiting before retry...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          return tryGetUserMedia(constraints, retryCount + 1);
        }
        throw error;
      }
    };
    
    try {
      console.log(`Requesting media access: video=${videoEnabled}, audio=${audioEnabled}`);
      
      const constraints = {
        audio: audioEnabled ? {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } : false,
        video: videoEnabled ? {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { max: 30 },
          facingMode: "user"
        } : false
      };

      // Try with optimized constraints first
      let stream;
      try {
        stream = await tryGetUserMedia(constraints);
      } catch (initialError) {
        console.warn('Failed with ideal constraints, trying with minimal constraints:', initialError);
        
        // Fall back to minimal constraints if optimal fails
        const fallbackConstraints = {
          audio: audioEnabled,
          video: videoEnabled
        };
        
        stream = await tryGetUserMedia(fallbackConstraints);
      }
      
      console.log('Media access granted:', stream);
      
      // Update permissions
      setHasPermissions({
        audio: audioEnabled && stream.getAudioTracks().length > 0,
        video: videoEnabled && stream.getVideoTracks().length > 0
      });
      
      setLocalStream(stream);
      setIsAudioEnabled(audioEnabled);
      setIsVideoEnabled(videoEnabled);

      // Attach to video element if exists
      if (localVideoRef.current && videoEnabled) {
        localVideoRef.current.srcObject = stream;
        console.log('Attached stream to video element');
      }
      
      // Once we have permissions, get full list of devices
      await getDevices();
      
      setIsInitializing(false);
      return stream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      setIsInitializing(false);
      
      let errorMessage = 'Failed to access media devices';
      
      if (error.name === 'NotAllowedError') {
        errorMessage = 'Camera/microphone access denied. Please allow permissions in your browser settings and try again.';
      } else if (error.name === 'NotFoundError') {
        errorMessage = videoEnabled 
          ? 'Camera and/or microphone not found. Please check your connections.' 
          : 'Microphone not found. Please check your connection.';
      } else if (error.name === 'NotReadableError' || error.name === 'AbortError') {
        errorMessage = 'Camera or microphone is being used by another application. Please:\n' +
          '1. Close other applications that might be using your camera (Zoom, Teams, other browser tabs, etc.)\n' +
          '2. Try refreshing this page\n' +
          '3. If the issue persists, try restarting your browser';
      } else if (error.name === 'SecurityError') {
        errorMessage = 'Media access is not allowed in this context due to security restrictions.';
      } else if (error.name === 'OverconstrainedError') {
        errorMessage = 'Requested media settings not available on your device.';
      }
      
      setMediaError(errorMessage);
      throw error;
    }
  }, [isVideoCall, checkMediaSupport, getDevices]);

  // Toggle audio track
  const toggleAudio = useCallback(() => {
    if (localStream) {
      const audioTracks = localStream.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
        console.log(`Audio ${track.enabled ? 'enabled' : 'disabled'}`);
      });
      setIsAudioEnabled(!isAudioEnabled);
    } else {
      console.error('Cannot toggle audio: No local stream available');
    }
  }, [localStream, isAudioEnabled]);

  // Toggle video track
  const toggleVideo = useCallback(() => {
    if (localStream) {
      const videoTracks = localStream.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = !track.enabled;
        console.log(`Video ${track.enabled ? 'enabled' : 'disabled'}`);
      });
      setIsVideoEnabled(!isVideoEnabled);
    } else {
      console.error('Cannot toggle video: No local stream available');
    }
  }, [localStream, isVideoEnabled]);

  // Start screen sharing
  const startScreenShare = useCallback(async () => {
    try {
      console.log('Requesting screen sharing');
      
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
          displaySurface: 'monitor'
        },
        audio: true
      });

      console.log('Screen sharing access granted');
      screenStreamRef.current = screenStream;
      setIsScreenSharing(true);

      // Listen for screen share end
      screenStream.getVideoTracks()[0].addEventListener('ended', () => {
        console.log('Screen sharing ended by user');
        stopScreenShare();
      });

      return screenStream;
    } catch (error) {
      console.error('Error starting screen share:', error);
      
      let errorMessage = 'Failed to start screen sharing';
      if (error.name === 'NotAllowedError') {
        errorMessage = 'Screen sharing was denied. Please allow screen sharing to continue.';
      }
      
      setMediaError(errorMessage);
      throw error;
    }
  }, []);

  // Stop screen sharing
  const stopScreenShare = useCallback(() => {
    if (screenStreamRef.current) {
      console.log('Stopping screen sharing');
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
      setIsScreenSharing(false);
    }
  }, []);

  // Change audio input device
  const changeAudioInput = useCallback(async (deviceId) => {
    try {
      console.log('Changing audio input to device:', deviceId);
      
      const constraints = {
        audio: { deviceId: { exact: deviceId } },
        video: isVideoEnabled
      };
      
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Replace audio track in existing stream
      if (localStream) {
        const audioTrack = newStream.getAudioTracks()[0];
        const oldAudioTrack = localStream.getAudioTracks()[0];
        
        if (oldAudioTrack) {
          localStream.removeTrack(oldAudioTrack);
          oldAudioTrack.stop();
        }
        
        localStream.addTrack(audioTrack);
        console.log('Audio input device changed successfully');
      }
    } catch (error) {
      console.error('Error changing audio input:', error);
      setMediaError('Failed to change audio input device. Please try again.');
    }
  }, [localStream, isVideoEnabled]);

  // Change video input device
  const changeVideoInput = useCallback(async (deviceId) => {
    try {
      console.log('Changing video input to device:', deviceId);
      
      const constraints = {
        audio: isAudioEnabled,
        video: { deviceId: { exact: deviceId } }
      };
      
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Replace video track in existing stream
      if (localStream) {
        const videoTrack = newStream.getVideoTracks()[0];
        const oldVideoTrack = localStream.getVideoTracks()[0];
        
        if (oldVideoTrack) {
          localStream.removeTrack(oldVideoTrack);
          oldVideoTrack.stop();
        }
        
        localStream.addTrack(videoTrack);
        
        // Update video element
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStream;
        }
        
        console.log('Video input device changed successfully');
      }
    } catch (error) {
      console.error('Error changing video input:', error);
      setMediaError('Failed to change video input device. Please try again.');
    }
  }, [localStream, isAudioEnabled]);

  // Stop all media tracks
  const stopMedia = useCallback(() => {
    if (localStream) {
      console.log('Stopping all media tracks');
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    
    if (screenStreamRef.current) {
      console.log('Stopping screen sharing');
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
      setIsScreenSharing(false);
    }
  }, [localStream]);

  // Initialize media on mount
  useEffect(() => {
    checkMediaSupport();
    checkPermissions();
    getDevices();
    
    // Listen for device changes
    navigator.mediaDevices.addEventListener('devicechange', getDevices);
    
    // Listen for reduce-video-quality events
    const handleReduceQuality = (event) => {
      if (!localStream) return;
      
      const videoTracks = localStream.getVideoTracks();
      if (videoTracks.length === 0) return;
      
      const videoTrack = videoTracks[0];
      
      try {
        // Reduce quality based on latency
        const latency = event.detail?.latency || 0;
        let constraints = {};
        
        if (latency > 500) {
          // Very high latency - reduce to minimum
          constraints = {
            width: { ideal: 320, max: 480 },
            height: { ideal: 240, max: 360 },
            frameRate: { ideal: 15, max: 20 }
          };
          console.log('Network issues detected - reducing to minimum quality');
        } else if (latency > 300) {
          // High latency - reduce to medium
          constraints = {
            width: { ideal: 480, max: 640 },
            height: { ideal: 360, max: 480 },
            frameRate: { ideal: 20, max: 24 }
          };
          console.log('Network issues detected - reducing to medium quality');
        }
        
        // Apply the constraints
        videoTrack.applyConstraints(constraints)
          .catch(err => console.warn('Could not apply reduced quality constraints:', err));
      } catch (error) {
        console.error('Error reducing video quality:', error);
      }
    };
    
    document.addEventListener('reduce-video-quality', handleReduceQuality);
    
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', getDevices);
      document.removeEventListener('reduce-video-quality', handleReduceQuality);
      stopMedia();
    };
  }, [checkMediaSupport, checkPermissions, getDevices, stopMedia, localStream]);

  // Attempt to retry getUserMedia if failed
  const retryGetUserMedia = useCallback(async (videoEnabled = isVideoCall, audioEnabled = true) => {
    setMediaError(null);
    return getUserMedia(videoEnabled, audioEnabled);
  }, [getUserMedia, isVideoCall]);

  return {
    localStream,
    localVideoRef,
    isAudioEnabled,
    isVideoEnabled,
    isScreenSharing,
    isInitializing,
    mediaError,
    hasPermissions,
    devices,
    getUserMedia,
    toggleAudio,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
    changeAudioInput,
    changeVideoInput,
    stopMedia,
    retryGetUserMedia
  };
}; 