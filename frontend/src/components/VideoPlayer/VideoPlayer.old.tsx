'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import VideoOverlay from '@/components/VideoOverlay/VideoOverlay';

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
  videoUrl?: string; // Direct video URL (for MP4, MKV, WebM, etc.)
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
  videoUrl,
}) => {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [playerState, setPlayerState] = useState<PlayerState>({
    isLoading: false, // Loading if no direct URL provided
    isPlaying: false,
    duration: 0,
    currentTime: 0,
    buffered: 0,
    volume: 1,
    muted: muted,
    fullscreen: false,
    qualities: [],
    activeQuality: null,
    error: videoUrl ? null : 'No video URL provided',
    canPlay: false,
  });

  // Set start time when video is ready
  useEffect(() => {
    if (videoRef.current && startTime > 0) {
      const handleCanPlay = () => {
        if (videoRef.current) {
          videoRef.current.currentTime = startTime;
          videoRef.current.removeEventListener('canplay', handleCanPlay);
        }
      };
      videoRef.current.addEventListener('canplay', handleCanPlay);
      return () => {
        videoRef.current?.removeEventListener('canplay', handleCanPlay);
      };
    }
  }, [startTime]);

  // Video event handlers
  useEffect(() => {
    if (!videoRef.current) return;

    const video = videoRef.current;

    const handleLoadStart = () => {
      setPlayerState(prev => ({ ...prev, isLoading: true }));
      onLoadStart?.();
    };

    const handleCanPlay = () => {
      setPlayerState(prev => ({ ...prev, isLoading: false, canPlay: true, error: null }));
      onCanPlay?.();
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

    const handleError = (e: Event) => {
      const error = (e.target as HTMLVideoElement).error;
      const errorMessage = error?.message || 'Failed to load video';
      setPlayerState(prev => ({
        ...prev,
        error: errorMessage,
        isLoading: false
      }));
      onError?.(error);
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
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('progress', handleProgress);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('volumechange', handleVolumeChange);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('error', handleError);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    return () => {
      video.removeEventListener('loadstart', handleLoadStart);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('progress', handleProgress);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('volumechange', handleVolumeChange);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('error', handleError);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, [onTimeUpdate, onProgress, onLoadStart, onCanPlay, onEnded, onError]);

  // Player control methods
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

  // Render loading state
  if (playerState.isLoading && videoUrl) {
    return (
      <div className={`video-container ${className}`}>
        <div className="flex items-center justify-center h-full bg-dark-900 min-h-[400px]">
          <div className="flex items-center space-x-3">
            <div className="animate-spin w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full"></div>
            <span className="text-white">Carregando vídeo...</span>
          </div>
        </div>
      </div>
    );
  }

  // Render error state
  if (playerState.error) {
    return (
      <div className={`video-container ${className}`}>
        <div className="flex items-center justify-center h-full bg-dark-900 p-6 min-h-[400px]">
          <div className="text-center">
            <div className="text-red-500 mb-2 text-4xl">⚠️</div>
            <h3 className="text-white font-medium mb-2">Video Error</h3>
            <p className="text-gray-400 text-sm mb-4">{playerState.error}</p>
            <button
              onClick={() => window.location.reload()}
              className="btn-primary"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!videoUrl) {
    return (
      <div className={`video-container ${className}`}>
        <div className="flex items-center justify-center h-full bg-dark-900 p-6 min-h-[400px]">
          <div className="text-center">
            <div className="text-yellow-500 mb-2 text-4xl">⚠️</div>
            <h3 className="text-white font-medium mb-2">Content not found or not ready for streaming</h3>
            <p className="text-gray-400 text-sm mb-4">O vídeo não está disponível no momento</p>
            <button
              onClick={() => router.push('/dashboard')}
              className="btn-primary"
            >
              Voltar ao Dashboard
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
    >
      <video
        ref={videoRef}
        className="w-full h-full bg-black"
        autoPlay={autoplay}
        muted={muted}
        poster={poster}
        playsInline
        controls={false}
        crossOrigin="anonymous"
        src={videoUrl}
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
        showChromecast={false}
        showAirPlay={false}
        onChromecastClick={() => {}}
        onAirPlayClick={() => {}}
      />
    </div>
  );
};

export default VideoPlayer;
