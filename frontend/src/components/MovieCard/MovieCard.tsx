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

interface MovieCardProps {
  movie: Movie;
  priority?: boolean;
  lazyLoad?: boolean;
  onClick?: (movie: Movie) => void;
  showFullInfo?: boolean;
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

  const handlePurchase = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (isPurchasing) return;

    setIsPurchasing(true);

    try {
      // Iniciar fluxo de compra
      const response = await fetch('/api/purchases/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content_id: movie.id,
          preferred_delivery: 'site' // ou 'telegram' baseado na preferência do usuário
        })
      });

      if (!response.ok) {
        throw new Error('Erro ao iniciar compra');
      }

      const data = await response.json();

      // Redirecionar para o Telegram para completar a compra
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

  const availabilityBadge = () => {
    switch (movie.availability) {
      case 'TELEGRAM':
        return (
          <div className="absolute top-2 right-2 bg-blue-600 text-white text-xs px-2 py-1 rounded-full font-medium">
            📱 Telegram
          </div>
        );
      case 'SITE':
        return (
          <div className="absolute top-2 right-2 bg-green-600 text-white text-xs px-2 py-1 rounded-full font-medium">
            🌐 Site
          </div>
        );
      case 'BOTH':
        return (
          <div className="absolute top-2 right-2 bg-primary-600 text-white text-xs px-2 py-1 rounded-full font-medium">
            ✨ Ambos
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div
      className="group relative cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleCardClick}
    >
      {/* Main Card */}
      <div className="card-hover rounded-xl overflow-hidden bg-dark-900/50 backdrop-blur-sm border border-white/10 transition-all duration-300 hover:border-white/20 hover:shadow-2xl">

        {/* Movie Poster */}
        <div className="relative aspect-[2/3] min-h-[300px] overflow-hidden">
          <LazyImage
            src={movie.poster_url || movie.thumbnail_url || '/images/placeholder-poster.svg'}
            alt={movie.title}
            fill
            priority={priority}
            className="object-cover transition-all duration-300 group-hover:scale-105"
            placeholder={movie.title}
            fallbackSrc="/images/placeholder-poster.svg"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
          />

          {/* Availability badge */}
          {availabilityBadge()}

          {/* Rating badge */}
          {movie.imdb_rating && (
            <div className="absolute top-2 left-2 flex items-center space-x-1 bg-black/70 text-white text-xs px-2 py-1 rounded-full backdrop-blur-sm">
              <StarIcon className="w-3 h-3 text-yellow-500" />
              <span className="font-medium">{movie.imdb_rating.toFixed(1)}</span>
            </div>
          )}

          {/* Hover overlay */}
          <div className={`absolute inset-0 bg-black/60 transition-opacity duration-300 ${
            isHovered ? 'opacity-100' : 'opacity-0'
          }`}>

            {/* Play/Purchase button */}
            <div className="absolute inset-0 flex items-center justify-center">
              <button
                onClick={isPurchased ? handleWatch : handlePurchase}
                disabled={isPurchasing}
                className={`btn-primary text-sm px-4 py-2 transform transition-all duration-300 ${
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
                className="btn-icon bg-black/50 text-white hover:bg-black/70 hover:scale-110"
                title={isFavorited ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
              >
                {isFavorited ? (
                  <HeartSolidIcon className="w-5 h-5 text-red-500" />
                ) : (
                  <HeartIcon className="w-5 h-5" />
                )}
              </button>

              <button
                onClick={handleWatchlist}
                className="btn-icon bg-black/50 text-white hover:bg-black/70 hover:scale-110"
                title={isInWatchlist ? 'Remover da lista' : 'Adicionar à lista'}
              >
                {isInWatchlist ? (
                  <CheckSolidIcon className="w-5 h-5 text-green-500" />
                ) : (
                  <PlusIcon className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Movie Info */}
        <div className="p-4 space-y-3">

          {/* Title */}
          <h3 className="font-semibold text-white text-sm line-clamp-2 group-hover:text-primary-400 transition-colors">
            {movie.title}
          </h3>

          {/* Price or Purchased Badge */}
          {isPurchased ? (
            <div className="flex items-center space-x-2">
              <CheckIcon className="w-4 h-4 text-green-500" />
              <span className="text-green-500 font-medium text-sm">Adquirido</span>
            </div>
          ) : (
            <div className="text-primary-500 font-bold text-lg">
              {formatPrice(movie.price_cents)}
            </div>
          )}

          {/* Additional Info */}
          {showFullInfo && (
            <>
              {/* Genres */}
              {movie.genres && movie.genres.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {movie.genres.slice(0, 2).map((genre) => (
                    <span
                      key={genre}
                      className="text-xs text-gray-400 bg-white/5 px-2 py-1 rounded-full"
                    >
                      {genre}
                    </span>
                  ))}
                </div>
              )}

              {/* Year and Duration */}
              <div className="flex items-center justify-between text-xs text-gray-400">
                {movie.release_year && <span>{movie.release_year}</span>}
                {movie.duration_minutes && (
                  <div className="flex items-center space-x-1">
                    <ClockIcon className="w-3 h-3" />
                    <span>{formatDuration(movie.duration_minutes)}</span>
                  </div>
                )}
              </div>

              {/* Description */}
              <p className="text-xs text-gray-400 line-clamp-2">
                {movie.description}
              </p>
            </>
          )}

          {/* Quick Actions */}
          <div className="flex items-center justify-between pt-2">
            <Link
              href={`/movies/${movie.id}`}
              className="text-xs text-gray-400 hover:text-white transition-colors focus-outline"
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

export { MovieCard };