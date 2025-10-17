import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './MovieDetail.css';

interface Movie {
  id: string;
  title: string;
  description: string;
  price: number;
  cover_url?: string;
  genre?: string;
  release_year?: number;
  duration?: number;
  director?: string;
  cast?: string;
  rating?: number;
}

const MovieDetail: React.FC = () => {
  const { movieId } = useParams<{ movieId: string }>();
  const navigate = useNavigate();
  const [movie, setMovie] = useState<Movie | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Initialize Telegram WebApp
    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand();

      // Show back button
      tg.BackButton.show();
      tg.BackButton.onClick(() => navigate('/miniapp'));

      // Configure MainButton for purchase
      tg.MainButton.setText('🛒 Comprar Filme');
      tg.MainButton.show();
      tg.MainButton.onClick(handlePurchase);

      return () => {
        tg.BackButton.hide();
        tg.MainButton.hide();
        tg.BackButton.offClick(() => navigate('/miniapp'));
        tg.MainButton.offClick(handlePurchase);
      };
    }
  }, [navigate]);

  useEffect(() => {
    if (movieId) {
      fetchMovieDetails(movieId);
    }
  }, [movieId]);

  const fetchMovieDetails = async (id: string) => {
    try {
      setLoading(true);
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/movies/${id}`);

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

  const handlePurchase = async () => {
    if (!movie || !window.Telegram?.WebApp) return;

    const tg = window.Telegram.WebApp;
    const telegramUser = tg.initDataUnsafe?.user;

    if (!telegramUser) {
      alert('Erro: Não foi possível obter suas informações do Telegram');
      return;
    }

    try {
      // Send movie purchase request to backend
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/telegram/miniapp/purchase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          telegram_id: telegramUser.id,
          movie_id: movie.id,
          movie_title: movie.title,
          movie_price: movie.price,
          init_data: tg.initData,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to initiate purchase');
      }

      const result = await response.json();

      // Show success message
      tg.MainButton.setText('✅ Enviado para o bot!');
      setTimeout(() => {
        tg.close();
      }, 1500);
    } catch (err) {
      console.error('Error purchasing movie:', err);
      alert('Erro ao processar compra. Tente novamente.');
      tg.MainButton.setText('🛒 Comprar Filme');
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
          <button onClick={() => navigate('/miniapp')} className="back-button">
            Voltar ao catálogo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="movie-detail-container">
      <div className="movie-detail-cover">
        {movie.cover_url ? (
          <img src={movie.cover_url} alt={movie.title} />
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
          {movie.genre && (
            <span className="meta-tag">🎭 {movie.genre}</span>
          )}
          {movie.duration && (
            <span className="meta-tag">⏱️ {movie.duration} min</span>
          )}
          {movie.rating && (
            <span className="meta-tag">⭐ {movie.rating}/10</span>
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
          <div className="price-value">R$ {movie.price.toFixed(2)}</div>
        </div>
      </div>
    </div>
  );
};

export default MovieDetail;
