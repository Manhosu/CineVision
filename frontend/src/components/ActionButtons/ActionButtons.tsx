'use client';

import { useState, useEffect } from 'react';
import { Movie } from '@/types/movie';
import { ViewingOptionsModal } from '@/components/ViewingOptionsModal/ViewingOptionsModal';
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
  const [purchaseStatus, setPurchaseStatus] = useState<PurchaseStatus>({
    isOwned: false,
    isLoading: true
  });
  const [showViewingOptions, setShowViewingOptions] = useState(false);

  useEffect(() => {
    checkOwnershipStatus();
  }, [movie.id]);

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

  const handleWatch = async () => {
    const availability = movie.availability || 'BOTH';
    const hasTelegramLink = !!movie.telegram_group_link;

    // If only TELEGRAM is available, go directly to Telegram
    if (availability === 'TELEGRAM' && hasTelegramLink) {
      window.open(movie.telegram_group_link, '_blank');
      return;
    }

    // If only SITE is available (or TELEGRAM but no link), go directly to player
    if (availability === 'SITE' || (availability === 'TELEGRAM' && !hasTelegramLink)) {
      window.location.href = `/watch/${movie.id}`;
      return;
    }

    // If BOTH are available and has Telegram link, show modal
    if (hasTelegramLink) {
      setShowViewingOptions(true);
    } else {
      // BOTH but no Telegram link, go directly to site
      window.location.href = `/watch/${movie.id}`;
    }
  };

  const handleChooseSite = () => {
    // Fechar modal e redirecionar para o player do site
    setShowViewingOptions(false);
    window.location.href = `/watch/${movie.id}`;
  };

  const handleTelegramPurchase = () => {
    // Gerar deep link do Telegram direto
    // Formato: https://t.me/BOT_USERNAME?start=buy_CONTENT_ID
    const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'cinevisionv2bot';
    const deepLink = `https://t.me/${botUsername}?start=buy_${movie.id}`;

    toast.success('Abrindo Telegram...', {
      duration: 2000,
      icon: '📱'
    });

    // Abrir Telegram
    window.open(deepLink, '_blank');
  };

  if (purchaseStatus.isLoading) {
    return (
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 h-12 bg-gray-300/20 animate-pulse rounded-xl" />
      </div>
    );
  }

  return (
    <>
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
      </div>

      {/* Modal de escolha de visualização */}
      <ViewingOptionsModal
        isOpen={showViewingOptions}
        onClose={() => setShowViewingOptions(false)}
        movieTitle={movie.title}
        telegramGroupLink={movie.telegram_group_link || ''}
        onChooseSite={handleChooseSite}
        availability={(movie.availability as 'SITE' | 'TELEGRAM' | 'BOTH') || 'BOTH'}
      />
    </>
  );
}
