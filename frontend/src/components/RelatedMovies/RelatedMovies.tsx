'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { MovieCard } from '@/components/MovieCard/MovieCard';
import { Movie } from '@/types/movie';

interface RelatedMoviesProps {
  movies: Movie[];
  currentMovieId: string;
}

export default function RelatedMovies({ movies, currentMovieId }: RelatedMoviesProps) {
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const filteredMovies = movies.filter(movie =>
    movie.id !== currentMovieId && movie.status === 'ACTIVE'
  );

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const checkScrollability = () => {
      const { scrollLeft, scrollWidth, clientWidth } = container;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
    };

    checkScrollability();
    container.addEventListener('scroll', checkScrollability);
    window.addEventListener('resize', checkScrollability);

    return () => {
      container.removeEventListener('scroll', checkScrollability);
      window.removeEventListener('resize', checkScrollability);
    };
  }, [filteredMovies]);

  const scroll = (direction: 'left' | 'right') => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const cardWidth = container.querySelector('.movie-card')?.clientWidth || 280;
    const scrollAmount = cardWidth * 3;

    container.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  };

  if (filteredMovies.length === 0) {
    return null;
  }

  return (
    <section className="max-w-7xl tv:max-w-none mx-auto px-4 sm:px-6 lg:px-8 tv:px-16">
      <div className="flex items-center justify-between mb-8 tv:mb-12">
        <div>
          <h2 className="text-3xl sm:text-4xl tv:text-5xl font-bold text-white mb-2 tv:mb-4">
            Filmes Relacionados
          </h2>
          <p className="text-gray-400 tv:text-xl">
            Mais filmes que você pode gostar
          </p>
        </div>

        {/* Navigation Buttons - Desktop */}
        <div className="hidden sm:flex gap-2 tv:gap-4">
          <button
            onClick={() => scroll('left')}
            disabled={!canScrollLeft}
            className={`p-3 tv:p-4 rounded-xl border transition-all duration-200 ${
              canScrollLeft
                ? 'border-white/20 bg-dark-800/50 hover:bg-dark-800/80 hover:border-white/40 text-white'
                : 'border-white/10 bg-dark-900/30 text-gray-600 cursor-not-allowed'
            }`}
            aria-label="Rolar para a esquerda"
          >
            <svg className="w-5 h-5 tv:w-6 tv:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <button
            onClick={() => scroll('right')}
            disabled={!canScrollRight}
            className={`p-3 tv:p-4 rounded-xl border transition-all duration-200 ${
              canScrollRight
                ? 'border-white/20 bg-dark-800/50 hover:bg-dark-800/80 hover:border-white/40 text-white'
                : 'border-white/10 bg-dark-900/30 text-gray-600 cursor-not-allowed'
            }`}
            aria-label="Rolar para a direita"
          >
            <svg className="w-5 h-5 tv:w-6 tv:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      <div className="relative">
        <div
          ref={scrollContainerRef}
          className="flex gap-4 sm:gap-6 tv:gap-8 overflow-x-auto scrollbar-hide pb-4 tv:pb-6"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            scrollSnapType: 'x mandatory'
          }}
        >
          {filteredMovies.map((movie) => (
            <div
              key={movie.id}
              className="movie-card flex-shrink-0 w-[240px] sm:w-[280px] lg:w-[320px] tv:w-[380px]"
              style={{ scrollSnapAlign: 'start' }}
            >
              <MovieCard movie={movie} />
            </div>
          ))}

          {/* Show More Card */}
          <div className="flex-shrink-0 w-[240px] sm:w-[280px] lg:w-[320px] tv:w-[380px]">
            <Link
              href="/movies"
              className="group h-full min-h-[360px] tv:min-h-[420px] flex flex-col items-center justify-center bg-dark-800/30 border-2 border-dashed border-white/20 rounded-xl hover:border-primary-600/50 hover:bg-dark-800/50 transition-all duration-300"
            >
              <div className="p-4 tv:p-6 bg-primary-600/10 rounded-full mb-4 tv:mb-6 group-hover:bg-primary-600/20 transition-colors">
                <svg className="w-8 h-8 tv:w-10 tv:h-10 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
              <p className="text-lg tv:text-xl font-semibold text-white mb-2 tv:mb-3 text-center">
                Ver Todos os Filmes
              </p>
              <p className="text-sm tv:text-base text-gray-400 text-center px-4">
                Explore nosso catálogo completo
              </p>
            </Link>
          </div>
        </div>

        {/* Mobile Navigation Indicators */}
        <div className="flex justify-center gap-2 mt-6 sm:hidden">
          <div className={`h-1 rounded-full transition-all duration-200 ${
            canScrollLeft ? 'w-8 bg-primary-600' : 'w-4 bg-gray-600'
          }`} />
          <div className={`h-1 rounded-full transition-all duration-200 ${
            canScrollRight ? 'w-8 bg-primary-600' : 'w-4 bg-gray-600'
          }`} />
        </div>

        {/* Gradient Overlays */}
        <div className="hidden sm:block absolute top-0 left-0 w-12 tv:w-20 h-full bg-gradient-to-r from-dark-950 to-transparent pointer-events-none z-10" />
        <div className="hidden sm:block absolute top-0 right-0 w-12 tv:w-20 h-full bg-gradient-to-l from-dark-950 to-transparent pointer-events-none z-10" />
      </div>

      {/* Browse More Section */}
      <div className="mt-12 tv:mt-16 p-6 sm:p-8 tv:p-12 bg-gradient-to-r from-primary-600/10 via-purple-600/10 to-blue-600/10 border border-primary-600/20 rounded-2xl text-center">
        <h3 className="text-2xl tv:text-3xl font-bold text-white mb-3 tv:mb-4">
          Descubra Mais Filmes Incríveis
        </h3>
        <p className="text-gray-300 tv:text-lg mb-6 tv:mb-8 max-w-2xl mx-auto">
          Temos centenas de filmes em nosso catálogo. Explore por gênero, ano ou simplesmente navegue para encontrar sua próxima obsessão.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 tv:gap-6 justify-center">
          <Link
            href="/movies?sort=popular"
            className="btn-primary px-8 py-3 tv:px-10 tv:py-4 rounded-xl font-semibold hover:bg-primary-700 transition-colors inline-flex items-center justify-center gap-2 tv:gap-3 tv:text-lg"
          >
            <svg className="w-5 h-5 tv:w-6 tv:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Mais Populares
          </Link>
          <Link
            href="/movies?sort=newest"
            className="btn-secondary px-8 py-3 tv:px-10 tv:py-4 rounded-xl font-semibold hover:bg-white/20 transition-colors inline-flex items-center justify-center gap-2 tv:gap-3 tv:text-lg"
          >
            <svg className="w-5 h-5 tv:w-6 tv:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Lançamentos
          </Link>
        </div>
      </div>
    </section>
  );
}