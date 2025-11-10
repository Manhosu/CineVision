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

interface SeriesData {
  movies: any[];
  pagination: {
    page: number;
    totalPages: number;
    total: number;
  };
}

const fetchSeries = async (page: number, genre?: string, sort?: string) => {
  try {
    const searchParams = new URLSearchParams();
    searchParams.append('page', page.toString());
    searchParams.append('limit', '20');

    if (genre) searchParams.append('genre', genre);
    if (sort) searchParams.append('sort', sort);

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/v1/content/series?${searchParams}`,
      {
        cache: 'no-store'
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch series');
    }

    return response.json();
  } catch (error) {
    console.error('Error fetching series:', error);
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

function SeriesPageContent() {
  const [seriesData, setSeriesData] = useState<SeriesData>({ movies: [], pagination: { page: 1, totalPages: 1, total: 0 } });
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();

  const page = parseInt(searchParams?.get('page') || '1');
  const genre = searchParams?.get('genre') || undefined;
  const sort = searchParams?.get('sort') || 'newest';

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [seriesResult, categoriesResult] = await Promise.all([
          fetchSeries(page, genre, sort),
          fetchCategories()
        ]);

        // Ensure seriesResult has correct structure
        const validSeriesData = {
          movies: seriesResult?.movies || [],
          pagination: seriesResult?.pagination || { page: 1, totalPages: 1, total: 0 }
        };

        setSeriesData(validSeriesData);
        setCategories(categoriesResult || []);
      } catch (err) {
        console.error('[SeriesPage] Error loading data:', err);
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
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-transparent"></div>
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="max-w-4xl">
              <h1 className="text-4xl lg:text-6xl font-bold text-white mb-6 leading-tight">
                Séries
              </h1>
              <p className="text-xl lg:text-2xl text-gray-300 mb-8 leading-relaxed">
                Explore nossa coleção completa de séries.
                {genre && (
                  <span className="block mt-2 text-blue-400">
                    Filtrando por: {genre}
                  </span>
                )}
              </p>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18 3v2h-2V3H8v2H6V3H4v18h2v-2h2v2h8v-2h2v2h2V3h-2zM8 17H6v-2h2v2zm0-4H6v-2h2v2zm0-4H6V7h2v2zm10 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V7h2v2z"/>
                </svg>
                <span>{seriesData.pagination?.total || 0} {(seriesData.pagination?.total || 0) === 1 ? 'série' : 'séries'} disponíveis</span>
              </div>
            </div>
          </div>
        </div>

        {/* Content section */}
        <div className="relative z-10 -mt-16">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="bg-dark-900/30 backdrop-blur-sm border border-white/10 rounded-2xl p-8">

              {/* Filters */}
              <FilterControls
                categories={categories}
                currentGenre={genre}
                currentSort={sort}
              />

              {/* Series Grid */}
              <MovieGrid
                movies={seriesData.movies || []}
                pagination={seriesData.pagination || { page: 1, totalPages: 1, total: 0 }}
                currentPage={page}
                baseUrl="/series"
              />
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default function SeriesPage() {
  return (
    <Suspense fallback={<PageLoadingSkeleton />}>
      <SeriesPageContent />
    </Suspense>
  );
}
