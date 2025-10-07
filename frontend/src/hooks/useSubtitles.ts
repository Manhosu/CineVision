'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { subtitleService, SubtitleTrack, SubtitleCue, SubtitleOptions } from '@/services/subtitleService';

export interface UseSubtitlesReturn {
  // State
  tracks: SubtitleTrack[];
  activeTrack: SubtitleTrack | null;
  currentCues: SubtitleCue[];
  isLoading: boolean;
  error: string | null;

  // Actions
  addTrack: (track: SubtitleTrack) => Promise<void>;
  removeTrack: (trackId: string) => void;
  setActiveTrack: (trackId: string | null) => void;
  updateCurrentTime: (time: number) => void;
  searchSubtitles: (query: string, trackId?: string) => Array<{ cue: SubtitleCue; trackId: string }>;
  exportSubtitles: (trackId: string, format: 'vtt' | 'srt') => string;
  clearTracks: () => void;

  // Utilities
  getStats: (trackId?: string) => { trackCount: number; totalCues: number; duration: number; averageCueLength: number };
}

export interface UseSubtitlesOptions {
  autoLoad?: boolean;
  defaultTrackId?: string;
  onTrackChange?: (track: SubtitleTrack | null) => void;
  onCueChange?: (cues: SubtitleCue[]) => void;
  onError?: (error: string) => void;
}

export const useSubtitles = (options: UseSubtitlesOptions = {}): UseSubtitlesReturn => {
  const {
    autoLoad = true,
    defaultTrackId,
    onTrackChange,
    onCueChange,
    onError,
  } = options;

  const [tracks, setTracks] = useState<SubtitleTrack[]>([]);
  const [activeTrack, setActiveTrackState] = useState<SubtitleTrack | null>(null);
  const [currentCues, setCurrentCues] = useState<SubtitleCue[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentTimeRef = useRef<number>(0);

  // Initialize subtitle service event listeners
  useEffect(() => {
    const handleTrackAdded = (data: { track: SubtitleTrack }) => {
      setTracks(prev => {
        const existing = prev.find(t => t.id === data.track.id);
        if (existing) {
          return prev.map(t => t.id === data.track.id ? data.track : t);
        }
        return [...prev, data.track];
      });

      setIsLoading(false);
      setError(null);

      // Auto-activate first track or default track
      if (autoLoad && (data.track.default || data.track.id === defaultTrackId)) {
        setActiveTrackState(data.track);
      }
    };

    const handleTrackRemoved = (data: { trackId: string }) => {
      setTracks(prev => prev.filter(t => t.id !== data.trackId));
    };

    const handleTrackChanged = (data: { trackId: string | null }) => {
      const newActiveTrack = data.trackId ? subtitleService.getActiveTrack() : null;
      setActiveTrackState(newActiveTrack);
      onTrackChange?.(newActiveTrack);

      // Update current cues for new track
      if (newActiveTrack) {
        const cues = subtitleService.getCurrentCues(currentTimeRef.current);
        setCurrentCues(cues);
        onCueChange?.(cues);
      } else {
        setCurrentCues([]);
        onCueChange?.([]);
      }
    };

    const handleCuesChanged = (data: { cues: SubtitleCue[]; time: number }) => {
      setCurrentCues(data.cues);
      onCueChange?.(data.cues);
    };

    const handleTrackError = (data: { trackId: string; error: any }) => {
      const errorMessage = `Failed to load track ${data.trackId}: ${data.error.message || 'Unknown error'}`;
      setError(errorMessage);
      setIsLoading(false);
      onError?.(errorMessage);
    };

    // Subscribe to events
    subtitleService.on('trackAdded', handleTrackAdded);
    subtitleService.on('trackRemoved', handleTrackRemoved);
    subtitleService.on('trackChanged', handleTrackChanged);
    subtitleService.on('cuesChanged', handleCuesChanged);
    subtitleService.on('trackError', handleTrackError);

    return () => {
      // Cleanup event listeners
      subtitleService.off('trackAdded', handleTrackAdded);
      subtitleService.off('trackRemoved', handleTrackRemoved);
      subtitleService.off('trackChanged', handleTrackChanged);
      subtitleService.off('cuesChanged', handleCuesChanged);
      subtitleService.off('trackError', handleTrackError);
    };
  }, [autoLoad, defaultTrackId, onTrackChange, onCueChange, onError]);

  // Sync with subtitle service on mount
  useEffect(() => {
    const currentTracks = subtitleService.getTracks();
    const currentActiveTrack = subtitleService.getActiveTrack();

    setTracks(currentTracks);
    setActiveTrackState(currentActiveTrack);
  }, []);

  // Action handlers
  const addTrack = useCallback(async (track: SubtitleTrack): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      await subtitleService.addTrack(track);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add subtitle track';
      setError(errorMessage);
      setIsLoading(false);
      onError?.(errorMessage);
    }
  }, [onError]);

  const removeTrack = useCallback((trackId: string): void => {
    subtitleService.removeTrack(trackId);
  }, []);

  const setActiveTrack = useCallback((trackId: string | null): void => {
    subtitleService.setActiveTrack(trackId);
  }, []);

  const updateCurrentTime = useCallback((time: number): void => {
    currentTimeRef.current = time;
    const cues = subtitleService.getCurrentCues(time);
    // Note: cuesChanged event will be fired by subtitleService if cues actually changed
  }, []);

  const searchSubtitles = useCallback((query: string, trackId?: string): Array<{ cue: SubtitleCue; trackId: string }> => {
    return subtitleService.searchSubtitles(query, trackId);
  }, []);

  const exportSubtitles = useCallback((trackId: string, format: 'vtt' | 'srt'): string => {
    return subtitleService.exportSubtitles(trackId, format);
  }, []);

  const clearTracks = useCallback((): void => {
    subtitleService.clear();
    setTracks([]);
    setActiveTrackState(null);
    setCurrentCues([]);
    setError(null);
  }, []);

  const getStats = useCallback((trackId?: string) => {
    return subtitleService.getStats(trackId);
  }, []);

  return {
    // State
    tracks,
    activeTrack,
    currentCues,
    isLoading,
    error,

    // Actions
    addTrack,
    removeTrack,
    setActiveTrack,
    updateCurrentTime,
    searchSubtitles,
    exportSubtitles,
    clearTracks,

    // Utilities
    getStats,
  };
};