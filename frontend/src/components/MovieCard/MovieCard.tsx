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
      {/* Main Card - Netflix Style */}
      <div className="relative rounded-lg overflow-hidden transition-all duration-300 ease-in-out hover:scale-105 hover:brightness-110 shadow-[0_4px_20px_rgba(0,0,0,0.4)]">

        {/* Movie Poster */}
        <div className="relative aspect-[2/3] overflow-hidden">
          <LazyImage
            src={movie.poster_url || movie.thumbnail_url || '/images/placeholder-poster.svg'}
            alt={movie.title}
            fill
            priority={priority}
            className="object-cover transition-all duration-300"
            placeholder={movie.title}
            fallbackSrc="/images/placeholder-poster.svg"
            sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 180px"
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
          />

          {/* Gradient overlay for title - Always visible */}
          <div
            className="absolute bottom-0 left-0 right-0 pointer-events-none z-10"
            style={{
              height: '50%',
              background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.7) 50%, transparent 100%)'
            }}
          />

          {/* Title - Always visible at bottom */}
          <div className="absolute bottom-0 left-0 right-0 p-3 z-20">
            <h3 className="font-semibold text-white text-sm line-clamp-2 leading-tight">
              {movie.title}
            </h3>
          </div>

          {/* Badges - Bottom left corner */}
          <div className="absolute bottom-2 left-2 flex flex-col gap-1.5 z-20">
            {/* Age Rating */}
            {movie.age_rating && (
              <div className="border-2 border-yellow-500 text-yellow-500 bg-black/70 text-xs px-1.5 py-0.5 rounded font-bold backdrop-blur-sm">
                {movie.age_rating}
              </div>
            )}

            {/* Purchased Badge */}
            {isPurchased && (
              <div className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-green-500/90 text-white rounded text-xs font-medium backdrop-blur-sm">
                <CheckIcon className="w-3 h-3" />
                <span>Adquirido</span>
              </div>
            )}

            {/* Series Badge */}
            {(movie as any).content_type === 'series' && (
              <div className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-500/90 text-white rounded text-xs font-medium backdrop-blur-sm">
                <span>📺</span>
              </div>
            )}

            {/* Availability badge */}
            {movie.availability === 'TELEGRAM' && (
              <div className="bg-blue-600/90 text-white text-xs px-1.5 py-0.5 rounded font-medium backdrop-blur-sm">
                📱
              </div>
            )}
            {movie.availability === 'SITE' && (
              <div className="bg-green-600/90 text-white text-xs px-1.5 py-0.5 rounded font-medium backdrop-blur-sm">
                🌐
              </div>
            )}
            {movie.availability === 'BOTH' && (
              <div className="bg-primary-600/90 text-white text-xs px-1.5 py-0.5 rounded font-medium backdrop-blur-sm">
                ✨
              </div>
            )}
          </div>

          {/* Hover overlay */}
          <div className={`absolute inset-0 bg-black/60 transition-opacity duration-300 z-30 ${
            isHovered ? 'opacity-100' : 'opacity-0'
          }`}>

            {/* Play/Purchase button */}
            <div className="absolute inset-0 flex items-center justify-center">
              <button
                onClick={isPurchased ? handleWatch : handlePurchase}
                className={`btn-primary text-sm px-4 py-2 transform transition-all duration-300 ${
                  isHovered ? 'scale-100 opacity-100' : 'scale-75 opacity-0'
                }`}
              >
                {isPurchased ? (
                  <>
                    <PlayIcon className="w-4 h-4 mr-2" />
                    Assistir
                  </>
                ) : (
                  <>
                    <ShoppingCartIcon className="w-4 h-4 mr-2" />
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
                className="btn-icon bg-black/50 text-white hover:bg-black/70 hover:scale-110 w-8 h-8"
                title={isFavorited ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
              >
                {isFavorited ? (
                  <HeartSolidIcon className="w-4 h-4 text-red-500" />
                ) : (
                  <HeartIcon className="w-4 h-4" />
                )}
              </button>

              <button
                onClick={handleWatchlist}
                className="btn-icon bg-black/50 text-white hover:bg-black/70 hover:scale-110 w-8 h-8"
                title={isInWatchlist ? 'Remover da lista' : 'Adicionar à lista'}
              >
                {isInWatchlist ? (
                  <CheckSolidIcon className="w-4 h-4 text-green-500" />
                ) : (
                  <PlusIcon className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>
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