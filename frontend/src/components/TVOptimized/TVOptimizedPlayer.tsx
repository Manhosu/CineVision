'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import VideoPlayer, { PlayerState } from '@/components/VideoPlayer/VideoPlayer';
import VideoControls from '@/components/VideoControls/VideoControls';
import SubtitleDisplay from '@/components/Subtitles/SubtitleDisplay';
import { useDeviceOptimization } from '@/hooks/useDeviceOptimization';
import { useSubtitles } from '@/hooks/useSubtitles';

export interface TVOptimizedPlayerProps {
  contentId: string;
  accessToken?: string;
  autoplay?: boolean;
  startTime?: number;
  onTimeUpdate?: (time: number) => void;
  onEnded?: () => void;
  onError?: (error: any) => void;
  className?: string;
}

const TVOptimizedPlayer: React.FC<TVOptimizedPlayerProps> = ({
  contentId,
  accessToken,
  autoplay = false,
  startTime = 0,
  onTimeUpdate,
  onEnded,
  onError,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [playerState, setPlayerState] = useState<PlayerState>({
    isLoading: true,
    isPlaying: false,
    duration: 0,
    currentTime: 0,
    buffered: 0,
    volume: 1,
    muted: false,
    fullscreen: false,
    qualities: [],
    activeQuality: null,
    error: null,
    canPlay: false,
  });

  const [focusedElement, setFocusedElement] = useState<string>('player');
  const [showControls, setShowControls] = useState(true);

  // Device optimization
  const {
    isSmartTV,
    capabilities,
    settings,
    getCSSClasses,
    shouldEnableFeature,
  } = useDeviceOptimization();

  // Subtitle integration
  const {
    currentCues,
    tracks: subtitleTracks,
    updateCurrentTime,
  } = useSubtitles({
    onCueChange: (cues) => {
      // Handle subtitle cue changes
    },
  });

  // TV-specific keyboard navigation
  useEffect(() => {
    if (!isSmartTV) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const { key } = event;

      // Prevent default browser behavior for arrow keys
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
        event.preventDefault();
      }

      switch (key) {
        // Playback controls
        case 'Enter':
        case ' ':
          event.preventDefault();
          playerState.isPlaying ? handlePause() : handlePlay();
          break;

        case 'MediaPlayPause':
        case 'PlayPause':
          playerState.isPlaying ? handlePause() : handlePlay();
          break;

        case 'MediaStop':
        case 'Stop':
          handlePause();
          handleSeek(0);
          break;

        // Volume controls
        case 'VolumeUp':
        case 'AudioVolumeUp':
          handleVolumeChange(Math.min(1, playerState.volume + 0.1));
          break;

        case 'VolumeDown':
        case 'AudioVolumeDown':
          handleVolumeChange(Math.max(0, playerState.volume - 0.1));
          break;

        case 'VolumeMute':
        case 'AudioVolumeMute':
          handleMuteToggle();
          break;

        // Seeking
        case 'MediaRewind':
        case 'Rewind':
          handleSeek(Math.max(0, playerState.currentTime - 10));
          break;

        case 'MediaFastForward':
        case 'FastForward':
          handleSeek(Math.min(playerState.duration, playerState.currentTime + 10));
          break;

        // Navigation
        case 'ArrowUp':
          setShowControls(true);
          setFocusedElement('controls');
          break;

        case 'ArrowDown':
          if (focusedElement === 'controls') {
            setFocusedElement('player');
            setShowControls(false);
          }
          break;

        case 'ArrowLeft':
          if (focusedElement === 'player') {
            handleSeek(Math.max(0, playerState.currentTime - 10));
          }
          break;

        case 'ArrowRight':
          if (focusedElement === 'player') {
            handleSeek(Math.min(playerState.duration, playerState.currentTime + 30));
          }
          break;

        // Menu navigation
        case 'Menu':
        case 'ContextMenu':
          event.preventDefault();
          setShowControls(!showControls);
          break;

        case 'Back':
        case 'Escape':
          if (playerState.fullscreen) {
            handleFullscreenToggle();
          } else if (showControls) {
            setShowControls(false);
          }
          break;

        // Info display
        case 'Info':
          // Show video info overlay
          break;

        // Channel/quality switching (using number keys)
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
          const qualityIndex = parseInt(key) - 1;
          if (playerState.qualities[qualityIndex]) {
            handleQualityChange((playerState.qualities[qualityIndex] as any)?.id);
          }
          break;
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      // Handle key release if needed for continuous actions
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [isSmartTV, playerState, focusedElement, showControls]);

  // Auto-hide controls on TV
  useEffect(() => {
    if (!isSmartTV || !showControls || !playerState.isPlaying) return;

    const timer = setTimeout(() => {
      setShowControls(false);
    }, 5000); // 5 seconds for TV

    return () => clearTimeout(timer);
  }, [isSmartTV, showControls, playerState.isPlaying]);

  // Player control handlers
  const handlePlay = useCallback(() => {
    // Implement play logic
    setPlayerState((prev: any) => ({ ...prev, isPlaying: true }));
  }, []);

  const handlePause = useCallback(() => {
    // Implement pause logic
    setPlayerState((prev: any) => ({ ...prev, isPlaying: false }));
  }, []);

  const handleSeek = useCallback((time: number) => {
    // Implement seek logic
    setPlayerState((prev: any) => ({ ...prev, currentTime: time }));
    updateCurrentTime(time);
    onTimeUpdate?.(time);
  }, [updateCurrentTime, onTimeUpdate]);

  const handleVolumeChange = useCallback((volume: number) => {
    setPlayerState((prev: any) => ({ ...prev, volume, muted: volume === 0 }));
  }, []);

  const handleMuteToggle = useCallback(() => {
    setPlayerState(prev => ({ ...prev, muted: !prev.muted }));
  }, []);

  const handleFullscreenToggle = useCallback(() => {
    setPlayerState(prev => ({ ...prev, fullscreen: !prev.fullscreen }));
  }, []);

  const handleQualityChange = useCallback((qualityId: string) => {
    setPlayerState(prev => ({
      ...prev,
      activeQuality: qualityId,
      qualities: prev.qualities.map((q: any) => ({
        ...q,
        active: q.id === qualityId
      }))
    }));
  }, []);

  const handlePlayerTimeUpdate = useCallback((time: number) => {
    setPlayerState(prev => ({ ...prev, currentTime: time }));
    updateCurrentTime(time);
    onTimeUpdate?.(time);
  }, [updateCurrentTime, onTimeUpdate]);

  // CSS classes for optimization
  const optimizationClasses = getCSSClasses();

  return (
    <div
      ref={containerRef}
      className={`
        relative w-full h-full bg-black
        ${isSmartTV ? 'tv-safe tv-device' : ''}
        ${optimizationClasses.join(' ')}
        ${className}
      `}
      tabIndex={0}
      role="application"
      aria-label="Video Player"
    >
      {/* Main video player */}
      <VideoPlayer
        contentId={contentId}
        accessToken={accessToken}
        autoplay={autoplay}
        startTime={startTime}
        onTimeUpdate={handlePlayerTimeUpdate}
        onEnded={onEnded}
        onError={onError}
        className="w-full h-full"
      />

      {/* Subtitle overlay */}
      <SubtitleDisplay
        cues={currentCues}
        options={{
          fontSize: isSmartTV ? 24 : 16,
          position: 'bottom',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
        }}
        containerWidth={capabilities.screenSize.width}
        containerHeight={capabilities.screenSize.height}
      />

      {/* TV-optimized controls */}
      {shouldEnableFeature('remote-control') && (
        <VideoControls
          playerState={playerState}
          onPlay={handlePlay}
          onPause={handlePause}
          onSeek={handleSeek}
          onVolumeChange={handleVolumeChange}
          onMuteToggle={handleMuteToggle}
          onFullscreenToggle={handleFullscreenToggle}
          onQualityChange={handleQualityChange}
          showSubtitles={subtitleTracks.length > 0}
          subtitles={subtitleTracks.map(track => ({
            id: track.id,
            label: track.label,
            active: track.active || false,
          }))}
          isTV={isSmartTV}
          className={showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}
        />
      )}

      {/* Focus indicator for TV navigation */}
      {isSmartTV && (
        <div
          className={`
            absolute inset-0 pointer-events-none border-4 transition-all duration-200
            ${focusedElement === 'player' ? 'border-primary-600' : 'border-transparent'}
          `}
          style={{
            boxShadow: focusedElement === 'player' ? '0 0 20px rgba(220, 38, 38, 0.5)' : 'none'
          }}
        />
      )}

      {/* TV-specific info overlay */}
      {isSmartTV && showControls && (
        <div className="absolute top-6 left-6 bg-dark-900/90 backdrop-blur-sm rounded-lg p-4 text-white">
          <div className="text-sm opacity-75">
            {capabilities.os} • {capabilities.browser}
          </div>
          <div className="text-xs opacity-50 mt-1">
            {capabilities.screenSize.width}×{capabilities.screenSize.height} • {settings.maxQuality}
          </div>
        </div>
      )}

      {/* Performance indicator (development only) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute top-6 right-6 bg-dark-900/90 backdrop-blur-sm rounded-lg p-2 text-xs text-white">
          <div>RAM: {capabilities.ram}GB</div>
          <div>Type: {capabilities.type}</div>
          <div>Quality: {settings.maxQuality}</div>
          <div>Buffer: {settings.bufferSize}s</div>
        </div>
      )}

      {/* Custom styles for TV optimization */}
      <style jsx>{`
        .tv-device {
          cursor: none; /* Hide cursor on TV */
        }

        .tv-device * {
          -webkit-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
          user-select: none;
        }

        .tv-device .focus-tv:focus {
          outline: 3px solid #dc2626;
          outline-offset: 4px;
        }

        /* Disable animations on low-end devices */
        .no-animations * {
          animation: none !important;
          transition: none !important;
        }

        .no-shadows * {
          box-shadow: none !important;
          text-shadow: none !important;
        }

        .no-blur-effects * {
          backdrop-filter: none !important;
          filter: none !important;
        }

        /* High contrast mode for better TV visibility */
        @media (prefers-contrast: high) {
          .tv-device {
            filter: contrast(1.2);
          }
        }
      `}</style>
    </div>
  );
};

export default TVOptimizedPlayer;