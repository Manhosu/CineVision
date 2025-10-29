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
  showFullInfo = false,
  isPurchased = false
}: MovieCardProps) {
  const router = useRouter();
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false); // TODO: Integrar com estado global
  const [isInWatchlist, setIsInWatchlist] = useState(false); // TODO: Integrar com estado global
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);

  const formatPrice = (priceInCents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(priceInCents / 100);
  };

  const handleWatch = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

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
      className="group relative cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleCardClick}
    >
      {/* Premium Minimalist Card */}
      <div className="relative w-full rounded-xl overflow-hidden bg-gradient-to-b from-zinc-900/50 to-zinc-950/80 backdrop-blur-sm transition-all duration-500 ease-out hover:scale-[1.02] hover:shadow-[0_8px_30px_rgba(0,0,0,0.6)]">

        {/* Poster Container - Clean & Full */}
        <div className="relative aspect-[2/3] overflow-hidden w-full">
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

          {/* Hover Overlay - Smooth & Elegant */}
          <div className={`absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent transition-all duration-500 z-30 ${
            isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}>

            {/* Info Section - Only on Hover */}
            <div className={`absolute bottom-0 left-0 right-0 p-4 transform transition-all duration-500 ${
              isHovered ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
            }`}>
              {/* Title */}
              <h3 className="text-white font-bold text-base mb-2 line-clamp-2 leading-tight">
                {movie.title}
              </h3>

              {/* Meta Info */}
              <div className="flex items-center gap-2 mb-3 text-xs text-gray-300">
                {movie.release_year && (
                  <span>{movie.release_year}</span>
                )}
                {(movie as any).content_type === 'series' && (
                  <span className="px-2 py-0.5 bg-blue-500/80 rounded text-white font-medium">Série</span>
                )}
                {movie.imdb_rating && (
                  <span className="flex items-center gap-1">
                    ⭐ {movie.imdb_rating.toFixed(1)}
                  </span>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={isPurchased ? handleWatch : handlePurchase}
                  className="flex-1 flex items-center justify-center gap-2 bg-white text-black font-bold py-2.5 px-4 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  {isPurchased ? (
                    <>
                      <PlayIcon className="w-4 h-4" />
                      <span className="text-sm">Assistir</span>
                    </>
                  ) : (
                    <>
                      <ShoppingCartIcon className="w-4 h-4" />
                      <span className="text-sm">{formatPrice(movie.price_cents)}</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleFavorite}
                  className="p-2.5 bg-zinc-800/90 hover:bg-zinc-700 rounded-lg transition-colors"
                  title={isFavorited ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                >
                  {isFavorited ? (
                    <HeartSolidIcon className="w-5 h-5 text-red-500" />
                  ) : (
                    <HeartIcon className="w-5 h-5 text-white" />
                  )}
                </button>

                <button
                  onClick={handleWatchlist}
                  className="p-2.5 bg-zinc-800/90 hover:bg-zinc-700 rounded-lg transition-colors"
                  title={isInWatchlist ? 'Remover da lista' : 'Adicionar à lista'}
                >
                  {isInWatchlist ? (
                    <CheckSolidIcon className="w-5 h-5 text-green-500" />
                  ) : (
                    <PlusIcon className="w-5 h-5 text-white" />
                  )}
                </button>
              </div>
            </div>
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
    </div>
  );
});

export { MovieCard };