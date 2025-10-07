'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Movie } from '@/types/movie';
import { usePerformanceOptimization } from '@/hooks/usePerformanceOptimization';

interface MovieHeroProps {
  movie: Movie;
}

export default function MovieHero({ movie }: MovieHeroProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const { deviceInfo, getOptimizedImageUrl } = usePerformanceOptimization();

  const backdropUrl = movie.backdrop_url || movie.thumbnail_url || '/images/placeholder-backdrop.svg';
  const optimizedBackdropUrl = getOptimizedImageUrl(
    backdropUrl,
    deviceInfo.isMobile ? 800 : 1920,
    deviceInfo.isMobile ? 450 : 1080
  );

  useEffect(() => {
    const img = new window.Image();
    img.onload = () => setImageLoaded(true);
    img.onerror = () => setImageError(true);
    img.src = optimizedBackdropUrl;
  }, [optimizedBackdropUrl]);

  return (
    <div className="relative h-[60vh] sm:h-[70vh] lg:h-[80vh] xl:h-screen max-h-[900px] overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0">
        {!imageError ? (
          <Image
            src={optimizedBackdropUrl}
            alt={movie.title}
            fill
            sizes="100vw"
            priority
            quality={deviceInfo.isLowEnd ? 60 : 90}
            className={`object-cover object-center transition-opacity duration-700 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-dark-800 via-dark-900 to-dark-950" />
        )}

        {/* Loading skeleton */}
        {!imageLoaded && !imageError && (
          <div className="absolute inset-0 bg-dark-900 animate-pulse">
            <div className="absolute inset-0 bg-gradient-to-r from-dark-900 via-dark-800 to-dark-900 opacity-50" />
          </div>
        )}
      </div>

      {/* Gradient Overlays */}
      <div className="absolute inset-0">
        {/* Top gradient for header */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-black/80 via-black/40 to-transparent" />

        {/* Bottom gradient for content */}
        <div className="absolute bottom-0 left-0 right-0 h-2/3 bg-gradient-to-t from-dark-950 via-dark-950/80 to-transparent" />

        {/* Side gradients for better text readability */}
        <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-black/50 to-transparent" />
        <div className="absolute inset-y-0 right-0 w-1/3 bg-gradient-to-l from-black/50 to-transparent" />

        {/* Mobile additional overlay for better readability */}
        <div className="absolute inset-0 bg-black/20 sm:hidden" />
      </div>

      {/* Content */}
      <div className="relative z-10 h-full flex items-end">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pb-12 lg:pb-16">
          <div className="max-w-3xl">
            {/* Movie Badge */}
            <div className="flex items-center gap-3 mb-4 sm:mb-6">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-primary-600/90 backdrop-blur-sm rounded-full">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                  <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                </svg>
                <span className="text-white text-sm font-semibold">Filme em Destaque</span>
              </div>

              {movie.imdb_rating && (
                <div className="flex items-center gap-1 px-3 py-1.5 bg-yellow-500/90 backdrop-blur-sm rounded-full">
                  <svg className="w-4 h-4 text-white fill-current" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span className="text-white text-sm font-bold">{movie.imdb_rating.toFixed(1)}</span>
                </div>
              )}
            </div>

            {/* Title */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold text-white mb-4 sm:mb-6 leading-tight tracking-tight">
              {movie.title}
            </h1>

            {/* Movie Meta Info */}
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 mb-4 sm:mb-6 text-gray-300">
              {movie.release_year && (
                <span className="font-semibold">{movie.release_year}</span>
              )}

              {movie.duration_minutes && (
                <>
                  <span className="w-1 h-1 bg-gray-500 rounded-full" />
                  <span>
                    {Math.floor(movie.duration_minutes / 60)}h {movie.duration_minutes % 60}min
                  </span>
                </>
              )}

              <span className="w-1 h-1 bg-gray-500 rounded-full" />
              <div className="flex gap-1">
                <span className="px-2 py-0.5 bg-green-600/80 text-green-100 text-xs font-bold rounded">
                  HD
                </span>
                <span className="px-2 py-0.5 bg-blue-600/80 text-blue-100 text-xs font-bold rounded">
                  FHD
                </span>
              </div>
            </div>

            {/* Genres */}
            {movie.genres && movie.genres.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6 sm:mb-8">
                {movie.genres.slice(0, 4).map((genre) => (
                  <span
                    key={genre}
                    className="px-3 py-1 bg-white/10 backdrop-blur-sm border border-white/20 text-white text-sm font-medium rounded-full hover:bg-white/20 transition-colors"
                  >
                    {genre}
                  </span>
                ))}
              </div>
            )}

            {/* Description */}
            <p className="text-gray-200 text-base sm:text-lg lg:text-xl leading-relaxed mb-8 sm:mb-10 max-w-2xl line-clamp-3 sm:line-clamp-4">
              {movie.description}
            </p>

            {/* Price and CTA */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-bold text-primary-600">
                  R$ {(movie.price_cents / 100).toFixed(2)}
                </span>
                <span className="text-gray-400 text-sm font-medium">compra única</span>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full sm:w-auto">
                <button className="btn-primary px-8 py-3 sm:py-4 text-base sm:text-lg font-bold rounded-xl shadow-lg shadow-primary-600/25 hover:shadow-primary-600/40 transform hover:scale-105 transition-all duration-200">
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                  </svg>
                  Comprar via Telegram
                </button>

                <button className="btn-secondary px-6 py-3 sm:py-4 text-base sm:text-lg font-semibold rounded-xl hover:bg-white/20 transition-all duration-200">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  Favoritar
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-10">
        <div className="flex flex-col items-center gap-2 text-white/60 animate-bounce">
          <span className="text-xs font-medium hidden sm:block">Role para mais detalhes</span>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>
      </div>
    </div>
  );
}