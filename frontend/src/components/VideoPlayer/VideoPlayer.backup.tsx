'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import 'shaka-player/dist/controls.css';
import { useChromecast } from '@/hooks/useChromecast';
import { useAirPlay } from '@/hooks/useAirPlay';
import ChromecastButton from '@/components/ChromecastButton/ChromecastButton';
import AirPlayButton from '@/components/AirPlayButton/AirPlayButton';
import VideoOverlay from '@/components/VideoOverlay/VideoOverlay';

// Dynamic import for shaka-player (client-side only)
declare const shaka: any;

export interface VideoPlayerProps {
  contentId: string;
  title?: string;
  subtitle?: string;
  autoplay?: boolean;
  muted?: boolean;
  poster?: string;
  onTimeUpdate?: (currentTime: number) => void;
  onProgress?: (buffered: number) => void;
  onError?: (error: any) => void;
  onLoadStart?: () => void;
  onCanPlay?: () => void;
  onEnded?: () => void;
  onBackToCatalog?: () => void;
  className?: string;
  accessToken?: string;
  startTime?: number;
}

export interface QualityLevel {
  height: number;
  width: number;
  bandwidth: number;
  id: string;
  active: boolean;
}

export interface PlayerState {
  isLoading: boolean;
  isPlaying: boolean;
  duration: number;
  currentTime: number;
  buffered: number;
  volume: number;
  muted: boolean;
  fullscreen: boolean;
  qualities: QualityLevel[];
  activeQuality: string | null;
  error: string | null;
  canPlay: boolean;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  contentId,
  title = '',
  subtitle = '',
  autoplay = false,
  muted = false,
  poster,
  onTimeUpdate,
  onProgress,
  onError,
  onLoadStart,
  onCanPlay,
  onEnded,
  onBackToCatalog,
  className = '',
  accessToken,
  startTime = 0,
}) => {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<any>(null);
  const uiRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Chromecast integration
  const {
    isAvailable: castAvailable,
    isConnected: castConnected,
    loadMedia: castLoadMedia,
    currentSession: castSession,
  } = useChromecast();

  // AirPlay integration
  const {
    isAvailable: airplayAvailable,
    isConnected: airplayConnected,
    setupVideoElement: setupAirPlayVideo,
  } = useAirPlay();

  const [playerState, setPlayerState] = useState<PlayerState>({
    isLoading: true,
    isPlaying: false,
    duration: 0,
    currentTime: 0,
    buffered: 0,
    volume: 1,
    muted: muted,
    fullscreen: false,
    qualities: [],
    activeQuality: null,
    error: null,
    canPlay: false,
  });

  const [streamData, setStreamData] = useState<{
    streamUrl: string;
    manifestUrl: string;
    accessToken: string;
    qualities: string[];
  } | null>(null);

  // Fetch streaming URLs from backend
  const fetchStreamData = useCallback(async () => {
    if (!contentId) return;

    try {
      setPlayerState(prev => ({ ...prev, isLoading: true, error: null }));

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/content/${contentId}/stream`,
        {
          method: 'GET',
          headers,
          credentials: 'include',
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required for this content');
        } else if (response.status === 403) {
          throw new Error('You do not have access to this content');
        } else if (response.status === 404) {
          throw new Error('Content not found or not ready for streaming');
        }
        throw new Error(`Failed to load streaming data: ${response.statusText}`);
      }

      const data = await response.json();
      setStreamData(data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load video';
      setPlayerState(prev => ({ ...prev, error: errorMessage, isLoading: false }));
      onError?.(error);
    }
  }, [contentId, accessToken, onError]);

  // Initialize Shaka Player
  useEffect(() => {
    if (!videoRef.current || !streamData) return;

    const initPlayer = async () => {
      try {
        // Load shaka-player for client-side only
        const shaka = (window as any).shaka || (typeof require !== 'undefined' ? require('shaka-player/dist/shaka-player.ui') : null);
        if (!shaka) {
          throw new Error('Shaka Player could not be loaded');
        }

        // Install polyfills
        shaka.polyfill.installAll();

        // Check browser support
        if (!shaka.Player.isBrowserSupported()) {
          throw new Error('Browser is not supported by Shaka Player');
        }

        // Create player
        const player = new shaka.Player(videoRef.current);
        playerRef.current = player;

        // Configure player for better compatibility
        player.configure({
          streaming: {
            rebufferingGoal: 10, // Seconds of content to buffer ahead
            bufferingGoal: 20, // Total amount to buffer
            bufferBehind: 30, // Keep 30s behind current position
            retryParameters: {
              timeout: 30000, // 30 seconds
              maxAttempts: 4,
              baseDelay: 1000,
              backoffFactor: 2,
            },
          },
          // Optimize for various devices
          abr: {
            enabled: true,
            useNetworkInformation: true, // Use Network Information API if available
            defaultBandwidthEstimate: 500000, // Conservative default (500 Kbps)
            switchInterval: 8, // How often to switch quality (seconds)
            bandwidthUpgradeTarget: 0.85, // Switch up when 85% of bandwidth available
            bandwidthDowngradeTarget: 0.95, // Switch down when 95% of bandwidth used
          },
          // Manifest settings
          manifest: {
            retryParameters: {
              timeout: 30000,
              maxAttempts: 3,
              baseDelay: 1000,
              backoffFactor: 2,
            },
          },
          // DRM settings (if needed later)
          drm: {
            retryParameters: {
              timeout: 30000,
              maxAttempts: 3,
              baseDelay: 1000,
              backoffFactor: 2,
            },
          },
        });

        // Set up network request filters for authentication
        player.getNetworkingEngine().registerRequestFilter((type: any, request: any) => {
          // Add authentication headers to all requests
          if (streamData.accessToken) {
            request.headers['X-Access-Token'] = streamData.accessToken;
          }
        });

        // Error handling
        player.addEventListener('error', (event: any) => {
          const error = event.detail;
          console.error('Shaka Player Error:', error);
          setPlayerState(prev => ({
            ...prev,
            error: `Player Error: ${error.message || 'Unknown error'}`,
            isLoading: false
          }));
          onError?.(error);
        });

        // Adaptation events (quality changes)
        player.addEventListener('adaptation', () => {
          updateQualityInfo();
        });

        // Track loading states
        player.addEventListener('loading', () => {
          setPlayerState(prev => ({ ...prev, isLoading: true }));
        });

        player.addEventListener('loaded', () => {
          setPlayerState(prev => ({ ...prev, isLoading: false, canPlay: true }));
          onCanPlay?.();
        });

        // Load the manifest
        await player.load(streamData.manifestUrl);

        // Set start time if specified
        if (startTime > 0 && videoRef.current) {
          videoRef.current.currentTime = startTime;
        }

        // Setup AirPlay for the video element
        if (videoRef.current && airplayAvailable) {
          setupAirPlayVideo(videoRef.current);
        }

        // Update quality information
        updateQualityInfo();

        // Create UI overlay but disable all default controls
        if (containerRef.current) {
          const ui = new shaka.ui.Overlay(player, containerRef.current, videoRef.current);
          uiRef.current = ui;

          // Disable all default UI controls since we're using our custom overlay
          ui.configure({
            addSeekBar: false,
            addBigPlayButton: false,
            controlPanelElements: [], // Empty array to remove all controls
            seekBarColors: {
              base: 'rgba(255, 255, 255, 0.3)',
              buffered: 'rgba(255, 255, 255, 0.5)',
              played: '#dc2626', // Primary red color
            },
            castReceiverAppId: process.env.NEXT_PUBLIC_CHROMECAST_APP_ID || 'CC1AD845',
          });
        }

      } catch (error) {
        console.error('Failed to initialize Shaka Player:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to initialize player';
        setPlayerState(prev => ({ ...prev, error: errorMessage, isLoading: false }));
        onError?.(error);
      }
    };

    initPlayer();

    return () => {
      if (uiRef.current) {
        uiRef.current.destroy();
        uiRef.current = null;
      }
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [streamData, startTime, onError, onCanPlay]);

  // Update quality information
  const updateQualityInfo = useCallback(() => {
    if (!playerRef.current) return;

    try {
      const tracks = playerRef.current.getVariantTracks();
      const activeTrack = tracks.find((track: any) => track.active);

      const qualities: QualityLevel[] = tracks
        .filter((track: any, index: number, self: any[]) =>
          index === self.findIndex((t: any) => t.height === track.height)
        )
        .map((track: any) => ({
          height: track.height || 0,
          width: track.width || 0,
          bandwidth: track.bandwidth || 0,
          id: `${track.height}p`,
          active: track.active || false,
        }))
        .sort((a: any, b: any) => b.height - a.height);

      setPlayerState(prev => ({
        ...prev,
        qualities,
        activeQuality: activeTrack ? `${activeTrack.height}p` : null,
      }));
    } catch (error) {
      console.error('Failed to update quality info:', error);
    }
  }, []);

  // Video event handlers
  useEffect(() => {
    if (!videoRef.current) return;

    const video = videoRef.current;

    const handleLoadStart = () => {
      onLoadStart?.();
    };

    const handleTimeUpdate = () => {
      const currentTime = video.currentTime;
      setPlayerState(prev => ({ ...prev, currentTime }));
      onTimeUpdate?.(currentTime);
    };

    const handleProgress = () => {
      if (video.buffered.length > 0) {
        const buffered = video.buffered.end(video.buffered.length - 1);
        setPlayerState(prev => ({ ...prev, buffered }));
        onProgress?.(buffered);
      }
    };

    const handleLoadedMetadata = () => {
      setPlayerState(prev => ({ ...prev, duration: video.duration }));
    };

    const handlePlay = () => {
      setPlayerState(prev => ({ ...prev, isPlaying: true }));
    };

    const handlePause = () => {
      setPlayerState(prev => ({ ...prev, isPlaying: false }));
    };

    const handleVolumeChange = () => {
      setPlayerState(prev => ({
        ...prev,
        volume: video.volume,
        muted: video.muted
      }));
    };

    const handleEnded = () => {
      setPlayerState(prev => ({ ...prev, isPlaying: false }));
      onEnded?.();
    };

    const handleFullscreenChange = () => {
      const isFullscreen = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      setPlayerState(prev => ({ ...prev, fullscreen: isFullscreen }));
    };

    video.addEventListener('loadstart', handleLoadStart);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('progress', handleProgress);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('volumechange', handleVolumeChange);
    video.addEventListener('ended', handleEnded);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    return () => {
      video.removeEventListener('loadstart', handleLoadStart);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('progress', handleProgress);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('volumechange', handleVolumeChange);
      video.removeEventListener('ended', handleEnded);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, [onTimeUpdate, onProgress, onLoadStart, onEnded]);

  // Fetch stream data on mount or contentId change
  useEffect(() => {
    fetchStreamData();
  }, [fetchStreamData]);

  // Chromecast integration
  const handleCastStart = useCallback(async () => {
    if (!streamData || !videoRef.current) return;

    try {
      const currentTime = videoRef.current.currentTime;
      const metadata = {
        title: `Content ${contentId}`, // You might want to pass actual title
        subtitle: 'Cine Vision',
        description: 'Streaming from Cine Vision',
        // image: poster, // Uncomment if poster available
      };

      await castLoadMedia(
        streamData.manifestUrl,
        'application/x-mpegurl', // HLS MIME type
        metadata,
        currentTime
      );

      // Pause local video when casting starts
      if (videoRef.current) {
        videoRef.current.pause();
      }
    } catch (error) {
      console.error('Failed to start casting:', error);
      onError?.(error);
    }
  }, [streamData, contentId, castLoadMedia, onError]);

  // Handle cast session changes
  useEffect(() => {
    if (castConnected && castSession) {
      handleCastStart();
    }
  }, [castConnected, castSession, handleCastStart]);

  // Handle AirPlay connection changes
  useEffect(() => {
    if (airplayConnected && videoRef.current) {
      // Pause local video when AirPlay is active
      videoRef.current.pause();
      console.log('AirPlay connection detected, pausing local video');
    }
  }, [airplayConnected]);

  // Player control methods (exposed via ref if needed)
  const play = useCallback(async () => {
    if (videoRef.current) {
      try {
        await videoRef.current.play();
      } catch (error) {
        console.error('Failed to play video:', error);
      }
    }
  }, []);

  const pause = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.pause();
    }
  }, []);

  const seek = useCallback((time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  }, []);

  const setQuality = useCallback((qualityId: string) => {
    if (!playerRef.current) return;

    try {
      const tracks = playerRef.current.getVariantTracks();
      const targetTrack = tracks.find((track: any) => `${track.height}p` === qualityId);

      if (targetTrack) {
        playerRef.current.selectVariantTrack(targetTrack, /* clearBuffer= */ true);
      }
    } catch (error) {
      console.error('Failed to set quality:', error);
    }
  }, []);

  // Additional control functions for the overlay
  const handleVolumeChange = useCallback((volume: number) => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
      setPlayerState(prev => ({ ...prev, volume }));
    }
  }, []);

  const handleMuteToggle = useCallback(() => {
    if (videoRef.current) {
      const newMuted = !videoRef.current.muted;
      videoRef.current.muted = newMuted;
      setPlayerState(prev => ({ ...prev, muted: newMuted }));
    }
  }, []);

  const handleFullscreenToggle = useCallback(() => {
    if (!containerRef.current) return;

    try {
      if (!document.fullscreenElement) {
        containerRef.current.requestFullscreen();
        setPlayerState(prev => ({ ...prev, fullscreen: true }));
      } else {
        document.exitFullscreen();
        setPlayerState(prev => ({ ...prev, fullscreen: false }));
      }
    } catch (error) {
      console.error('Fullscreen error:', error);
    }
  }, []);

  const handleBackToCatalog = useCallback(() => {
    if (onBackToCatalog) {
      onBackToCatalog();
    } else {
      router.push('/');
    }
  }, [onBackToCatalog, router]);

  const handleChromecastClick = useCallback(() => {
    if (castConnected) {
      // Handle disconnect or show cast controls
      console.log('Chromecast is connected');
    } else if (castAvailable) {
      // Trigger cast
      handleCastStart();
    }
  }, [castConnected, castAvailable, handleCastStart]);

  const handleAirPlayClick = useCallback(() => {
    if (videoRef.current && airplayAvailable) {
      // Trigger AirPlay picker
      const video = videoRef.current as any;
      if (video.webkitShowPlaybackTargetPicker) {
        video.webkitShowPlaybackTargetPicker();
      }
    }
  }, [airplayAvailable]);

  // Render loading state
  if (playerState.isLoading && !streamData) {
    return (
      <div className={`video-container ${className}`}>
        <div className="flex items-center justify-center h-full bg-dark-900">
          <div className="flex items-center space-x-3">
            <div className="animate-spin w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full"></div>
            <span className="text-white">Loading video...</span>
          </div>
        </div>
      </div>
    );
  }

  // Render error state
  if (playerState.error) {
    return (
      <div className={`video-container ${className}`}>
        <div className="flex items-center justify-center h-full bg-dark-900 p-6">
          <div className="text-center">
            <div className="text-red-500 mb-2">⚠️</div>
            <h3 className="text-white font-medium mb-2">Video Error</h3>
            <p className="text-gray-400 text-sm mb-4">{playerState.error}</p>
            <button
              onClick={fetchStreamData}
              className="btn-primary"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`video-container relative ${className}`}
      data-shaka-player-container
    >
      <video
        ref={videoRef}
        className="w-full h-full"
        autoPlay={autoplay}
        muted={muted}
        poster={poster}
        playsInline
        data-shaka-player
      />
      
      {/* Custom Video Overlay */}
      <VideoOverlay
        title={title}
        subtitle={subtitle}
        isPlaying={playerState.isPlaying}
        currentTime={playerState.currentTime}
        duration={playerState.duration}
        buffered={playerState.buffered}
        volume={playerState.volume}
        muted={playerState.muted}
        fullscreen={playerState.fullscreen}
        onPlay={play}
        onPause={pause}
        onSeek={seek}
        onVolumeChange={handleVolumeChange}
        onMuteToggle={handleMuteToggle}
        onFullscreenToggle={handleFullscreenToggle}
        onBackToCatalog={handleBackToCatalog}
        showChromecast={castAvailable}
        showAirPlay={airplayAvailable}
        onChromecastClick={handleChromecastClick}
        onAirPlayClick={handleAirPlayClick}
      />
    </div>
  );
};

export default VideoPlayer;