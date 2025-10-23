'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Header } from '@/components/Header/Header';
import { MovieCard } from '@/components/MovieCard/MovieCard';
import { Movie } from '@/types/movie';
import { MagnifyingGlassIcon, FilmIcon, PlusCircleIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function SearchResults() {
  const searchParams = useSearchParams();
  const query = searchParams?.get('q') || '';
  const [movies, setMovies] = useState<Movie[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (query) {
      searchMovies(query);
    } else {
      setIsLoading(false);
    }
  }, [query]);

  const searchMovies = async (searchQuery: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `${API_URL}/api/v1/content/movies?search=${encodeURIComponent(searchQuery)}`,
        { cache: 'no-store' }
      );

      if (!response.ok) {
        throw new Error('Erro ao buscar filmes');
      }

      const result = await response.json();
      setMovies(result.data || []);
    } catch (error) {
      console.error('Erro na busca:', error);
      toast.error('Erro ao buscar filmes');
      setMovies([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestMovie = () => {
    // Abrir Telegram direto no chat do bot
    const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'cinevisionv2bot';
    const deepLink = `https://t.me/${botUsername}`;

    toast.success('Abrindo Telegram... Digite /solicitar para fazer seu pedido!', {
      duration: 3000,
      icon: '📱'
    });

    // Abrir Telegram
    window.open(deepLink, '_blank');
  };

  if (!query) {
    return (
      <div className="min-h-screen bg-dark-950">
        <Header />
        <main className="container mx-auto px-4 pt-32 pb-16">
          <div className="text-center max-w-md mx-auto">
            <MagnifyingGlassIcon className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">
              Digite algo para buscar
            </h2>
            <p className="text-gray-400">
              Use a barra de pesquisa acima para encontrar filmes e séries
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-950">
      <Header />
      <main className="container mx-auto px-4 pt-32 pb-16">
        {/* Cabeçalho de busca */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Resultados para: <span className="text-primary-500">"{query}"</span>
          </h1>
          <p className="text-gray-400">
            {isLoading
              ? 'Buscando...'
              : `${movies.length} ${movies.length === 1 ? 'resultado encontrado' : 'resultados encontrados'}`}
          </p>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        )}

        {/* Resultados */}
        {!isLoading && movies.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {movies.map((movie) => (
              <MovieCard key={movie.id} movie={movie} />
            ))}
          </div>
        )}

        {/* Nenhum resultado encontrado */}
        {!isLoading && movies.length === 0 && (
          <div className="bg-dark-900/50 backdrop-blur-sm border border-white/10 rounded-xl p-8 text-center max-w-2xl mx-auto">
            <div className="mb-6">
              <FilmIcon className="w-20 h-20 text-gray-600 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-white mb-2">
                Nenhum resultado encontrado
              </h3>
              <p className="text-gray-400 mb-6">
                Não encontramos "{query}" em nosso catálogo
              </p>
            </div>

            {/* Botão de solicitação */}
            <div className="bg-gradient-to-r from-primary-600/10 to-primary-800/10 border border-primary-600/30 rounded-xl p-6 mb-6">
              <div className="flex items-center justify-center mb-4">
                <PlusCircleIcon className="w-8 h-8 text-primary-500 mr-2" />
                <h4 className="text-lg font-semibold text-white">
                  Gostaria de ver este conteúdo?
                </h4>
              </div>
              <p className="text-gray-300 text-sm mb-6">
                Solicite e receba uma notificação pelo Telegram assim que o conteúdo for adicionado à plataforma!
              </p>

              <button
                onClick={handleRequestMovie}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-4 rounded-lg transition-colors duration-200 w-full sm:w-auto flex items-center justify-center gap-3"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                </svg>
                <span>Solicitar via Telegram</span>
              </button>
            </div>

            <div className="text-sm text-gray-500">
              <p>Dica: Verifique a ortografia ou tente palavras-chave diferentes</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    }>
      <SearchResults />
    </Suspense>
  );
}
