'use client';

import { useState, memo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import LazyImage from '@/components/ui/LazyImage';
import {
  PlayIcon,
  HeartIcon,
  PlusIcon,
  CheckIcon,
  ShoppingCartIcon
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolidIcon, CheckIcon as CheckSolidIcon } from '@heroicons/react/24/solid';
import { toast } from 'react-hot-toast';
import { Movie } from '@/types/movie';
import { LanguageSelector } from '@/components/LanguageSelector/LanguageSelector';
import { ViewingOptionsModal } from '@/components/ViewingOptionsModal/ViewingOptionsModal';

interface MovieCardProps {
  movie: Movie;
  priority?: boolean;
  lazyLoad?: boolean;
  onClick?: (movie: Movie) => void;
  isPurchased?: boolean;
}

const MovieCard = memo(function MovieCard({
  movie,
  priority = false,
  lazyLoad = true,
  onClick,
  isPurchased = false
}: MovieCardProps) {
  const router = useRouter();
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false); // TODO: Integrar com estado global
  const [isInWatchlist, setIsInWatchlist] = useState(false); // TODO: Integrar com estado global
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);
  const [showViewingOptions, setShowViewingOptions] = useState(false);

  // Debug log
  if (isPurchased) {
    console.log(`🎬 Card ${movie.title} (${movie.id}): isPurchased = true`);
  }

  const formatPrice = (priceInCents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(priceInCents / 100);
  };

  const handleWatch = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    const availability = movie.availability || 'BOTH';
    const telegramGroupLink = movie.telegram_group_link;
    const hasTelegramLink = !!telegramGroupLink;

    // If only TELEGRAM is available, go directly to Telegram
    if (availability === 'TELEGRAM' && hasTelegramLink) {
      window.open(telegramGroupLink, '_blank');
      return;
    }

    // If only SITE is available (or TELEGRAM but no link), go directly to player
    if (availability === 'SITE' || (availability === 'TELEGRAM' && !hasTelegramLink)) {
      proceedToWatch();
      return;
    }

    // If BOTH are available and has Telegram link, show modal
    if (hasTelegramLink) {
      setShowViewingOptions(true);
    } else {
      // BOTH but no Telegram link, go directly to site
      proceedToWatch();
    }
  };

  const proceedToWatch = async () => {
    // Buscar idiomas disponíveis
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/content-language-upload/public/languages/${movie.id}`
      );

      if (response.ok) {
        const languages = await response.json();

        if (languages.length === 0) {
          // Sem idiomas cadastrados, tentar ir direto para o player
          router.push(`/watch/${movie.id}`);
        } else if (languages.length === 1) {
          // Apenas um idioma, ir direto para o player com esse idioma
          router.push(`/watch/${movie.id}?lang=${languages[0].id}`);
        } else {
          // Múltiplos idiomas, abrir seletor
          setShowLanguageSelector(true);
        }
      } else {
        // Erro ao buscar idiomas, tentar ir direto
        router.push(`/watch/${movie.id}`);
      }
    } catch (error) {
      console.error('Error fetching languages:', error);
      router.push(`/watch/${movie.id}`);
    }
  };

  const handlePurchase = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    // Redirecionar para página de detalhes (filme ou série)
    const contentType = (movie as any).content_type || 'movie';
    console.log('[MovieCard] handlePurchase - movie:', movie);
    console.log('[MovieCard] handlePurchase - content_type:', contentType);
    if (contentType === 'series') {
      router.push(`/series/${movie.id}`);
    } else {
      router.push(`/movies/${movie.id}`);
    }
  };

  const handleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    // TODO: Integrar com API para favoritar/desfavoritar
    setIsFavorited(!isFavorited);
    toast.success(
      isFavorited ? 'Removido dos favoritos' : 'Adicionado aos favoritos'
    );
  };

  const handleWatchlist = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    // TODO: Integrar com API para adicionar/remover da watchlist
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

  return (
    <div
      className="group relative cursor-pointer w-full"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleCardClick}
    >
      {/* Premium Minimalist Card */}
      <div className="relative w-full rounded-xl overflow-hidden bg-gradient-to-b from-zinc-900/50 to-zinc-950/80 backdrop-blur-sm transition-all duration-500 ease-out hover:scale-[1.02] hover:shadow-[0_8px_30px_rgba(0,0,0,0.6)]">

        {/* Poster Container - Clean & Full */}
        <div className="relative w-full overflow-hidden" style={{ aspectRatio: '2/3', minHeight: '300px' }}>
          <LazyImage
            src={movie.poster_url || movie.thumbnail_url || '/images/placeholder-poster.svg'}
            alt={movie.title}
            fill
            priority={priority}
            className="object-cover transition-all duration-500 ease-out group-hover:scale-105"
            placeholder={movie.title}
            fallbackSrc="/images/placeholder-poster.svg"
            sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 200px"
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
          />

          {/* Subtle Top Gradient for Badges */}
          <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-black/60 to-transparent pointer-events-none z-10" />

          {/* Top Right Badges - Minimalist */}
          <div className="absolute top-2 right-2 flex flex-col gap-1.5 z-20">
            {isPurchased && (
              <div className="flex items-center gap-1 px-2 py-1 bg-emerald-500 rounded-md shadow-lg">
                <CheckIcon className="w-3.5 h-3.5 text-white" />
              </div>
            )}
            {movie.age_rating && (
              <div className="px-2 py-0.5 bg-black/80 backdrop-blur-md border border-white/20 text-white text-xs font-bold rounded">
                {movie.age_rating}
              </div>
            )}
          </div>

          {/* Bottom Info - Always Visible */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/95 to-transparent p-3 z-30">
            {/* Title */}
            <h3 className="text-white font-bold text-sm mb-1.5 line-clamp-2 leading-tight">
              {movie.title}
            </h3>

            {/* Meta Info */}
            <div className="flex items-center gap-2 mb-2 text-xs text-gray-300">
              {movie.release_year && (
                <span>{movie.release_year}</span>
              )}
              {(movie as any).content_type === 'series' && (
                <span className="px-1.5 py-0.5 bg-blue-500/80 rounded text-white font-medium text-[10px]">Série</span>
              )}
            </div>

            {/* Action Button */}
            <button
              onClick={isPurchased ? handleWatch : handlePurchase}
              className="w-full flex items-center justify-center gap-2 bg-white text-black font-bold py-2 px-3 rounded-lg hover:bg-gray-200 transition-colors"
            >
              {isPurchased ? (
                <>
                  <PlayIcon className="w-4 h-4" />
                  <span className="text-xs">Assistir</span>
                </>
              ) : (
                <>
                  <ShoppingCartIcon className="w-4 h-4" />
                  <span className="text-xs">{formatPrice(movie.price_cents)}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Bottom Glow Effect */}
        <div className={`absolute -bottom-1 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary-500 to-transparent transition-opacity duration-500 ${
          isHovered ? 'opacity-100' : 'opacity-0'
        }`} />
      </div>

      {/* Language Selector Modal */}
      {isPurchased && (
        <LanguageSelector
          isOpen={showLanguageSelector}
          onClose={() => setShowLanguageSelector(false)}
          contentId={movie.id}
          movieTitle={movie.title}
        />
      )}

      {/* Viewing Options Modal (Site or Telegram) */}
      {isPurchased && (
        <ViewingOptionsModal
          isOpen={showViewingOptions}
          onClose={() => setShowViewingOptions(false)}
          movieTitle={movie.title}
          telegramGroupLink={movie.telegram_group_link || ''}
          onChooseSite={() => {
            setShowViewingOptions(false);
            proceedToWatch();
          }}
          availability={(movie.availability as 'SITE' | 'TELEGRAM' | 'BOTH') || 'BOTH'}
        />
      )}
    </div>
  );
});

export { MovieCard };