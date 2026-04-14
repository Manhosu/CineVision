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

    if (!movie.telegram_group_link) {
      toast.error('Conteudo indisponivel no momento', {
        duration: 3000,
      });
      return;
    }

    // Open Telegram group link directly
    window.open(movie.telegram_group_link, '_blank');
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
      {/* Clean Card - Poster + Info Below */}
      <div className="relative w-full transition-all duration-300 ease-out hover:scale-[1.02]">

        {/* Poster - Clean, no text overlay */}
        <div className="relative w-full rounded-xl overflow-hidden" style={{ aspectRatio: '2/3', minHeight: '280px' }}>
          <LazyImage
            src={movie.poster_url || movie.thumbnail_url || '/images/placeholder-poster.svg'}
            alt={movie.title}
            fill
            priority={priority}
            className="object-cover transition-all duration-500 ease-out group-hover:scale-105 group-hover:brightness-110"
            placeholder={movie.title}
            fallbackSrc="/images/placeholder-poster.svg"
            sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 200px"
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
          />

          {/* Top Left - Discount Badge (only badge on poster) */}
          {movie.discount_percentage && movie.discount_percentage > 0 && (
            <div className="absolute top-2 left-2 z-20">
              <div className="flex items-center gap-1 px-2 py-1 bg-red-600 rounded-md shadow-lg text-white text-[10px] font-bold">
                {movie.is_flash_promo && <span>&#9889;</span>}
                <span>-{movie.discount_percentage}%</span>
              </div>
            </div>
          )}

          {/* Top Right - Purchased check */}
          {isPurchased && (
            <div className="absolute top-2 right-2 z-20">
              <div className="flex items-center gap-1 px-1.5 py-1 bg-emerald-500 rounded-md shadow-lg">
                <CheckIcon className="w-3 h-3 text-white" />
              </div>
            </div>
          )}

          {/* Bottom Left - Year (small, subtle) */}
          {movie.release_year && (
            <div className="absolute bottom-2 left-2 z-20">
              <span className="text-[10px] text-white/70 bg-black/50 backdrop-blur-sm px-1.5 py-0.5 rounded">
                {movie.release_year}
              </span>
            </div>
          )}

          {/* Quality badge on poster */}
          {movie.quality_label && (
            <div className="absolute bottom-2 right-2 z-20">
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                movie.quality_label === 'EXCLUSIVA' ? 'bg-red-600/80 text-white' :
                movie.quality_label === 'CINEMA' ? 'bg-purple-600/80 text-white' :
                movie.quality_label === 'FULL HD' ? 'bg-blue-600/80 text-white' :
                'bg-yellow-600/80 text-white'
              }`}>
                {movie.quality_label}
              </span>
            </div>
          )}
        </div>

        {/* Info Below Poster - Title + Price */}
        <div className="pt-2 px-0.5">
          <h3 className="text-white font-semibold text-xs line-clamp-1 leading-tight mb-1">
            {movie.title}
          </h3>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
              {(movie as any).content_type === 'series' && (
                <span className="px-1 py-0.5 bg-blue-500/30 text-blue-400 rounded font-medium">Serie</span>
              )}
            </div>

            {/* Price */}
            {isPurchased ? (
              <span className="text-[10px] text-emerald-400 font-semibold">Adquirido</span>
            ) : movie.discounted_price_cents && movie.discounted_price_cents < movie.price_cents ? (
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-gray-500 line-through">{formatPrice(movie.price_cents)}</span>
                <span className="text-xs text-green-400 font-bold">{formatPrice(movie.discounted_price_cents)}</span>
              </div>
            ) : (
              <span className="text-xs text-white/80 font-semibold">{formatPrice(movie.price_cents)}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

export { MovieCard };