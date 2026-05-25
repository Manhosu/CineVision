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
import { openContentGroup } from '@/lib/telegramAccess';
import { contentHref } from '@/lib/contentHref';

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
    await openContentGroup(movie.id, movie.telegram_group_link, {
      fallbackToast: 'Conteudo indisponivel no momento',
    });
  };

  const handlePurchase = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    // Redireciona pra página de detalhes conforme o tipo (filme/série/novelinha).
    router.push(contentHref(movie as any));
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
    // Igor (23/05): clicar no pôster/card abre o conteúdo (antes só o
    // botão "Adicionar" funcionava). Se um onClick custom foi passado,
    // respeita ele; senão navega pra página de detalhe.
    if (onClick) {
      onClick(movie);
    } else {
      router.push(contentHref(movie as any));
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

          {/* Flash promo overlay - TOP */}
          {isFlashPromo && promoTimeLeft && (
            <div className="absolute top-0 left-0 right-0 z-30 bg-gradient-to-r from-amber-600 via-orange-500 to-red-500 px-2 py-1.5 flex items-center justify-between gap-1">
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

          {/* Badge Novidade / Nova Temporada — sempre no topo, independente de promo */}
          {(movie.is_release || (movie as any).is_new_season) && (
            <div className={`absolute left-0 z-40 px-2 py-0.5 bg-[#E50914] text-white text-[10px] font-bold uppercase tracking-wider rounded-r shadow-lg shadow-black/40 ${isFlashPromo && promoTimeLeft ? 'top-9' : 'top-2'}`}>
              {(movie as any).is_new_season ? 'Nova Temporada' : 'Novidade'}
            </div>
          )}

          {/* Quick add-to-cart icon (top-right corner) */}
          {!isPurchased && (
            <div className={`absolute right-2 z-30 ${isFlashPromo && promoTimeLeft ? 'top-9' : 'top-2'}`} onClick={(e) => e.stopPropagation()}>
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
            {(movie as any).content_type === 'novelinha' && (
              <span className="px-1.5 py-0.5 bg-pink-500/20 text-pink-400 rounded text-[10px] font-medium">Novelinha</span>
            )}
          </div>

          {/* Preço grande, centralizado, acima do botão (Igor pediu).
              Botão fica minimalista só com "Adicionar". Para conteúdo
              já comprado, escondemos o preço — só sobra o "Assistir". */}
          {!isPurchased && (
            <div className="mb-2 text-center">
              {movie.discounted_price_cents && movie.discounted_price_cents < movie.price_cents ? (
                <div className="flex flex-col items-center leading-tight">
                  <span className="text-[11px] text-gray-500 line-through">
                    {formatPrice(movie.price_cents)}
                  </span>
                  <span className="text-base font-bold text-green-400">
                    {formatPrice(movie.discounted_price_cents)}
                  </span>
                </div>
              ) : (
                <span className="text-base font-bold text-white">
                  {formatPrice(movie.price_cents)}
                </span>
              )}
            </div>
          )}

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
                <span className="text-xs">Adicionar</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
});

export { MovieCard };