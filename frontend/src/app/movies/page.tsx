'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import MovieGrid from '@/components/MovieGrid/MovieGrid';
import FilterControls from '@/components/FilterControls/FilterControls';
import { Header } from '@/components/Header/Header';
import { Footer } from '@/components/Footer/Footer';
import { LoadingSkeleton } from '@/components/LoadingSkeleton/LoadingSkeleton';

function PageLoadingSkeleton() {
  return (
    <div className="min-h-screen bg-dark-950">
      <Header />
      <main className="relative pt-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <LoadingSkeleton type="section" />
          <div className="mt-8">
            <LoadingSkeleton type="section" />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

interface MoviesData {
  movies: any[];
  pagination: {
    page: number;
    totalPages: number;
    total: number;
  };
}

const fetchMovies = async (page: number, genre?: string, sort?: string) => {
  try {
    const searchParams = new URLSearchParams();
    searchParams.append('page', page.toString());
    searchParams.append('limit', '40');

    if (genre) searchParams.append('genre', genre);
    if (sort) searchParams.append('sort', sort);

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/v1/content/movies?${searchParams}`,
      {
        cache: 'no-store'
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch movies');
    }

    const data = await response.json();
    // Normalize: API returns flat {movies, total, page, limit, totalPages}
    return {
      movies: data.movies || [],
      pagination: data.pagination || {
        page: data.page || 1,
        totalPages: data.totalPages || 1,
        total: data.total || 0,
      },
    };
  } catch (error) {
    console.error('Error fetching movies:', error);
    return { movies: [], pagination: { page: 1, totalPages: 1, total: 0 } };
  }
};

const fetchCategories = async () => {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/v1/content/categories`,
      { cache: 'no-store' }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch categories');
    }

    return response.json();
  } catch (error) {
    console.error('Error fetching categories:', error);
    return [];
  }
};

function MoviesPageContent() {
  const [moviesData, setMoviesData] = useState<MoviesData>({ movies: [], pagination: { page: 1, totalPages: 1, total: 0 } });
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const searchParams = useSearchParams();

  const genre = searchParams?.get('genre') || undefined;
  const sort = searchParams?.get('sort') || 'newest';

  const loadPage = async (page: number) => {
    try {
      setLoading(true);
      const [moviesResult, categoriesResult] = await Promise.all([
        fetchMovies(page, genre, sort),
        categories.length > 0 ? Promise.resolve(categories) : fetchCategories()
      ]);
      setMoviesData(moviesResult);
      if (Array.isArray(categoriesResult)) setCategories(categoriesResult);
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPage(1);
  }, [genre, sort]);

  const totalPages = moviesData.pagination?.totalPages || 1;

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-950">
        <Header />
        <main className="relative pt-20">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <LoadingSkeleton type="section" />
            <div className="mt-8">
              <LoadingSkeleton type="section" />
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-dark-950">
        <Header />
        <main className="relative pt-20 flex items-center justify-center min-h-[calc(100vh-80px)]">
          <div className="text-center max-w-md mx-auto p-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Erro ao carregar</h2>
            <p className="text-gray-400 mb-6">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Tentar novamente
            </button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-950">
      <Header />

      <main className="relative pt-20">
        {/* Hero section */}
        <div className="relative bg-gradient-to-b from-dark-900 to-dark-950 py-20">
          <div className="absolute inset-0 bg-gradient-to-r from-red-600/10 to-transparent"></div>
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="max-w-4xl">
              <h1 className="text-4xl lg:text-6xl font-bold text-white mb-6 leading-tight">
                Filmes
              </h1>
              <p className="text-xl lg:text-2xl text-gray-300 mb-8 leading-relaxed">
                Explore nossa coleção completa de filmes em alta qualidade.
                Compre e assista online ou baixe via Telegram.
              </p>
            </div>
          </div>
        </div>

        {/* Content section */}
        <div className="relative z-10 -mt-16">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="bg-dark-900/30 backdrop-blur-sm border border-white/10 rounded-2xl p-8">
              {/* Filter Controls */}
              <div className="mb-8">
                <FilterControls
                  categories={categories}
                  currentGenre={genre}
                  currentSort={sort}
                  totalMovies={moviesData.pagination?.total || 0}
                />
              </div>

              {/* Movies Grid */}
              {moviesData.movies.length > 0 ? (
                <>
                  <MovieGrid
                    movies={moviesData.movies}
                    pagination={{
                      ...moviesData.pagination,
                      hasNext: currentPage < totalPages,
                      hasPrev: currentPage > 1
                    }}
                    currentPage={currentPage}
                  />
                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-10">
                      <button
                        onClick={() => loadPage(currentPage - 1)}
                        disabled={currentPage <= 1 || loading}
                        className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all text-sm"
                      >
                        Anterior
                      </button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(page => {
                          // Show: first, last, current, and neighbors of current
                          if (page === 1 || page === totalPages) return true;
                          if (Math.abs(page - currentPage) <= 1) return true;
                          return false;
                        })
                        .reduce<(number | string)[]>((acc, page, idx, arr) => {
                          if (idx > 0 && page - (arr[idx - 1] as number) > 1) acc.push('...');
                          acc.push(page);
                          return acc;
                        }, [])
                        .map((item, idx) =>
                          item === '...' ? (
                            <span key={`dots-${idx}`} className="px-2 text-white/30">...</span>
                          ) : (
                            <button
                              key={item}
                              onClick={() => loadPage(item as number)}
                              disabled={loading}
                              className={`min-w-[40px] h-10 rounded-lg text-sm font-medium transition-all ${
                                currentPage === item
                                  ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
                                  : 'bg-white/5 hover:bg-white/10 text-white/60 hover:text-white'
                              }`}
                            >
                              {item}
                            </button>
                          )
                        )}
                      <button
                        onClick={() => loadPage(currentPage + 1)}
                        disabled={currentPage >= totalPages || loading}
                        className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all text-sm"
                      >
                        Próxima
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-16">
                  <div className="max-w-md mx-auto">
                    <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-dark-800/50 flex items-center justify-center">
                      <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m0 0V1a1 1 0 011-1h2a1 1 0 011 1v18a1 1 0 01-1 1H4a1 1 0 01-1-1V4a1 1 0 011-1h2z" />
                      </svg>
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-4">
                      Nenhum filme encontrado
                    </h3>
                    <p className="text-gray-400 mb-8 text-lg">
                      Tente ajustar os filtros ou verificar novamente mais tarde.
                    </p>
                    <a
                      href="/movies"
                      className="inline-flex items-center px-8 py-4 bg-red-600 text-white font-medium rounded-xl hover:bg-red-700 transition-all duration-300 hover:scale-105"
                    >
                      Ver todos os filmes
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default function MoviesPage() {
  return (
    <Suspense fallback={<PageLoadingSkeleton />}>
      <MoviesPageContent />
    </Suspense>
  );
}