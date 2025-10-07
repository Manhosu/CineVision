'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import NextImage from 'next/image';
import { 
  PlayIcon, 
  InformationCircleIcon, 
  StarIcon,
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

  const handleWatchClick = async () => {
    try {
      toast.loading('Iniciando compra...', { id: 'purchase' });
      
      const response = await fetch('/api/stripe/create-payment-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          movieId: currentMovie.id,
          movieTitle: currentMovie.title,
          price: currentMovie.price_cents || 1999,
        }),
      });

      if (!response.ok) {
        throw new Error('Erro ao criar link de pagamento');
      }

      const { paymentUrl } = await response.json();
      
      toast.success('Redirecionando para pagamento...', { id: 'purchase' });
      
      // Redirect to payment page
      window.open(paymentUrl, '_blank');
      
    } catch (error) {
      console.error('Erro ao iniciar compra:', error);
      toast.error('Erro ao iniciar compra. Tente novamente.', { id: 'purchase' });
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price / 100);
  };

  return (
    <div className="relative h-[70vh] min-h-[500px] overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0 min-h-[500px]">
        <NextImage
          src={currentMovie.backdrop_url || currentMovie.poster_url || '/placeholder-movie.jpg'}
          alt={currentMovie.title}
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
      </div>

      {/* Content */}
      <div className="relative z-10 h-full flex items-center">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="max-w-2xl">
            <h1 className="text-4xl lg:text-6xl font-bold text-white mb-4">
              {currentMovie.title}
            </h1>
            
            <div className="flex items-center gap-4 mb-4 text-white/80">
              <div className="flex items-center gap-1">
                <StarIcon className="w-5 h-5 text-yellow-400" />
                <span>{currentMovie.imdb_rating?.toFixed(1) || 'N/A'}</span>
              </div>
              <div className="flex items-center gap-1">
                <ClockIcon className="w-5 h-5" />
                <span>{currentMovie.duration_minutes ? `${currentMovie.duration_minutes} min` : 'N/A'}</span>
              </div>
              <div className="flex items-center gap-1">
                <CalendarIcon className="w-5 h-5" />
                <span>{currentMovie.release_year || 'N/A'}</span>
              </div>
            </div>

            <p className="text-lg text-white/90 mb-8 line-clamp-3">
              {currentMovie.description || 'Descrição não disponível.'}
            </p>

            <div className="flex items-center gap-4">
              <button
                onClick={handleWatchClick}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors"
              >
                <PlayIcon className="w-5 h-5" />
                Assistir - {formatPrice(currentMovie.price_cents || 1999)}
              </button>
              
              <button className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-6 py-3 rounded-lg font-semibold transition-colors backdrop-blur-sm">
                <InformationCircleIcon className="w-5 h-5" />
                Mais Informações
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Arrows */}
      {movies.length > 1 && (
        <>
          <button
            onClick={goToPrevious}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"
          >
            <ChevronLeftIcon className="w-6 h-6" />
          </button>
          
          <button
            onClick={goToNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"
          >
            <ChevronRightIcon className="w-6 h-6" />
          </button>
        </>
      )}

      {/* Dots Indicator */}
      {movies.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-2">
          {movies.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`w-3 h-3 rounded-full transition-colors ${
                index === currentIndex ? 'bg-white' : 'bg-white/50'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}