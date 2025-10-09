'use client';

import { useState, useEffect } from 'react';
import { Movie } from '@/types/movie';
import { useAuth } from '@/hooks/useAuth';
import favoritesService from '@/services/favorites.service';
import toast from 'react-hot-toast';

interface ActionButtonsProps {
  movie: Movie;
}

interface PurchaseStatus {
  isOwned: boolean;
  isLoading: boolean;
  error?: string;
}

export default function ActionButtons({ movie }: ActionButtonsProps) {
  const { isAuthenticated } = useAuth();
  const [purchaseStatus, setPurchaseStatus] = useState<PurchaseStatus>({
    isOwned: false,
    isLoading: true
  });
  const [isAddingToFavorites, setIsAddingToFavorites] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    checkOwnershipStatus();
    if (isAuthenticated) {
      checkFavoriteStatus();
    }
  }, [movie.id, isAuthenticated]);

  const checkOwnershipStatus = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/purchases/check/${movie.id}`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setPurchaseStatus({
          isOwned: data.isOwned,
          isLoading: false
        });
      } else {
        setPurchaseStatus({
          isOwned: false,
          isLoading: false
        });
      }
    } catch (error) {
      console.error('Error checking ownership:', error);
      setPurchaseStatus({
        isOwned: false,
        isLoading: false,
        error: 'Erro ao verificar propriedade'
      });
    }
  };

  const checkFavoriteStatus = async () => {
    try {
      const { isFavorite: favStatus } = await favoritesService.checkFavorite(movie.id);
      setIsFavorite(favStatus);
    } catch (error) {
      console.error('Error checking favorite status:', error);
      setIsFavorite(false);
    }
  };

  const handleWatch = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/content/${movie.id}/stream`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        if (data.watch_url) {
          window.location.href = `/watch/${movie.id}`;
        } else {
          throw new Error('URL de reprodução não disponível');
        }
      } else {
        throw new Error('Erro ao acessar filme');
      }
    } catch (error) {
      console.error('Watch error:', error);
      toast.error('Erro ao acessar filme. Verifique sua compra.', {
        duration: 4000,
        icon: '❌'
      });
    }
  };

  const handleTelegramPurchase = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/purchases/initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          content_id: movie.id,
          preferred_delivery: 'telegram'
        })
      });

      const data = await response.json();

      if (response.ok && data.telegram_deep_link) {
        toast.success('Redirecionando para o Telegram...', {
          duration: 3000,
          icon: '📱'
        });

        window.open(data.telegram_deep_link, '_blank');
      } else {
        throw new Error(data.message || 'Erro ao iniciar compra via Telegram');
      }
    } catch (error) {
      console.error('Telegram purchase error:', error);
      toast.error('Erro ao processar compra via Telegram. Tente novamente.', {
        duration: 4000,
        icon: '❌'
      });
    }
  };

  const handleToggleFavorite = async () => {
    if (!isAuthenticated) {
      toast.error('Faça login para adicionar favoritos', {
        duration: 3000,
        icon: '🔒'
      });
      return;
    }

    setIsAddingToFavorites(true);

    try {
      if (isFavorite) {
        await favoritesService.removeFavorite(movie.id);
        setIsFavorite(false);
        toast.success('Removido dos favoritos', {
          duration: 2000,
          icon: '💔'
        });
      } else {
        await favoritesService.addFavorite(movie.id);
        setIsFavorite(true);
        toast.success('Adicionado aos favoritos', {
          duration: 2000,
          icon: '❤️'
        });
      }
    } catch (error) {
      console.error('Favorite toggle error:', error);
      toast.error('Erro ao atualizar favoritos', {
        duration: 3000,
        icon: '❌'
      });
    } finally {
      setIsAddingToFavorites(false);
    }
  };

  if (purchaseStatus.isLoading) {
    return (
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 h-12 bg-gray-300/20 animate-pulse rounded-xl" />
        <div className="flex gap-3">
          <div className="w-12 h-12 bg-gray-300/20 animate-pulse rounded-xl" />
          <div className="w-12 h-12 bg-gray-300/20 animate-pulse rounded-xl" />
          <div className="w-12 h-12 bg-gray-300/20 animate-pulse rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row gap-4 tv:gap-6">
      {/* Main Action Button - Watch or Purchase */}
      <div className="flex-1">
        {purchaseStatus.isOwned ? (
          <button
            onClick={handleWatch}
            disabled={purchaseStatus.isLoading}
            className="w-full flex items-center justify-center gap-3 tv:gap-4 px-6 py-3 tv:px-8 tv:py-4 bg-primary-600 hover:bg-primary-700 focus:bg-primary-700 disabled:bg-primary-600/50 text-white font-semibold text-lg tv:text-xl rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 tv:focus:ring-4 transition-all duration-200 disabled:cursor-not-allowed"
          >
            {purchaseStatus.isLoading ? (
              <div className="w-5 h-5 tv:w-6 tv:h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5 tv:w-6 tv:h-6 fill-current" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
            )}
            <span>Assistir Agora</span>
          </button>
        ) : (
          <button
            onClick={handleTelegramPurchase}
            className="w-full flex items-center justify-center gap-3 tv:gap-4 px-6 py-3 tv:px-8 tv:py-4 bg-blue-600 hover:bg-blue-700 focus:bg-blue-700 text-white font-semibold text-lg tv:text-xl rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 tv:focus:ring-4 transition-all duration-200"
          >
            <svg className="w-5 h-5 tv:w-6 tv:h-6 fill-current" viewBox="0 0 24 24">
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
            </svg>
            <span>Comprar via Telegram</span>
          </button>
        )}
      </div>

      {/* Favorite Button */}
      <button
        onClick={handleToggleFavorite}
        disabled={isAddingToFavorites}
        className={`flex items-center justify-center gap-2 tv:gap-3 px-6 py-3 tv:px-8 tv:py-4 border rounded-lg focus:outline-none focus:ring-2 tv:focus:ring-4 transition-all duration-200 disabled:cursor-not-allowed min-w-[160px] tv:min-w-[200px] ${
          isFavorite
            ? 'bg-red-600/20 border-red-600/30 text-red-400 hover:bg-red-600/30 focus:bg-red-600/30 focus:ring-red-500'
            : 'bg-white/5 border-white/20 text-gray-300 hover:bg-white/10 focus:bg-white/10 focus:ring-white/50'
        }`}
      >
        {isAddingToFavorites ? (
          <div className="w-5 h-5 tv:w-6 tv:h-6 border-2 border-current/30 border-t-current rounded-full animate-spin" />
        ) : (
          <svg
            className={`w-5 h-5 tv:w-6 tv:h-6 transition-all duration-200 ${
              isFavorite ? 'fill-current' : 'stroke-current fill-none'
            }`}
            viewBox="0 0 24 24"
            strokeWidth={2}
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
        )}
        <span className="font-medium text-base tv:text-lg">
          {isFavorite ? 'Favoritado' : 'Favoritar'}
        </span>
      </button>
    </div>
  );
}