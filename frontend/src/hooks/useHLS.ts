'use client';

import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

export interface HLSQuality {
  height: number;
  width: number;
  bitrate: number;
  level: number;
}

export interface UseHLSOptions {
  videoUrl?: string;
  hlsMasterUrl?: string;
  autoplay?: boolean;
  startTime?: number;
  onError?: (error: any) => void;
  onQualityChange?: (quality: HLSQuality) => void;
}

export function useHLS(options: UseHLSOptions) {
  const { videoUrl, hlsMasterUrl, autoplay, startTime, onError, onQualityChange } = options;

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [isHLS, setIsHLS] = useState(false);
  const [qualities, setQualities] = useState<HLSQuality[]>([]);
  const [currentQuality, setCurrentQuality] = useState<number>(-1); // -1 = auto
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!videoRef.current) return;

    const video = videoRef.current;

    // Determinar se usa HLS ou vídeo nativo
    const useHLS = hlsMasterUrl && hlsMasterUrl.includes('.m3u8');
    setIsHLS(useHLS);

    if (useHLS) {
      // Configurar HLS.js
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          backBufferLength: 90,
          maxBufferLength: 30,
          maxMaxBufferLength: 600,
          debug: false,
        });

        hlsRef.current = hls;

        hls.loadSource(hlsMasterUrl!);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
          console.log('HLS manifest parsed, levels:', data.levels);

          const hlsQualities: HLSQuality[] = data.levels.map((level, index) => ({
            height: level.height,
            width: level.width,
            bitrate: level.bitrate,
            level: index,
          }));

          setQualities(hlsQualities);
          setCurrentQuality(-1); // Auto quality
          setIsLoading(false);

          if (startTime && startTime > 0) {
            video.currentTime = startTime;
          }

          if (autoplay) {
            video.play().catch(err => {
              console.error('Autoplay failed:', err);
              setError('Autoplay bloqueado pelo navegador. Clique para reproduzir.');
            });
          }
        });

        hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
          const quality = qualities[data.level];
          if (quality && onQualityChange) {
            onQualityChange(quality);
          }
          setCurrentQuality(data.level);
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          console.error('HLS error:', data);

          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                setError('Erro de rede ao carregar vídeo');
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                setError('Erro ao reproduzir mídia');
                hls.recoverMediaError();
                break;
              default:
                setError('Erro fatal ao reproduzir vídeo HLS');
                hls.destroy();
                if (onError) onError(data);
                break;
            }
          }
        });

        return () => {
          hls.destroy();
        };

      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Suporte nativo HLS (Safari)
        video.src = hlsMasterUrl!;
        setIsLoading(false);

        if (startTime && startTime > 0) {
          video.addEventListener('loadedmetadata', () => {
            video.currentTime = startTime;
          }, { once: true });
        }

        if (autoplay) {
          video.play().catch(err => {
            console.error('Autoplay failed:', err);
            setError('Autoplay bloqueado pelo navegador. Clique para reproduzir.');
          });
        }

      } else {
        setError('HLS não suportado neste navegador');
        setIsLoading(false);
      }

    } else if (videoUrl) {
      // Vídeo direto (MP4, WebM, etc.)
      video.src = videoUrl;
      setIsLoading(false);

      if (startTime && startTime > 0) {
        video.addEventListener('loadedmetadata', () => {
          video.currentTime = startTime;
        }, { once: true });
      }

      if (autoplay) {
        video.play().catch(err => {
          console.error('Autoplay failed:', err);
          setError('Autoplay bloqueado pelo navegador. Clique para reproduzir.');
        });
      }
    }

  }, [videoUrl, hlsMasterUrl, autoplay, startTime, onError, onQualityChange]);

  const changeQuality = (levelIndex: number) => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = levelIndex;
      setCurrentQuality(levelIndex);
    }
  };

  const setAutoQuality = () => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = -1;
      setCurrentQuality(-1);
    }
  };

  return {
    videoRef,
    isHLS,
    qualities,
    currentQuality,
    isLoading,
    error,
    changeQuality,
    setAutoQuality,
  };
}
