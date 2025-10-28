'use client';

import { useRef, useState, useCallback } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { MovieCard } from '@/components/MovieCard/MovieCard';
import { Top10MovieCard } from '@/components/Top10MovieCard/Top10MovieCard';
import { Movie } from '@/types/movie';

interface ContentRowProps {
  title: string;
  movies: Movie[];
  priority?: boolean; // Para otimização de imagens
  onMovieClick?: (movie: Movie) => void;
  type?: 'featured' | 'latest' | 'popular' | 'top10'; // Section type
  purchasedMovieIds?: Set<string>; // IDs dos filmes comprados pelo usuário
}

export function ContentRow({
  title,
  movies,
  priority = false,
  onMovieClick,
  type,
  purchasedMovieIds = new Set()
}: ContentRowProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [isScrolling, setIsScrolling] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);

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

    const cardWidth = type === 'top10' ? 267 : 280; // Largura aproximada do card + gap
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

      // Calcular qual slide está ativo
      const container = scrollContainerRef.current;
      if (container && type === 'top10') {
        const scrollPosition = container.scrollLeft;
        const cardWidth = 267; // Largura dos cards menores
        const slideIndex = Math.round(scrollPosition / (cardWidth * 3));
        setActiveSlide(slideIndex);
      }
    }
  }, [isScrolling, updateScrollButtons, type]);

  // Atualizar botões quando os filmes mudarem
  useState(() => {
    setTimeout(updateScrollButtons, 100);
  });

  if (!movies || movies.length === 0) {
    return null;
  }

  const isTop10 = type === 'top10';

  return (
    <section
      className={`relative ${isTop10 ? 'py-16' : 'py-8'}`}
      style={isTop10 ? {
        background: 'linear-gradient(to bottom, #000000 0%, #1a1a1a 50%, #0a0a0a 100%)'
      } : undefined}
    >
      <div className="container mx-auto px-4 lg:px-6">
        {/* Título da seção */}
        <div className={`${isTop10 ? 'text-center mb-12' : 'flex items-center justify-between mb-6'}`}>
          <h2
            className="font-extrabold text-white"
            style={isTop10 ? {
              fontSize: 'clamp(2rem, 4vw, 3rem)',
              textShadow: '0 4px 12px rgba(0,0,0,0.5)',
              letterSpacing: '-0.02em'
            } : {
              fontSize: 'clamp(1.5rem, 3vw, 2rem)'
            }}
          >
            {title}
          </h2>

          {/* Contador de filmes (opcional) */}
          {!isTop10 && (
            <span className="hidden sm:block text-sm text-gray-400">
              {movies.length} {movies.length === 1 ? 'filme' : 'filmes'}
            </span>
          )}
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
            className={`flex overflow-x-auto scrollbar-hide scroll-smooth ${isTop10 ? 'gap-4 pb-6' : 'space-x-4 pb-4'}`}
            onScroll={handleScroll}
            style={{
              scrollSnapType: 'x mandatory',
              WebkitOverflowScrolling: 'touch'
            }}
          >
            {movies.map((movie, index) => (
              <div
                key={movie.id}
                className={`flex-none ${
                  type === 'top10'
                    ? 'w-[187px] sm:w-[220px] md:w-[240px] lg:w-[267px]'
                    : 'w-48 sm:w-56 md:w-64'
                }`}
                style={{ scrollSnapAlign: 'start' }}
              >
                {type === 'top10' ? (
                  <Top10MovieCard
                    movie={movie}
                    ranking={index + 1}
                    priority={priority && index < 3}
                    onClick={onMovieClick}
                    isPurchased={purchasedMovieIds.has(movie.id)}
                  />
                ) : (
                  <MovieCard
                    movie={movie}
                    priority={priority && index < 3}
                    onClick={onMovieClick}
                    lazyLoad={!priority || index >= 3}
                  />
                )}
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

          {/* Dots de navegação - Apenas para Top 10 */}
          {isTop10 && movies.length > 3 && (
            <div className="flex justify-center gap-2 mt-6">
              {Array.from({ length: Math.ceil(movies.length / 3) }).map((_, index) => (
                <button
                  key={index}
                  onClick={() => {
                    const container = scrollContainerRef.current;
                    if (container) {
                      const cardWidth = 267; // Largura dos cards menores
                      container.scrollTo({
                        left: index * cardWidth * 3,
                        behavior: 'smooth'
                      });
                      setActiveSlide(index);
                    }
                  }}
                  className={`transition-all duration-300 ${
                    activeSlide === index
                      ? 'w-6 h-2 bg-white/90 rounded-sm'
                      : 'w-2 h-2 bg-white/30 rounded-full hover:bg-white/50'
                  }`}
                  aria-label={`Ir para página ${index + 1}`}
                />
              ))}
            </div>
          )}

          {/* Indicadores de scroll para mobile - Outras seções */}
          {!isTop10 && (
            <div className="flex justify-center mt-4 space-x-2 sm:hidden">
              <div className={`h-1 bg-white/20 rounded-full flex-1 max-w-20 ${canScrollLeft ? '' : 'bg-white/40'}`} />
              <div className={`h-1 bg-white/20 rounded-full flex-1 max-w-20 ${canScrollRight ? '' : 'bg-white/40'}`} />
            </div>
          )}
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