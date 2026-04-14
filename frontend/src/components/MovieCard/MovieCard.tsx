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

        {/* Poster - 100% clean, no overlays */}
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
        </div>

        {/* Minimal info below */}
        <div className="pt-1.5 px-0.5 flex items-center justify-between">
          <span className="text-[10px] text-gray-500">{movie.release_year || ''}</span>
          {isPurchased ? (
            <span className="text-[10px] text-emerald-400 font-semibold">Adquirido</span>
          ) : movie.discounted_price_cents && movie.discounted_price_cents < movie.price_cents ? (
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-gray-500 line-through">{formatPrice(movie.price_cents)}</span>
              <span className="text-[11px] text-green-400 font-bold">{formatPrice(movie.discounted_price_cents)}</span>
            </div>
          ) : (
            <span className="text-[11px] text-white/60 font-medium">{formatPrice(movie.price_cents)}</span>
          )}
        </div>
      </div>
    </div>
  );
});

export { MovieCard };