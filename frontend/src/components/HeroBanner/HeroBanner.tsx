'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import NextImage from 'next/image';
import {
  PlayIcon,
  InformationCircleIcon,
  ClockIcon,
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';
import { Movie } from '@/types/movie';
import { toast } from 'react-hot-toast';

interface HeroBannerProps {
  movies: Movie[];
  autoPlay?: boolean;
  autoPlayInterval?: number;
}

export function HeroBanner({
  movies,
  autoPlay = true,
  autoPlayInterval = 5000
}: HeroBannerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(autoPlay);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const pauseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();

  // Early return if no movies
  if (!movies || movies.length === 0) {
    return (
      <div className="relative h-[70vh] bg-gray-900 flex items-center justify-center">
        <p className="text-white text-xl">Carregando filmes...</p>
      </div>
    );
  }

  // Get current movie safely using useMemo
  const currentMovie = useMemo(() => {
    const index = Math.min(currentIndex, movies.length - 1);
    return movies[index];
  }, [currentIndex, movies]);

  // Auto play functionality
  useEffect(() => {
    if (!isAutoPlaying || movies.length <= 1) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % movies.length);
    }, autoPlayInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isAutoPlaying, movies.length, autoPlayInterval]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (pauseTimeoutRef.current) {
        clearTimeout(pauseTimeoutRef.current);
      }
    };
  }, []);

  const pauseAutoPlay = useCallback(() => {
    setIsAutoPlaying(false);
    
    if (pauseTimeoutRef.current) {
      clearTimeout(pauseTimeoutRef.current);
    }
    
    pauseTimeoutRef.current = setTimeout(() => {
      setIsAutoPlaying(true);
    }, 10000);
  }, []);

  const goToSlide = useCallback((index: number) => {
    if (index >= 0 && index < movies.length) {
      setCurrentIndex(index);
      pauseAutoPlay();
    }
  }, [movies.length, pauseAutoPlay]);

  const goToPrevious = useCallback(() => {
    setCurrentIndex(prev => prev === 0 ? movies.length - 1 : prev - 1);
    pauseAutoPlay();
  }, [movies.length, pauseAutoPlay]);

  const goToNext = useCallback(() => {
    setCurrentIndex(prev => (prev + 1) % movies.length);
    pauseAutoPlay();
  }, [movies.length, pauseAutoPlay]);

  const handleWatchClick = () => {
    // Generate Telegram deep link for purchase
    const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'cinevisionv2bot';
    const deepLink = `https://t.me/${botUsername}?start=buy_${currentMovie.id}`;

    toast.success('Abrindo Telegram...', {
      duration: 2000,
      icon: '📱'
    });

    // Open Telegram
    window.open(deepLink, '_blank');
  };

  // Touch swipe for mobile
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    touchEndX.current = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 50) {
      if (diff > 0) goToNext();
      else goToPrevious();
    }
  }, [goToNext, goToPrevious]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price / 100);
  };

  return (
    <div
      className="relative h-[60vh] md:h-[70vh] lg:h-[80vh] min-h-[400px] lg:min-h-[550px] overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Background Image */}
      <div className="absolute inset-0">
        <NextImage
          src={currentMovie.backdrop_url || currentMovie.poster_url || '/placeholder-movie.jpg'}
          alt={currentMovie.title}
          fill
          className="object-cover"
          priority
        />
        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#050508] via-[#050508]/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#050508]/70 via-[#050508]/30 to-transparent" />
      </div>

      {/* Content - positioned at bottom */}
      <div className="relative z-10 h-full flex items-end pb-10 md:pb-12 lg:pb-16">
        <div className="container mx-auto px-5 lg:px-8">
          <div className="max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl">
            <h1 className="text-2xl md:text-3xl lg:text-5xl xl:text-6xl font-extrabold text-white mb-2 leading-tight tracking-tight line-clamp-2">
              {currentMovie.title}
            </h1>

            {/* Compact metadata row */}
            <div className="flex items-center gap-2 md:gap-3 mb-2 text-[11px] md:text-sm text-white/60">
              {currentMovie.imdb_rating && (
                <span className="text-white/80 font-medium">TMDB {currentMovie.imdb_rating}</span>
              )}
              {currentMovie.release_year && (
                <span>{currentMovie.release_year}</span>
              )}
              {currentMovie.duration_minutes && (
                <span>{Math.floor(currentMovie.duration_minutes / 60)}h {currentMovie.duration_minutes % 60}m</span>
              )}
              {(currentMovie as any).content_type === 'series' && (currentMovie as any).total_seasons && (
                <span>{(currentMovie as any).total_seasons} Temporada(s)</span>
              )}
              {currentMovie.age_rating && (
                <span className="border border-white/30 text-white/70 px-1.5 py-0.5 rounded text-[10px] md:text-xs font-medium">
                  {currentMovie.age_rating}
                </span>
              )}
            </div>

            <p className="text-xs md:text-sm lg:text-base text-white/50 mb-4 md:mb-5 line-clamp-2 md:line-clamp-3 leading-relaxed max-w-md lg:max-w-lg">
              {currentMovie.description || 'Descrição não disponível.'}
            </p>

            {/* Two buttons - FilmZone style: Assistir (white) + Detalhes (gray) */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  const contentType = (currentMovie as any).content_type || (currentMovie as any).type;
                  const route = contentType === 'series' ? `/series/${currentMovie.id}` : `/movies/${currentMovie.id}`;
                  router.push(route);
                }}
                className="inline-flex items-center gap-2 bg-white hover:bg-white/90 text-black px-5 md:px-6 py-2.5 rounded-lg font-semibold text-sm transition-all active:scale-95"
              >
                <PlayIcon className="w-4 h-4" />
                Assistir
              </button>
              <button
                onClick={() => {
                  const contentType = (currentMovie as any).content_type || (currentMovie as any).type;
                  const route = contentType === 'series' ? `/series/${currentMovie.id}` : `/movies/${currentMovie.id}`;
                  router.push(route);
                }}
                className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white px-5 md:px-6 py-2.5 rounded-lg font-semibold text-sm transition-all active:scale-95 border border-white/10"
              >
                <InformationCircleIcon className="w-4 h-4" />
                Detalhes
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Arrows - hidden on mobile for cleaner look */}
      {movies.length > 1 && (
        <>
          <button
            onClick={goToPrevious}
            className="hidden md:block absolute left-4 top-1/2 -translate-y-1/2 z-20 bg-black/40 hover:bg-black/60 text-white p-2 rounded-full transition-colors"
          >
            <ChevronLeftIcon className="w-5 h-5" />
          </button>

          <button
            onClick={goToNext}
            className="hidden md:block absolute right-4 top-1/2 -translate-y-1/2 z-20 bg-black/40 hover:bg-black/60 text-white p-2 rounded-full transition-colors"
          >
            <ChevronRightIcon className="w-5 h-5" />
          </button>
        </>
      )}

      {/* Dots Indicator - inside hero, above overlap zone */}
      {movies.length > 1 && (
        <div className="absolute bottom-3 md:bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-1.5">
          {movies.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`transition-all duration-300 rounded-full ${
                index === currentIndex ? 'w-6 h-2 bg-white' : 'w-2 h-2 bg-white/40'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}