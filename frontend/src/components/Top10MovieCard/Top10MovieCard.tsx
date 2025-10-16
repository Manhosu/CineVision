'use client';

import { useState, memo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import LazyImage from '@/components/ui/LazyImage';
import {
  PlayIcon,
  StarIcon,
  ClockIcon,
  HeartIcon,
  PlusIcon,
  CheckIcon,
  ShoppingCartIcon
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolidIcon, CheckIcon as CheckSolidIcon } from '@heroicons/react/24/solid';
import { toast } from 'react-hot-toast';
import { Movie } from '@/types/movie';
import { LanguageSelector } from '@/components/LanguageSelector/LanguageSelector';

interface Top10MovieCardProps {
  movie: Movie;
  ranking: number; // Position 1-10
  priority?: boolean;
  onClick?: (movie: Movie) => void;
  isPurchased?: boolean;
}

const Top10MovieCard = memo(function Top10MovieCard({
  movie,
  ranking,
  priority = false,
  onClick,
  isPurchased = false
}: Top10MovieCardProps) {
  const router = useRouter();
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [isInWatchlist, setIsInWatchlist] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);

  const formatPrice = (priceInCents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(priceInCents / 100);
  };

  const formatDuration = (minutes?: number) => {
    if (!minutes) return '';
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  const handleWatch = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/content-language-upload/public/languages/${movie.id}`
      );

      if (response.ok) {
        const languages = await response.json();

        if (languages.length === 0) {
          router.push(`/watch/${movie.id}`);
        } else if (languages.length === 1) {
          router.push(`/watch/${movie.id}?lang=${languages[0].id}`);
        } else {
          setShowLanguageSelector(true);
        }
      } else {
        router.push(`/watch/${movie.id}`);
      }
    } catch (error) {
      console.error('Error fetching languages:', error);
      router.push(`/watch/${movie.id}`);
    }
  };

  const handlePurchase = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (isPurchasing) return;

    setIsPurchasing(true);

    try {
      const response = await fetch('/api/purchases/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content_id: movie.id,
          preferred_delivery: 'site'
        })
      });

      if (!response.ok) {
        throw new Error('Erro ao iniciar compra');
      }

      const data = await response.json();

      if (data.telegram_deep_link) {
        window.open(data.telegram_deep_link, '_blank');
        toast.success('Complete a compra no Telegram para assistir!');
      }
    } catch (error) {
      console.error('Erro ao iniciar compra:', error);
      toast.error('Erro ao processar compra. Tente novamente.');
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsFavorited(!isFavorited);
    toast.success(
      isFavorited ? 'Removido dos favoritos' : 'Adicionado aos favoritos'
    );
  };

  const handleWatchlist = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsInWatchlist(!isInWatchlist);
    toast.success(
      isInWatchlist ? 'Removido da sua lista' : 'Adicionado à sua lista'
    );
  };

  const handleCardClick = () => {
    if (onClick) {
      onClick(movie);
    }
  };

  const availabilityBadge = () => {
    switch (movie.availability) {
      case 'TELEGRAM':
        return (
          <div className="absolute top-2 right-2 bg-blue-600 text-white text-xs px-2 py-1 rounded-full font-medium z-10">
            📱 Telegram
          </div>
        );
      case 'SITE':
        return (
          <div className="absolute top-2 right-2 bg-green-600 text-white text-xs px-2 py-1 rounded-full font-medium z-10">
            🌐 Site
          </div>
        );
      case 'BOTH':
        return (
          <div className="absolute top-2 right-2 bg-primary-600 text-white text-xs px-2 py-1 rounded-full font-medium z-10">
            ✨ Ambos
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div
      className="group relative cursor-pointer flex items-end gap-0"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleCardClick}
    >
      {/* Netflix-style Large Number - Next to the card */}
      <div className="relative flex-shrink-0 pointer-events-none self-end" style={{ width: '70px', marginRight: '-20px', zIndex: 1 }}>
        <div
          className="text-[9rem] sm:text-[11rem] md:text-[13rem] font-black leading-none select-none"
          style={{
            WebkitTextStroke: '4px rgba(255, 255, 255, 1)',
            textStroke: '4px rgba(255, 255, 255, 1)',
            color: 'rgba(15, 15, 15, 0.5)',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            userSelect: 'none',
            filter: 'drop-shadow(0 8px 16px rgba(0, 0, 0, 1))',
            textShadow: '0 0 40px rgba(0, 0, 0, 1)'
          }}
        >
          {ranking}
        </div>
      </div>

      {/* Main Card */}
      <div className="relative flex-1 card-hover rounded-xl overflow-hidden bg-dark-900/50 backdrop-blur-sm border border-white/10 transition-all duration-300 hover:border-white/20 hover:shadow-2xl" style={{ zIndex: 2 }}>

        {/* Movie Poster */}
        <div className="relative aspect-[2/3] min-h-[240px] overflow-hidden">
          <LazyImage
            src={movie.poster_url || movie.thumbnail_url || '/images/placeholder-poster.svg'}
            alt={`#${ranking} - ${movie.title}`}
            fill
            priority={priority}
            className="object-cover transition-all duration-300 group-hover:scale-105"
            placeholder={movie.title}
            fallbackSrc="/images/placeholder-poster.svg"
            sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
          />

          {/* Availability badge */}
          {availabilityBadge()}

          {/* Rating badge */}
          {movie.imdb_rating && (
            <div className="absolute top-2 left-2 flex items-center space-x-1 bg-black/70 text-white text-xs px-2 py-1 rounded-full backdrop-blur-sm z-10">
              <StarIcon className="w-3 h-3 text-yellow-500" />
              <span className="font-medium">{movie.imdb_rating.toFixed(1)}</span>
            </div>
          )}

          {/* Hover overlay */}
          <div className={`absolute inset-0 bg-black/60 transition-opacity duration-300 z-20 ${
            isHovered ? 'opacity-100' : 'opacity-0'
          }`}>

            {/* Play/Purchase button */}
            <div className="absolute inset-0 flex items-center justify-center">
              <button
                onClick={isPurchased ? handleWatch : handlePurchase}
                disabled={isPurchasing}
                className={`btn-primary text-sm sm:text-base px-4 py-2 sm:px-6 sm:py-3 transform transition-all duration-300 ${
                  isHovered ? 'scale-100 opacity-100' : 'scale-75 opacity-0'
                } ${isPurchasing ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isPurchasing ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Comprando...</span>
                  </div>
                ) : isPurchased ? (
                  <>
                    <PlayIcon className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                    Assistir
                  </>
                ) : (
                  <>
                    <ShoppingCartIcon className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                    Comprar
                  </>
                )}
              </button>
            </div>

            {/* Action buttons */}
            <div className={`absolute top-2 left-2 right-2 flex justify-between transition-all duration-300 ${
              isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
            }`}>
              <button
                onClick={handleFavorite}
                className="btn-icon bg-black/50 text-white hover:bg-black/70 hover:scale-110 w-8 h-8 sm:w-10 sm:h-10"
                title={isFavorited ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
              >
                {isFavorited ? (
                  <HeartSolidIcon className="w-4 h-4 sm:w-5 sm:h-5 text-red-500" />
                ) : (
                  <HeartIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                )}
              </button>

              <button
                onClick={handleWatchlist}
                className="btn-icon bg-black/50 text-white hover:bg-black/70 hover:scale-110 w-8 h-8 sm:w-10 sm:h-10"
                title={isInWatchlist ? 'Remover da lista' : 'Adicionar à lista'}
              >
                {isInWatchlist ? (
                  <CheckSolidIcon className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />
                ) : (
                  <PlusIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Movie Info */}
        <div className="relative p-3 sm:p-4 space-y-2 sm:space-y-3 z-10 bg-gradient-to-t from-dark-900 to-transparent">

          {/* Title */}
          <h3 className="font-semibold text-white text-sm sm:text-base line-clamp-2 group-hover:text-primary-400 transition-colors">
            {movie.title}
          </h3>

          {/* Price or Purchased Badge */}
          {isPurchased ? (
            <div className="flex items-center space-x-2">
              <CheckIcon className="w-4 h-4 text-green-500" />
              <span className="text-green-500 font-medium text-sm">Adquirido</span>
            </div>
          ) : (
            <div className="text-primary-500 font-extrabold text-xl sm:text-2xl">
              {formatPrice(movie.price_cents)}
            </div>
          )}

          {/* Quick Actions */}
          <div className="flex items-center justify-between pt-2">
            <Link
              href={`/movies/${movie.id}`}
              className="text-xs sm:text-sm text-gray-400 hover:text-white transition-colors focus-outline"
              onClick={(e) => e.stopPropagation()}
            >
              Ver detalhes
            </Link>

            <div className="flex items-center space-x-2">
              {movie.imdb_rating && (
                <div className="flex items-center space-x-1 text-xs text-gray-400">
                  <StarIcon className="w-3 h-3 text-yellow-500" />
                  <span>{movie.imdb_rating.toFixed(1)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced hover effect */}
      <div className={`absolute inset-0 -z-10 bg-primary-600/20 rounded-xl blur-xl transition-opacity duration-300 ${
        isHovered ? 'opacity-100' : 'opacity-0'
      }`} />

      {/* Language Selector Modal */}
      {isPurchased && (
        <LanguageSelector
          isOpen={showLanguageSelector}
          onClose={() => setShowLanguageSelector(false)}
          contentId={movie.id}
          movieTitle={movie.title}
        />
      )}
    </div>
  );
});

export { Top10MovieCard };
