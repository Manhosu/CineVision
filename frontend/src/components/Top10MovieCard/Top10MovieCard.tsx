'use client';

import { useState, memo } from 'react';
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
  const [isHovered, setIsHovered] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [isInWatchlist, setIsInWatchlist] = useState(false);

  // Debug log
  if (isPurchased) {
    console.log(`🏆 Top10 Card #${ranking}: ${movie.title} (${movie.id}): isPurchased = true`);
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
    const contentType = (movie as any).content_type || 'movie';
    if (contentType === 'series') {
      router.push(`/series/${movie.id}`);
    } else {
      router.push(`/movies/${movie.id}`);
    }
  };

  const handleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsFavorited(!isFavorited);
    toast.success(isFavorited ? 'Removido dos favoritos' : 'Adicionado aos favoritos');
  };

  const handleWatchlist = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsInWatchlist(!isInWatchlist);
    toast.success(isInWatchlist ? 'Removido da sua lista' : 'Adicionado à sua lista');
  };

  const handleCardClick = () => {
    if (onClick) {
      onClick(movie);
    }
  };

  return (
    <div
      className="group relative cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleCardClick}
    >
      {/* HBO Max / Netflix Style - Number on LEFT side */}
      <div className="flex items-end gap-0 relative w-full">

        {/* GIGANTIC Ranking Number - LEFT SIDE */}
        <div
          className="relative flex items-end justify-center select-none pointer-events-none z-10 flex-shrink-0"
          style={{
            width: 'clamp(40px, 7vw, 100px)',
            marginRight: '-15px'
          }}
        >
          <div
            className="font-black leading-none transition-all duration-500"
            style={{
              fontSize: 'clamp(60px, 12vw, 180px)',
              fontFamily: 'Impact, system-ui, -apple-system, sans-serif',
              background: 'linear-gradient(180deg, #ffffff 0%, #888888 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              textStroke: '3px rgba(255, 255, 255, 0.3)',
              WebkitTextStroke: '3px rgba(255, 255, 255, 0.3)',
              filter: 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.9))',
              transform: isHovered ? 'scale(1.05)' : 'scale(1)',
              letterSpacing: '-0.05em'
            }}
          >
            {ranking}
          </div>
        </div>

        {/* Movie Card - RIGHT SIDE - Clean poster */}
        <div
          className="relative transition-all duration-300 ease-out hover:scale-[1.02] z-20"
          style={{ width: 'clamp(140px, 18vw, 200px)' }}
        >
          {/* Poster with year overlay */}
          <div className="relative aspect-[2/3] overflow-hidden rounded-xl w-full">
            <LazyImage
              src={movie.poster_url || movie.thumbnail_url || '/images/placeholder-poster.svg'}
              alt={`#${ranking} - ${movie.title}`}
              fill
              priority={priority}
              className="object-cover transition-all duration-500 ease-out group-hover:scale-105 group-hover:brightness-110"
              placeholder={movie.title}
              fallbackSrc="/images/placeholder-poster.svg"
              sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 200px"
            />

            {/* Year + badge overlay at bottom-left of poster */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2 z-10">
              <div className="flex items-center gap-1.5">
                {movie.release_year && (
                  <span className="text-white text-xs font-semibold drop-shadow-lg">{movie.release_year}</span>
                )}
                {(movie as any).content_type === 'series' && (
                  <span className="px-1.5 py-0.5 bg-blue-500/30 text-blue-400 rounded text-[10px] font-medium">Série</span>
                )}
              </div>
            </div>
          </div>

          {/* Buy button below poster - z-30 to stay above ranking number */}
          <div className="pt-2 px-0.5 relative z-30">
            <button
              onClick={isPurchased ? handleWatch : handlePurchase}
              className="w-full flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold py-2 px-3 rounded-lg transition-colors border border-white/10"
            >
              {isPurchased ? (
                <>
                  <PlayIcon className="w-4 h-4" />
                  <span className="text-xs">Assistir</span>
                </>
              ) : (
                <>
                  <ShoppingCartIcon className="w-4 h-4" />
                  {movie.discounted_price_cents && movie.discounted_price_cents < movie.price_cents ? (
                    <span className="text-xs flex items-center gap-1.5">
                      <span className="line-through text-gray-500">{formatPrice(movie.price_cents)}</span>
                      <span className="text-green-400 font-bold">{formatPrice(movie.discounted_price_cents)}</span>
                    </span>
                  ) : (
                    <span className="text-xs">{formatPrice(movie.price_cents)}</span>
                  )}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

    </div>
  );
});

export { Top10MovieCard };
