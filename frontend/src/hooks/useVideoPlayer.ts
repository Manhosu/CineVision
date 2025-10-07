'use client';

import { useCallback, useRef, useState, useEffect } from 'react';
import { PlayerState, QualityLevel } from '@/components/VideoPlayer/VideoPlayer';

export interface UseVideoPlayerReturn {
  // Player state
  playerState: PlayerState;

  // Player controls
  play: () => Promise<void>;
  pause: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  mute: () => void;
  unmute: () => void;
  toggleMute: () => void;
  enterFullscreen: () => Promise<void>;
  exitFullscreen: () => Promise<void>;
  toggleFullscreen: () => Promise<void>;

  // Quality controls
  setQuality: (qualityId: string) => void;
  enableAutoQuality: () => void;

  // Playback analytics
  getPlaybackStats: () => PlaybackStats;

  // Player lifecycle
  retry: () => void;
  reset: () => void;
}

export interface PlaybackStats {
  totalPlayTime: number;
  bufferingTime: number;
  qualitySwitches: number;
  averageBandwidth: number;
  droppedFrames: number;
  bufferHealth: number;
}

export interface UseVideoPlayerOptions {
  contentId: string;
  accessToken?: string;
  autoplay?: boolean;
  startTime?: number;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onError?: (error: any) => void;
  onQualityChange?: (quality: QualityLevel) => void;
  onBuffering?: (isBuffering: boolean) => void;
}

