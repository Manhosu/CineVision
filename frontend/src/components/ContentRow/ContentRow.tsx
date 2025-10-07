'use client';

import { useRef, useState, useCallback } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { MovieCard } from '@/components/MovieCard/MovieCard';
import { Movie } from '@/types/movie';

interface ContentRowProps {
  title: string;
  movies: Movie[];
  priority?: boolean; // Para otimização de imagens
  onMovieClick?: (movie: Movie) => void;
}

export function ContentRow({
  title,
  movies,
  priority = false,
  onMovieClick
}: ContentRowProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [isScrolling, setIsScrolling] = useState(false);

  const updateScrollButtons = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollLeft, scrollWidth, clientWidth } = container;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
  }, []);

  const scrollTo = useCallback((direction: 'left' | 'right') => {
    const container = scrollContainerRef.current;
    if (!container || isScrolling) return;

    setIsScrolling(true);

    const cardWidth = 280; // Largura aproximada do card + gap
    const scrollAmount = direction === 'left' ? -cardWidth * 3 : cardWidth * 3;

    container.scrollBy({
      left: scrollAmount,
      behavior: 'smooth'
    });

    // Atualizar botões após a animação
    setTimeout(() => {
      updateScrollButtons();
      setIsScrolling(false);
    }, 300);
  }, [isScrolling, updateScrollButtons]);

  const handleScroll = useCallback(() => {
    if (!isScrolling) {
      updateScrollButtons();
    }
  }, [isScrolling, updateScrollButtons]);

  // Atualizar botões quando os filmes mudarem
  useState(() => {
    setTimeout(updateScrollButtons, 100);
  });

  if (!movies || movies.length === 0) {
    return null;
  }

  return (
    <section className="relative py-8">
      <div className="container mx-auto px-4 lg:px-6">
        {/* Título da seção */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl md:text-3xl font-bold text-white">
            {title}
          </h2>

          {/* Contador de filmes (opcional) */}
          <span className="hidden sm:block text-sm text-gray-400">
            {movies.length} {movies.length === 1 ? 'filme' : 'filmes'}
          </span>
        </div>

        {/* Container do carrossel */}
        <div className="relative group">
          {/* Botão de scroll esquerda */}
          {canScrollLeft && (
            <button
              onClick={() => scrollTo('left')}
              className="absolute left-0 top-1/2 transform -translate-y-1/2 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/60 hover:bg-black/80 text-white p-3 rounded-full backdrop-blur-sm focus-outline"
              aria-label="Rolar para a esquerda"
              disabled={isScrolling}
            >
              <ChevronLeftIcon className="w-6 h-6" />
            </button>
          )}

          {/* Botão de scroll direita */}
          {canScrollRight && (
            <button
              onClick={() => scrollTo('right')}
              className="absolute right-0 top-1/2 transform -translate-y-1/2 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/60 hover:bg-black/80 text-white p-3 rounded-full backdrop-blur-sm focus-outline"
              aria-label="Rolar para a direita"
              disabled={isScrolling}
            >
              <ChevronRightIcon className="w-6 h-6" />
            </button>
          )}

          {/* Container de scroll */}
          <div
            ref={scrollContainerRef}
            className="flex space-x-4 overflow-x-auto scrollbar-hide scroll-smooth pb-4"
            onScroll={handleScroll}
            style={{
              scrollSnapType: 'x mandatory',
              WebkitOverflowScrolling: 'touch'
            }}
          >
            {movies.map((movie, index) => (
              <div
                key={movie.id}
                className="flex-none w-64 md:w-72"
                style={{ scrollSnapAlign: 'start' }}
              >
                <MovieCard
                  movie={movie}
                  priority={priority && index < 3} // Prioridade para os 3 primeiros
                  onClick={onMovieClick}
                  lazyLoad={!priority || index >= 3}
                />
              </div>
            ))}

            {/* Card "Ver mais" se houver muitos filmes */}
            {movies.length >= 12 && (
              <div className="flex-none w-64 md:w-72">
                <div className="h-full flex items-center justify-center card-hover rounded-lg border-2 border-dashed border-white/20 text-white/60 hover:text-white hover:border-white/40 transition-all cursor-pointer">
                  <div className="text-center p-8">
                    <ChevronRightIcon className="w-12 h-12 mx-auto mb-4" />
                    <p className="font-medium">Ver todos os filmes</p>
                    <p className="text-sm text-gray-400 mt-1">
                      +{movies.length - 12} filmes
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Indicadores de scroll para mobile */}
          <div className="flex justify-center mt-4 space-x-2 sm:hidden">
            <div className={`h-1 bg-white/20 rounded-full flex-1 max-w-20 ${canScrollLeft ? '' : 'bg-white/40'}`} />
            <div className={`h-1 bg-white/20 rounded-full flex-1 max-w-20 ${canScrollRight ? '' : 'bg-white/40'}`} />
          </div>
        </div>

        {/* Fallback para quando não há filmes */}
        {movies.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-400 text-lg">
              Nenhum filme disponível nesta categoria
            </div>
            <div className="text-gray-500 text-sm mt-2">
              Novos conteúdos serão adicionados em breve!
            </div>
          </div>
        )}
      </div>

      {/* Overlay para melhorar visibilidade dos botões de navegação */}
      <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-dark-950 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
      <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-dark-950 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
    </section>
  );
}