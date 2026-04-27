'use client';

import { useState, useEffect, memo } from 'react';
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
import AddToCartButton from '@/components/Cart/AddToCartButton';

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
  const [isFavorited, setIsFavorited] = useState(false);
  const [isInWatchlist, setIsInWatchlist] = useState(false);
  const [promoTimeLeft, setPromoTimeLeft] = useState('');

  const isFlashPromo = movie.is_flash_promo && movie.promo_ends_at && movie.discounted_price_cents;

  // Flash promo countdown
  useEffect(() => {
    if (!isFlashPromo || !movie.promo_ends_at) return;
    const tick = () => {
      const diff = new Date(movie.promo_ends_at!).getTime() - Date.now();
      if (diff <= 0) { setPromoTimeLeft(''); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setPromoTimeLeft(h > 0 ? `${h}h${String(m).padStart(2, '0')}m` : `${m}:${String(s).padStart(2, '0')}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isFlashPromo, movie.promo_ends_at]);

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
      {/* Card container */}
      <div className={`relative w-full transition-all duration-300 ease-out hover:scale-[1.02] ${
        isFlashPromo ? 'rounded-xl shadow-[0_0_20px_rgba(245,158,11,0.25)]' : ''
      }`}>

        {/* Poster */}
        <div className={`relative w-full rounded-xl overflow-hidden ${
          isFlashPromo ? 'ring-2 ring-amber-500/70' : ''
        }`} style={{ aspectRatio: '2/3', minHeight: '280px' }}>

          {/* Flash promo overlay badge - TOP */}
          {isFlashPromo && promoTimeLeft && (
            <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-r from-amber-600 via-orange-500 to-red-500 px-3 py-1.5 flex items-center justify-center gap-1.5">
              <span className="text-white text-xs font-black uppercase tracking-wide">&#9889; Oferta</span>
              <span className="bg-white/20 text-white text-xs font-mono font-bold px-1.5 py-0.5 rounded">{promoTimeLeft}</span>
            </div>
          )}

          {/* Flash promo discount badge - BOTTOM */}
          {isFlashPromo && movie.discount_percentage && (
            <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-red-600/90 to-transparent pt-6 pb-2 px-3 flex items-center justify-center">
              <span className="text-white text-sm font-black">{movie.discount_percentage}% OFF</span>
            </div>
          )}
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

          {/* Quick add-to-cart icon (top-right corner) */}
          {!isPurchased && (
            <div className="absolute top-2 right-2 z-30" onClick={(e) => e.stopPropagation()}>
              <AddToCartButton
                content={{
                  id: movie.id,
                  title: movie.title,
                  poster_url: movie.poster_url || undefined,
                  price_cents: movie.discounted_price_cents && movie.discounted_price_cents < movie.price_cents
                    ? movie.discounted_price_cents
                    : movie.price_cents,
                  type: (movie as any).content_type || 'movie',
                }}
                variant="icon"
              />
            </div>
          )}
        </div>

        {/* Info + Buy button below poster */}
        <div className="pt-2 px-0.5">
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
            {movie.release_year && <span>{movie.release_year}</span>}
            {(movie as any).content_type === 'series' && (
              <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded text-[10px] font-medium">Série</span>
            )}
          </div>

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
  );
});

export { MovieCard };