export const useVideoPlayer = (options: UseVideoPlayerOptions): UseVideoPlayerReturn => {
  const {
    contentId,
    accessToken,
    autoplay = false,
    startTime = 0,
    onPlay,
    onPause,
    onEnded,
    onError,
    onQualityChange,
    onBuffering,
  } = options;

  const playerRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
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

  const [playbackStats, setPlaybackStats] = useState<PlaybackStats>({
    totalPlayTime: 0,
    bufferingTime: 0,
    qualitySwitches: 0,
    averageBandwidth: 0,
    droppedFrames: 0,
    bufferHealth: 0,
  });

  // Track playback time
  useEffect(() => {
    let startTime = Date.now();
    let isPlaying = playerState.isPlaying;

    const interval = setInterval(() => {
      if (isPlaying && !playerState.isLoading) {
        const elapsed = Date.now() - startTime;
        setPlaybackStats(prev => ({
          ...prev,
          totalPlayTime: prev.totalPlayTime + elapsed,
        }));
      }
      startTime = Date.now();
      isPlaying = playerState.isPlaying;
    }, 1000);

    return () => clearInterval(interval);
  }, [playerState.isPlaying, playerState.isLoading]);

  // Player control methods
  const play = useCallback(async (): Promise<void> => {
    if (!videoRef.current) return;

    try {
      await videoRef.current.play();
      onPlay?.();
    } catch (error) {
      console.error('Failed to play video:', error);
      onError?.(error);
    }
  }, [onPlay, onError]);

  const pause = useCallback((): void => {
    if (!videoRef.current) return;

    try {
      videoRef.current.pause();
      onPause?.();
    } catch (error) {
      console.error('Failed to pause video:', error);
    }
  }, [onPause]);

  const seek = useCallback((time: number): void => {
    if (!videoRef.current) return;

    try {
      videoRef.current.currentTime = Math.max(0, Math.min(time, playerState.duration));
    } catch (error) {
      console.error('Failed to seek video:', error);
    }
  }, [playerState.duration]);

  const setVolume = useCallback((volume: number): void => {
    if (!videoRef.current) return;

    try {
      const clampedVolume = Math.max(0, Math.min(1, volume));
      videoRef.current.volume = clampedVolume;
    } catch (error) {
      console.error('Failed to set volume:', error);
    }
  }, []);

  const mute = useCallback((): void => {
    if (!videoRef.current) return;
    videoRef.current.muted = true;
  }, []);

  const unmute = useCallback((): void => {
    if (!videoRef.current) return;
    videoRef.current.muted = false;
  }, []);

  const toggleMute = useCallback((): void => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
  }, []);

  const enterFullscreen = useCallback(async (): Promise<void> => {
    if (!videoRef.current) return;

    try {
      const element = videoRef.current.parentElement || videoRef.current;

      if (element.requestFullscreen) {
        await element.requestFullscreen();
      } else if ((element as any).webkitRequestFullscreen) {
        await (element as any).webkitRequestFullscreen();
      } else if ((element as any).mozRequestFullScreen) {
        await (element as any).mozRequestFullScreen();
      } else if ((element as any).msRequestFullscreen) {
        await (element as any).msRequestFullscreen();
      }
    } catch (error) {
      console.error('Failed to enter fullscreen:', error);
    }
  }, []);

  const exitFullscreen = useCallback(async (): Promise<void> => {
    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        await (document as any).webkitExitFullscreen();
      } else if ((document as any).mozCancelFullScreen) {
        await (document as any).mozCancelFullScreen();
      } else if ((document as any).msExitFullscreen) {
        await (document as any).msExitFullscreen();
      }
    } catch (error) {
      console.error('Failed to exit fullscreen:', error);
    }
  }, []);

  const toggleFullscreen = useCallback(async (): Promise<void> => {
    if (playerState.fullscreen) {
      await exitFullscreen();
    } else {
      await enterFullscreen();
    }
  }, [playerState.fullscreen, enterFullscreen, exitFullscreen]);

  const setQuality = useCallback((qualityId: string): void => {
    if (!playerRef.current) return;

    try {
      // This would be implemented based on the Shaka Player instance
      // For now, we'll track quality switches
      setPlaybackStats(prev => ({
        ...prev,
        qualitySwitches: prev.qualitySwitches + 1,
      }));

      // Find the quality level
      const quality = playerState.qualities.find(q => q.id === qualityId);
      if (quality) {
        onQualityChange?.(quality);
      }
    } catch (error) {
      console.error('Failed to set quality:', error);
    }
  }, [playerState.qualities, onQualityChange]);

  const enableAutoQuality = useCallback((): void => {
    if (!playerRef.current) return;

    try {
      // Enable adaptive bitrate streaming
      // This would configure Shaka Player's ABR manager
      console.log('Enabling auto quality selection');
    } catch (error) {
      console.error('Failed to enable auto quality:', error);
    }
  }, []);

  const getPlaybackStats = useCallback((): PlaybackStats => {
    // Get real-time stats from video element and player
    if (videoRef.current) {
      const video = videoRef.current;

      // Calculate buffer health
      let bufferHealth = 0;
      if (video.buffered.length > 0) {
        const bufferedEnd = video.buffered.end(video.buffered.length - 1);
        bufferHealth = Math.max(0, bufferedEnd - video.currentTime);
      }

      return {
        ...playbackStats,
        bufferHealth,
        droppedFrames: (video as any).webkitDroppedFrameCount || 0,
      };
    }

    return playbackStats;
  }, [playbackStats]);

  const retry = useCallback((): void => {
    setPlayerState(prev => ({
      ...prev,
      error: null,
      isLoading: true,
    }));

    // This would trigger a re-fetch and re-initialization
    console.log('Retrying video player initialization');
  }, []);

  const reset = useCallback((): void => {
    pause();
    seek(0);
    setPlayerState(prev => ({
      ...prev,
      currentTime: 0,
      isPlaying: false,
      error: null,
    }));
  }, [pause, seek]);

  // Set refs for external access
  const setVideoRef = useCallback((element: HTMLVideoElement | null) => {
    videoRef.current = element;
  }, []);

  const setPlayerRef = useCallback((player: any) => {
    playerRef.current = player;
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!videoRef.current || !playerState.canPlay) return;

      // Only handle shortcuts if video player is focused or if no input is focused
      const activeElement = document.activeElement;
      const isInputFocused = activeElement?.tagName === 'INPUT' ||
                            activeElement?.tagName === 'TEXTAREA' ||
                            activeElement?.contentEditable === 'true';

      if (isInputFocused) return;

      switch (event.key.toLowerCase()) {
        case ' ':
        case 'k':
          event.preventDefault();
          if (playerState.isPlaying) {
            pause();
          } else {
            play();
          }
          break;

        case 'f':
          event.preventDefault();
          toggleFullscreen();
          break;

        case 'm':
          event.preventDefault();
          toggleMute();
          break;

        case 'arrowleft':
          event.preventDefault();
          seek(playerState.currentTime - 10);
          break;

        case 'arrowright':
          event.preventDefault();
          seek(playerState.currentTime + 10);
          break;

        case 'arrowup':
          event.preventDefault();
          setVolume(Math.min(1, playerState.volume + 0.1));
          break;

        case 'arrowdown':
          event.preventDefault();
          setVolume(Math.max(0, playerState.volume - 0.1));
          break;

        case '0':
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9':
          event.preventDefault();
          const percent = parseInt(event.key) / 10;
          seek(playerState.duration * percent);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    playerState.canPlay,
    playerState.isPlaying,
    playerState.currentTime,
    playerState.duration,
    playerState.volume,
    play,
    pause,
    seek,
    setVolume,
    toggleMute,
    toggleFullscreen,
  ]);

  return {
    playerState,
    play,
    pause,
    seek,
    setVolume,
    mute,
    unmute,
    toggleMute,
    enterFullscreen,
    exitFullscreen,
    toggleFullscreen,
    setQuality,
    enableAutoQuality,
    getPlaybackStats,
    retry,
    reset,
    // Internal methods for VideoPlayer component
    setVideoRef,
    setPlayerRef,
  } as any;
};