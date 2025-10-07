'use client';

import { useState, useEffect, useCallback } from 'react';
import { chromecastService, MediaMetadata } from '@/services/chromecastService';
import { CastSession } from '@/types/video';

export interface UseChromecastReturn {
  // State
  isAvailable: boolean;
  isConnected: boolean;
  hasReceivers: boolean;
  currentSession: CastSession | null;
  mediaStatus: {
    currentTime: number;
    duration: number;
    playerState: string;
    volume: number;
    muted: boolean;
  } | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  requestSession: () => Promise<void>;
  endSession: () => Promise<void>;
  loadMedia: (contentUrl: string, contentType: string, metadata: MediaMetadata, startTime?: number) => Promise<void>;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  stop: () => Promise<void>;
  seek: (time: number) => Promise<void>;
  setVolume: (level: number) => Promise<void>;
  mute: () => Promise<void>;
  unmute: () => Promise<void>;
  clearError: () => void;
}

export const useChromecast = (): UseChromecastReturn => {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [hasReceivers, setHasReceivers] = useState(false);
  const [currentSession, setCurrentSession] = useState<CastSession | null>(null);
  const [mediaStatus, setMediaStatus] = useState<{
    currentTime: number;
    duration: number;
    playerState: string;
    volume: number;
    muted: boolean;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize Chromecast service and set up event listeners
  useEffect(() => {
    const updateAvailability = () => {
      setIsAvailable(chromecastService.isAvailable());
    };

    const updateSession = () => {
      const session = chromecastService.getCurrentSession();
      setCurrentSession(session);
      setIsConnected(!!session);
    };

    const updateMediaStatus = () => {
      const status = chromecastService.getMediaStatus();
      setMediaStatus(status);
    };

    // Event listeners
    const handleInitialized = () => {
      updateAvailability();
      updateSession();
      updateMediaStatus();
    };

    const handleReceiverAvailabilityChanged = (data: { available: boolean }) => {
      setHasReceivers(data.available);
    };

    const handleSessionCreated = (data: { session: CastSession }) => {
      setCurrentSession(data.session);
      setIsConnected(true);
      setIsLoading(false);
      setError(null);
    };

    const handleSessionEnded = () => {
      setCurrentSession(null);
      setIsConnected(false);
      setMediaStatus(null);
      setIsLoading(false);
    };

    const handleMediaLoaded = () => {
      updateMediaStatus();
      setIsLoading(false);
      setError(null);
    };

    const handleMediaUpdate = (data: {
      currentTime: number;
      duration: number;
      playerState: string;
      volume: number;
      muted: boolean;
    }) => {
      setMediaStatus(data);
    };

    const handleMediaEnded = () => {
      setMediaStatus(null);
    };

    const handleError = (data: { code: string; message: string }) => {
      setError(`${data.code}: ${data.message}`);
      setIsLoading(false);
    };

    // Set up event listeners
    chromecastService.on('initialized', handleInitialized);
    chromecastService.on('receiverAvailabilityChanged', handleReceiverAvailabilityChanged);
    chromecastService.on('sessionCreated', handleSessionCreated);
    chromecastService.on('sessionEnded', handleSessionEnded);
    chromecastService.on('mediaLoaded', handleMediaLoaded);
    chromecastService.on('mediaUpdate', handleMediaUpdate);
    chromecastService.on('mediaEnded', handleMediaEnded);
    chromecastService.on('error', handleError);

    // Initial state update
    updateAvailability();
    updateSession();
    updateMediaStatus();

    return () => {
      // Cleanup event listeners
      chromecastService.off('initialized', handleInitialized);
      chromecastService.off('receiverAvailabilityChanged', handleReceiverAvailabilityChanged);
      chromecastService.off('sessionCreated', handleSessionCreated);
      chromecastService.off('sessionEnded', handleSessionEnded);
      chromecastService.off('mediaLoaded', handleMediaLoaded);
      chromecastService.off('mediaUpdate', handleMediaUpdate);
      chromecastService.off('mediaEnded', handleMediaEnded);
      chromecastService.off('error', handleError);
    };
  }, []);

  // Action handlers
  const requestSession = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      await chromecastService.requestSession();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create Cast session';
      setError(errorMessage);
      setIsLoading(false);
    }
  }, []);

  const endSession = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      await chromecastService.endSession();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to end Cast session';
      setError(errorMessage);
      setIsLoading(false);
    }
  }, []);

  const loadMedia = useCallback(async (
    contentUrl: string,
    contentType: string,
    metadata: MediaMetadata,
    startTime: number = 0
  ): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      await chromecastService.loadMedia(contentUrl, contentType, metadata, startTime);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load media';
      setError(errorMessage);
      setIsLoading(false);
    }
  }, []);

  const play = useCallback(async (): Promise<void> => {
    try {
      setError(null);
      await chromecastService.play();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to play';
      setError(errorMessage);
    }
  }, []);

  const pause = useCallback(async (): Promise<void> => {
    try {
      setError(null);
      await chromecastService.pause();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to pause';
      setError(errorMessage);
    }
  }, []);

  const stop = useCallback(async (): Promise<void> => {
    try {
      setError(null);
      await chromecastService.stop();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to stop';
      setError(errorMessage);
    }
  }, []);

  const seek = useCallback(async (time: number): Promise<void> => {
    try {
      setError(null);
      await chromecastService.seek(time);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to seek';
      setError(errorMessage);
    }
  }, []);

  const setVolume = useCallback(async (level: number): Promise<void> => {
    try {
      setError(null);
      await chromecastService.setVolume(level);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to set volume';
      setError(errorMessage);
    }
  }, []);

  const mute = useCallback(async (): Promise<void> => {
    try {
      setError(null);
      await chromecastService.mute();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to mute';
      setError(errorMessage);
    }
  }, []);

  const unmute = useCallback(async (): Promise<void> => {
    try {
      setError(null);
      await chromecastService.unmute();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to unmute';
      setError(errorMessage);
    }
  }, []);

  const clearError = useCallback((): void => {
    setError(null);
  }, []);

  return {
    // State
    isAvailable,
    isConnected,
    hasReceivers,
    currentSession,
    mediaStatus,
    isLoading,
    error,

    // Actions
    requestSession,
    endSession,
    loadMedia,
    play,
    pause,
    stop,
    seek,
    setVolume,
    mute,
    unmute,
    clearError,
  };
};