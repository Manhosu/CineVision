'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import './miniapp.css';

// Declare Telegram WebApp type
declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        ready: () => void;
        expand: () => void;
        close: () => void;
        MainButton: {
          setText: (text: string) => void;
          show: () => void;
          hide: () => void;
          onClick: (callback: () => void) => void;
          offClick: (callback: () => void) => void;
        };
        BackButton: {
          show: () => void;
          hide: () => void;
          onClick: (callback: () => void) => void;
          offClick: (callback: () => void) => void;
        };
        initData: string;
        initDataUnsafe: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
          };
        };
        themeParams: {
          bg_color?: string;
          text_color?: string;
          hint_color?: string;
          link_color?: string;
          button_color?: string;
          button_text_color?: string;
        };
      };
    };
  }
}

interface Movie {
  id: string;
  title: string;
  description: string;
  price_cents: number;
  poster_url?: string;
  thumbnail_url?: string;
  genres?: string[];
  release_year?: number;
}

export default function MiniAppPage() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Initialize Telegram WebApp
    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand();

      // Set theme colors
      if (tg.themeParams) {
        document.documentElement.style.setProperty('--tg-theme-bg-color', tg.themeParams.bg_color || '#ffffff');
        document.documentElement.style.setProperty('--tg-theme-text-color', tg.themeParams.text_color || '#000000');
        document.documentElement.style.setProperty('--tg-theme-hint-color', tg.themeParams.hint_color || '#999999');
        document.documentElement.style.setProperty('--tg-theme-link-color', tg.themeParams.link_color || '#2481cc');
        document.documentElement.style.setProperty('--tg-theme-button-color', tg.themeParams.button_color || '#2481cc');
        document.documentElement.style.setProperty('--tg-theme-button-text-color', tg.themeParams.button_text_color || '#ffffff');
      }
    }

    // Fetch movies from API
    fetchMovies();
  }, []);

  const fetchMovies = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/content/movies?limit=50`, {
        cache: 'no-store'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch movies');
      }

      const data = await response.json();
      setMovies(data.movies || data);
    } catch (err) {
      console.error('Error fetching movies:', err);
      setError(err instanceof Error ? err.message : 'Failed to load movies');
    } finally {
      setLoading(false);
    }
  };

  const handleMovieClick = (movieId: string) => {
    router.push(`/miniapp/movie/${movieId}`);
  };

  if (loading) {
    return (
      <div className="miniapp-container">
        <div className="miniapp-loading">
          <div className="spinner"></div>
          <p>Carregando catálogo...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="miniapp-container">
        <div className="miniapp-error">
          <p>❌ {error}</p>
          <button onClick={fetchMovies} className="retry-button">
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="miniapp-container">
      <div className="miniapp-header">
        <h1>🎬 Catálogo CineVision</h1>
        <p className="subtitle">Escolha seu filme favorito</p>
      </div>

      <div className="movies-grid">
        {movies.map((movie) => (
          <div
            key={movie.id}
            className="movie-card"
            onClick={() => handleMovieClick(movie.id)}
          >
            <div className="movie-cover">
              {movie.poster_url || movie.thumbnail_url ? (
                <img
                  src={movie.poster_url || movie.thumbnail_url}
                  alt={movie.title}
                  loading="lazy"
                />
              ) : (
                <div className="no-cover">
                  <span>🎬</span>
                </div>
              )}
            </div>

            <div className="movie-info">
              <h3 className="movie-title">{movie.title}</h3>
              {movie.release_year && (
                <span className="movie-year">{movie.release_year}</span>
              )}
              {movie.genres && movie.genres.length > 0 && (
                <span className="movie-genre">{movie.genres[0]}</span>
              )}
              <div className="movie-price">
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL'
                }).format(movie.price_cents / 100)}
              </div>
            </div>
          </div>
        ))}
      </div>

      {movies.length === 0 && !loading && (
        <div className="empty-state">
          <p>📽️ Nenhum filme disponível no momento</p>
        </div>
      )}
    </div>
  );
}
