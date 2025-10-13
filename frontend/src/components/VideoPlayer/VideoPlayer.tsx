'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import VideoOverlay from '@/components/VideoOverlay/VideoOverlay';

// Dynamic imports for client-only hooks
const useChromecastDynamic = () => {
  if (typeof window === 'undefined') {
    return { isAvailable: false, loadMedia: () => {} };
  }
  const { useChromecast } = require('@/hooks/useChromecast');
  return useChromecast();
};

const useAirPlayDynamic = () => {
  if (typeof window === 'undefined') {
    return { isAvailable: false, setupVideoElement: () => {} };
  }
  const { useAirPlay } = require('@/hooks/useAirPlay');
  return useAirPlay();
};

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

  // Use dynamic hooks for Chromecast and AirPlay (client-only)
  const {
    isAvailable: castAvailable,
    isConnected: castConnected,
    loadMedia: castLoadMedia,
    requestSession: castRequestSession,
  } = useChromecastDynamic();

  const {
    isAvailable: airplayAvailable,
    setupVideoElement: setupAirPlayVideo,
    showDevicePicker: showAirPlayPicker,
  } = useAirPlayDynamic();

  // Check if video format is supported
  const isUnsupportedFormat = (url?: string): boolean => {
    if (!url) return false;
    const extension = url.split('.').pop()?.toLowerCase();
    return extension === 'mkv' || extension === 'avi' || extension === 'wmv';
  };

  const [playerState, setPlayerState] = useState<PlayerState>({
    isLoading: false,
    isPlaying: false,
    duration: 0,
    currentTime: 0,
    buffered: 0,
    volume: 1,
    muted: muted,
    fullscreen: false,
    qualities: [],
    activeQuality: null,
    error: videoUrl && isUnsupportedFormat(videoUrl)
      ? `Formato de vídeo não suportado (.${videoUrl.split('.').pop()}). Por favor, contate o suporte ou tente outro idioma.`
      : videoUrl ? null : 'No video URL provided',
    canPlay: false,
  });

  // Clear error and set loading state when videoUrl changes
  useEffect(() => {
    if (videoUrl) {
      setPlayerState(prev => ({
        ...prev,
        error: isUnsupportedFormat(videoUrl)
          ? `Formato de vídeo não suportado (.${videoUrl.split('.').pop()}). Por favor, contate o suporte ou tente outro idioma.`
          : null,
        isLoading: true,
      }));
    } else {
      setPlayerState(prev => ({
        ...prev,
        error: 'No video URL provided',
        isLoading: false,
      }));
    }
  }, [videoUrl]);

  // AirPlay setup
  useEffect(() => {
    if (videoRef.current && airplayAvailable) {
      setupAirPlayVideo(videoRef.current);
    }
  }, [airplayAvailable, setupAirPlayVideo]);

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
      console.log('[VideoPlayer] Video play event fired');
      setPlayerState(prev => ({ ...prev, isPlaying: true }));
    };

    const handlePause = () => {
      console.log('[VideoPlayer] Video pause event fired');
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
    console.log('[VideoPlayer] Play button clicked');
    if (videoRef.current) {
      try {
        await videoRef.current.play();
        console.log('[VideoPlayer] Video play() executed successfully');
      } catch (error) {
        console.error('[VideoPlayer] Failed to play video:', error);
      }
    } else {
      console.error('[VideoPlayer] Video ref is null');
    }
  }, []);

  const pause = useCallback(() => {
    console.log('[VideoPlayer] Pause button clicked');
    if (videoRef.current) {
      videoRef.current.pause();
      console.log('[VideoPlayer] Video pause() executed successfully');
    } else {
      console.error('[VideoPlayer] Video ref is null');
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
    console.log('[VideoPlayer] Back button clicked, onBackToCatalog:', onBackToCatalog);
    if (onBackToCatalog) {
      onBackToCatalog();
    } else {
      console.log('[VideoPlayer] Navigating to dashboard');
      router.push('/dashboard');
    }
  }, [onBackToCatalog, router]);

  // Chromecast and AirPlay handlers
  const handleChromecastClick = useCallback(async () => {
    if (!castAvailable || !videoUrl) {
      console.warn('[VideoPlayer] Chromecast not available or no video URL');
      return;
    }

    try {
      console.log('[VideoPlayer] Chromecast button clicked');

      // Se não estiver conectado, solicita conexão primeiro
      if (!castConnected) {
        console.log('[VideoPlayer] Requesting Chromecast session...');
        await castRequestSession();

        // Aguarda um pouco para a sessão ser estabelecida
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Carrega o mídia no Chromecast
      console.log('[VideoPlayer] Loading media on Chromecast...');
      await castLoadMedia(
        videoUrl,
        'video/mp4',
        {
          type: 0,
          metadataType: 0,
          title: title || 'Video',
          subtitle: subtitle || '',
          images: poster ? [{ url: poster }] : [],
        },
        playerState.currentTime
      );

      console.log('[VideoPlayer] Media loaded successfully on Chromecast');

      // Pausa o vídeo local
      if (videoRef.current) {
        videoRef.current.pause();
      }
    } catch (error) {
      console.error('[VideoPlayer] Chromecast error:', error);
      alert('Erro ao conectar ao Chromecast. Verifique se há dispositivos disponíveis na rede.');
    }
  }, [castAvailable, castConnected, castLoadMedia, castRequestSession, videoUrl, title, subtitle, poster, playerState.currentTime]);

  const handleAirPlayClick = useCallback(() => {
    if (!airplayAvailable) {
      console.warn('[VideoPlayer] AirPlay not available');
      return;
    }

    try {
      console.log('[VideoPlayer] AirPlay button clicked - showing device picker');
      showAirPlayPicker();
    } catch (error) {
      console.error('[VideoPlayer] AirPlay error:', error);
      alert('Erro ao ativar AirPlay. Certifique-se de estar usando Safari ou um dispositivo Apple.');
    }
  }, [airplayAvailable, showAirPlayPicker]);

  // Render error state
  if (playerState.error) {
    return (
      <div className={`video-container ${className}`}>
        <div className="flex items-center justify-center h-full bg-dark-900 p-6 min-h-[400px]">
          <div className="text-center max-w-md">
            <div className="text-red-500 mb-4 text-5xl">⚠️</div>
            <h3 className="text-white font-bold text-xl mb-3">Erro ao Reproduzir Vídeo</h3>
            <p className="text-gray-300 text-sm mb-6 leading-relaxed">{playerState.error}</p>
            <div className="space-y-3">
              <button
                onClick={() => router.push(`/watch/${contentId}`)}
                className="btn-primary w-full"
              >
                Tentar Outro Idioma
              </button>
              <button
                onClick={() => router.push('/dashboard')}
                className="btn-secondary w-full"
              >
                Voltar ao Dashboard
              </button>
            </div>
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
        showChromecast={castAvailable}
        showAirPlay={airplayAvailable}
        onChromecastClick={handleChromecastClick}
        onAirPlayClick={handleAirPlayClick}
      />

      {/* Loading Overlay */}
      {playerState.isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-dark-900/80 backdrop-blur-sm z-50">
          <div className="flex items-center space-x-3">
            <div className="animate-spin w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full"></div>
            <span className="text-white text-lg">Carregando vídeo...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;
