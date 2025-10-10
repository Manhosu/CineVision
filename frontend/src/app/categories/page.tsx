'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Category } from '@/types/category';
import { Header } from '@/components/Header/Header';
import { Footer } from '@/components/Footer/Footer';
import { LoadingSkeleton } from '@/components/LoadingSkeleton/LoadingSkeleton';

interface CategoryWithCount extends Category {
  movieCount: number;
}

const fetchCategories = async (): Promise<Category[]> => {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/content/categories`,
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

const fetchCategoryMovieCount = async (categoryName: string): Promise<number> => {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/content/movies?genre=${categoryName}&limit=1`,
      { cache: 'no-store' }
    );

    if (!response.ok) {
      return 0;
    }

    const data = await response.json();
    return data.total || 0;
  } catch (error) {
    return 0;
  }
};

export default function CategoriesPage() {
  const [categoriesWithCount, setCategoriesWithCount] = useState<CategoryWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const categories = await fetchCategories();

        // Get movie count for each category
        const categoriesWithCounts = await Promise.all(
          categories.map(async (category) => ({
            ...category,
            movieCount: await fetchCategoryMovieCount(category.name)
          }))
        );

        setCategoriesWithCount(categoriesWithCounts);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

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
                Categorias
              </h1>
              <p className="text-xl lg:text-2xl text-gray-300 mb-8 leading-relaxed">
                Explore nossa coleção organizada por gêneros.
                Encontre seus filmes favoritos de forma rápida e fácil.
              </p>
            </div>
          </div>
        </div>

        {/* Content section */}
        <div className="relative z-10 -mt-16">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="bg-dark-900/30 backdrop-blur-sm border border-white/10 rounded-2xl p-8">

              {/* Categories Grid */}
              {categoriesWithCount.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {categoriesWithCount.map((category) => (
                    <Link
                      key={category.id}
                      href={`/movies?genre=${encodeURIComponent(category.name)}`}
                      className="group relative bg-dark-800/50 backdrop-blur-sm border border-white/10 rounded-xl p-6 hover:bg-dark-800/70 hover:border-red-500/30 transition-all duration-300 hover:scale-105"
                    >
                      <div className="aspect-square bg-gradient-to-br from-red-600/20 to-red-800/20 rounded-lg mb-4 flex items-center justify-center group-hover:from-red-600/30 group-hover:to-red-800/30 transition-all duration-300">
                        <div className="w-12 h-12 text-red-400 group-hover:text-red-300 transition-colors">
                          <svg fill="currentColor" viewBox="0 0 24 24">
                            <path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/>
                          </svg>
                        </div>
                      </div>

                      <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-red-300 transition-colors">
                        {category.name}
                      </h3>

                      {category.description && (
                        <p className="text-sm text-gray-400 mb-3 line-clamp-2">
                          {category.description}
                        </p>
                      )}

                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">
                          {category.movieCount} {category.movieCount === 1 ? 'filme' : 'filmes'}
                        </span>
                        <span className="text-red-400 group-hover:text-red-300 transition-colors">
                          Ver filmes →
                        </span>
                      </div>

                      {/* Hover effect overlay */}
                      <div className="absolute inset-0 bg-gradient-to-r from-red-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl pointer-events-none" />
                    </Link>
                  ))}
                </div>
              ) : (
                /* Empty State */
                <div className="text-center py-16">
                  <div className="max-w-md mx-auto">
                    <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-dark-800/50 flex items-center justify-center">
                      <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-4">
                      Nenhuma categoria encontrada
                    </h3>
                    <p className="text-gray-400 mb-8 text-lg">
                      As categorias ainda estão sendo configuradas. Volte em breve!
                    </p>
                    <Link
                      href="/movies"
                      className="inline-flex items-center px-8 py-4 bg-red-600 text-white font-medium rounded-xl hover:bg-red-700 transition-all duration-300 hover:scale-105"
                    >
                      Ver todos os filmes
                    </Link>
                  </div>
                </div>
              )}

              {/* Popular Categories Section */}
              {categoriesWithCount.length > 0 && (
                <div className="mt-12">
                  <h2 className="text-2xl font-bold text-white mb-6">
                    Categorias Populares
                  </h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {categoriesWithCount
                      .sort((a, b) => b.movieCount - a.movieCount)
                      .slice(0, 6)
                      .map((category) => (
                        <Link
                          key={`popular-${category.id}`}
                          href={`/movies?genre=${encodeURIComponent(category.name)}&sort=popular`}
                          className="group p-4 bg-dark-800/30 border border-white/5 rounded-lg hover:bg-dark-800/50 hover:border-red-500/20 transition-all duration-300 text-center hover:scale-105"
                        >
                          <h4 className="font-medium text-white group-hover:text-red-300 transition-colors">
                            {category.name}
                          </h4>
                          <p className="text-xs text-gray-400 mt-1">
                            {category.movieCount} filmes
                          </p>
                        </Link>
                      ))}
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