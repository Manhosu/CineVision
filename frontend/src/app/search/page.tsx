'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Header } from '@/components/Header/Header';
import { MovieCard } from '@/components/MovieCard/MovieCard';
import { Movie } from '@/types/movie';
import { MagnifyingGlassIcon, FilmIcon, PlusCircleIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/hooks/useAuth';
import toast from 'react-hot-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function SearchResults() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const query = searchParams?.get('q') || '';
  const [movies, setMovies] = useState<Movie[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRequesting, setIsRequesting] = useState(false);

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

  const handleRequestMovie = async () => {
    // Verificar autenticação
    if (!isAuthenticated || !user) {
      toast.error('Você precisa estar logado para fazer solicitações');
      router.push('/login');
      return;
    }

    setIsRequesting(true);
    try {
      const token = localStorage.getItem('token');

      console.log('[SearchPage] Enviando solicitação:', {
        title: query,
        user_id: user.id,
        user_email: user.email,
      });

      const response = await fetch(`${API_URL}/api/v1/requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
        body: JSON.stringify({
          title: query,
          description: `Solicitação de conteúdo: ${query}`,
          user_id: user.id,
          user_email: user.email,
          notify_when_added: true,
        }),
      });

      const responseData = await response.json();
      console.log('[SearchPage] Resposta do servidor:', responseData);

      if (!response.ok) {
        throw new Error(responseData.message || 'Erro ao criar solicitação');
      }

      toast.success(
        'Solicitação enviada! Você será notificado pelo Telegram quando o conteúdo for adicionado.',
        { duration: 5000 }
      );
    } catch (error: any) {
      console.error('[SearchPage] Erro ao solicitar filme:', error);
      toast.error(error.message || 'Erro ao enviar solicitação');
    } finally {
      setIsRequesting(false);
    }
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

              {!isAuthenticated ? (
                <div className="space-y-3">
                  <p className="text-yellow-400 text-sm flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    Você precisa estar logado para fazer solicitações
                  </p>
                  <button
                    onClick={() => router.push('/login')}
                    className="btn-primary text-lg px-8 py-4 w-full sm:w-auto"
                  >
                    <span className="flex items-center justify-center">
                      <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                      </svg>
                      Fazer Login
                    </span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleRequestMovie}
                  disabled={isRequesting}
                  className="btn-primary text-lg px-8 py-4 w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isRequesting ? (
                    <span className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Enviando...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center">
                      <PlusCircleIcon className="w-6 h-6 mr-2" />
                      Solicitar "{query}"
                    </span>
                  )}
                </button>
              )}
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
