'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import './movie-detail.css';

interface Movie {
  id: string;
  title: string;
  description: string;
  price_cents: number;
  poster_url?: string;
  thumbnail_url?: string;
  genres?: string[];
  release_year?: number;
  duration_minutes?: number;
  director?: string;
  cast?: string;
  imdb_rating?: number;
}

export default function MovieDetailPage() {
  const params = useParams();
  const router = useRouter();
  const movieId = params?.id as string;
  const [movie, setMovie] = useState<Movie | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handlePurchase = useCallback(async () => {
    console.log('handlePurchase called');

    if (!movie) {
      console.error('No movie data');
      alert('Erro: Dados do filme não encontrados');
      return;
    }

    if (!window.Telegram?.WebApp) {
      console.error('Telegram WebApp not available');
      alert('Erro: Telegram WebApp não disponível');
      return;
    }

    const tg = window.Telegram.WebApp;
    const telegramUser = tg.initDataUnsafe?.user;

    console.log('Telegram user:', telegramUser);

    if (!telegramUser) {
      alert('Erro: Não foi possível obter suas informações do Telegram');
      return;
    }

    try {
      console.log('=== PURCHASE DEBUG START ===');
      console.log('NEXT_PUBLIC_API_URL from env:', process.env.NEXT_PUBLIC_API_URL);

      // TEMPORARY: Hardcode URL completely to debug
      const fullUrl = 'https://cinevisionn.onrender.com/api/v1/telegrams/miniapp/purchase';

      const requestData = {
        telegram_id: telegramUser.id,
        movie_id: movie.id,
        movie_title: movie.title,
        movie_price: movie.price_cents || 0,
        init_data: tg.initData,
      };

      console.log('Request data:', requestData);
      console.log('Full URL being called:', fullUrl);

      // Send movie purchase request to backend
      const response = await fetch(fullUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      console.log('Response status:', response.status);
      console.log('=== PURCHASE DEBUG END ===');

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Response error:', errorText);
        throw new Error(`Failed to initiate purchase: ${response.status}`);
      }

      const result = await response.json();
      console.log('Purchase result:', result);

      // Show success message
      tg.MainButton.setText('✅ Enviado para o bot!');
      setTimeout(() => {
        tg.close();
      }, 1500);
    } catch (err) {
      console.error('Error purchasing movie:', err);
      alert(`Erro ao processar compra: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
      tg.MainButton.setText('🛒 Comprar Filme');
    }
  }, [movie]);

  useEffect(() => {
    // Initialize Telegram WebApp
    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand();

      // Show back button
      tg.BackButton.show();
      tg.BackButton.onClick(() => router.push('/miniapp'));

      // Configure MainButton for purchase
      tg.MainButton.setText('🛒 Comprar Filme');
      tg.MainButton.show();
      tg.MainButton.onClick(handlePurchase);

      return () => {
        tg.BackButton.hide();
        tg.MainButton.hide();
        tg.BackButton.offClick(() => router.push('/miniapp'));
        tg.MainButton.offClick(handlePurchase);
      };
    }
  }, [router, handlePurchase]);

  useEffect(() => {
    if (movieId) {
      fetchMovieDetails(movieId);
    }
  }, [movieId]);

  const fetchMovieDetails = async (id: string) => {
    try {
      setLoading(true);
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/content/movies/${id}`, {
        cache: 'no-store'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch movie details');
      }

      const data = await response.json();
      setMovie(data);
    } catch (err) {
      console.error('Error fetching movie:', err);
      setError(err instanceof Error ? err.message : 'Failed to load movie');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="movie-detail-container">
        <div className="movie-detail-loading">
          <div className="spinner"></div>
          <p>Carregando detalhes...</p>
        </div>
      </div>
    );
  }

  if (error || !movie) {
    return (
      <div className="movie-detail-container">
        <div className="movie-detail-error">
          <p>❌ {error || 'Filme não encontrado'}</p>
          <button onClick={() => router.push('/miniapp')} className="back-button">
            Voltar ao catálogo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="movie-detail-container">
      <div className="movie-detail-cover">
        {movie.poster_url || movie.thumbnail_url ? (
          <img src={movie.poster_url || movie.thumbnail_url} alt={movie.title} />
        ) : (
          <div className="no-cover">
            <span>🎬</span>
          </div>
        )}
      </div>

      <div className="movie-detail-content">
        <h1 className="movie-detail-title">{movie.title}</h1>

        <div className="movie-detail-meta">
          {movie.release_year && (
            <span className="meta-tag">📅 {movie.release_year}</span>
          )}
          {movie.genres && movie.genres.length > 0 && (
            <span className="meta-tag">🎭 {movie.genres[0]}</span>
          )}
          {movie.duration_minutes && (
            <span className="meta-tag">⏱️ {movie.duration_minutes} min</span>
          )}
          {movie.imdb_rating && (
            <span className="meta-tag">⭐ {movie.imdb_rating.toFixed(1)}/10</span>
          )}
        </div>

        {movie.director && (
          <div className="movie-detail-section">
            <h3>Diretor</h3>
            <p>{movie.director}</p>
          </div>
        )}

        {movie.cast && (
          <div className="movie-detail-section">
            <h3>Elenco</h3>
            <p>{movie.cast}</p>
          </div>
        )}

        <div className="movie-detail-section">
          <h3>Sinopse</h3>
          <p className="movie-description">{movie.description}</p>
        </div>

        <div className="movie-detail-price">
          <div className="price-label">Preço</div>
          <div className="price-value">
            {new Intl.NumberFormat('pt-BR', {
              style: 'currency',
              currency: 'BRL'
            }).format(movie.price_cents / 100)}
          </div>
        </div>
      </div>
    </div>
  );
}
