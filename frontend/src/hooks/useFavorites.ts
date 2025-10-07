'use client';

import { useState, useEffect, useCallback } from 'react';
import favoritesService, { Favorite } from '@/services/favorites.service';

export interface UseFavoritesReturn {
  favorites: Favorite[];
  isLoading: boolean;
  error: string | null;
  isFavorite: (contentId: string) => boolean;
  addFavorite: (contentId: string) => Promise<void>;
  removeFavorite: (contentId: string) => Promise<void>;
  toggleFavorite: (contentId: string) => Promise<void>;
  refetch: () => Promise<void>;
}

export function useFavorites(isAuthenticated: boolean = false): UseFavoritesReturn {
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFavorites = useCallback(async () => {
    if (!isAuthenticated) {
      setFavorites([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const data = await favoritesService.getUserFavorites();
      setFavorites(data);
    } catch (err) {
      console.error('Error fetching favorites:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch favorites');
      setFavorites([]);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  const isFavorite = useCallback(
    (contentId: string): boolean => {
      return favorites.some(fav => fav.content_id === contentId);
    },
    [favorites]
  );

  const addFavorite = useCallback(
    async (contentId: string) => {
      try {
        const newFavorite = await favoritesService.addFavorite(contentId);
        setFavorites(prev => [...prev, newFavorite]);
      } catch (err) {
        console.error('Error adding favorite:', err);
        throw err;
      }
    },
    []
  );

  const removeFavorite = useCallback(
    async (contentId: string) => {
      try {
        await favoritesService.removeFavorite(contentId);
        setFavorites(prev => prev.filter(fav => fav.content_id !== contentId));
      } catch (err) {
        console.error('Error removing favorite:', err);
        throw err;
      }
    },
    []
  );

  const toggleFavorite = useCallback(
    async (contentId: string) => {
      if (isFavorite(contentId)) {
        await removeFavorite(contentId);
      } else {
        await addFavorite(contentId);
      }
    },
    [isFavorite, addFavorite, removeFavorite]
  );

  return {
    favorites,
    isLoading,
    error,
    isFavorite,
    addFavorite,
    removeFavorite,
    toggleFavorite,
    refetch: fetchFavorites,
  };
}
