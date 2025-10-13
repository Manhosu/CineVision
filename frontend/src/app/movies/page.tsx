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
    searchParams.append('limit', '20');

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

    return response.json();
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
  const searchParams = useSearchParams();

  const page = parseInt(searchParams.get('page') || '1');
  const genre = searchParams.get('genre') || undefined;
  const sort = searchParams.get('sort') || 'newest';

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [moviesResult, categoriesResult] = await Promise.all([
          fetchMovies(page, genre, sort),
          fetchCategories()
        ]);
        setMoviesData(moviesResult);
        setCategories(categoriesResult);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [page, genre, sort]);

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
                <MovieGrid
                  movies={moviesData.movies}
                  pagination={{
                    ...moviesData.pagination,
                    hasNext: page < (moviesData.pagination?.totalPages || 0),
                    hasPrev: page > 1
                  }}
                  currentPage={page}
                />
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