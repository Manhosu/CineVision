'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Category } from '@/types/category';

interface FilterControlsProps {
  categories: Category[];
  currentGenre?: string;
  currentSort?: string;
  totalMovies: number;
}

export default function FilterControls({
  categories,
  currentGenre,
  currentSort,
  totalMovies
}: FilterControlsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleFilterChange = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams?.toString());

    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }

    // Reset to page 1 when filters change
    params.delete('page');

    const queryString = params.toString();
    const newUrl = queryString ? `/movies?${queryString}` : '/movies';

    router.push(newUrl);
  };

  const clearFilters = () => {
    router.push('/movies');
  };

  const sortOptions = [
    { value: 'newest', label: 'Mais recentes' },
    { value: 'popular', label: 'Mais populares' },
    { value: 'rating', label: 'Melhor avaliados' },
    { value: 'price_low', label: 'Menor preço' },
    { value: 'price_high', label: 'Maior preço' },
  ];

  return (
    <div className="bg-dark-800/50 backdrop-blur-sm border border-white/10 rounded-xl p-6 mb-8">
      <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-center justify-between">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 flex-1">
          {/* Genre Filter */}
          <div className="min-w-0 flex-1">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Gênero
            </label>
            <select
              value={currentGenre || ''}
              onChange={(e) => handleFilterChange('genre', e.target.value)}
              className="w-full px-4 py-2 bg-dark-700 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">Todos os gêneros</option>
              {categories.map((category) => (
                <option key={category.id} value={category.name}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          {/* Sort Filter */}
          <div className="min-w-0 flex-1">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Ordenar por
            </label>
            <select
              value={currentSort || 'newest'}
              onChange={(e) => handleFilterChange('sort', e.target.value)}
              className="w-full px-4 py-2 bg-dark-700 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Results Count & Clear Filters */}
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-400">
            {totalMovies} {totalMovies === 1 ? 'filme encontrado' : 'filmes encontrados'}
          </div>

          {(currentGenre || currentSort !== 'newest') && (
            <button
              onClick={clearFilters}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-white/10 rounded-lg hover:border-white/20 transition-colors"
            >
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      {/* Active Filters */}
      {(currentGenre || currentSort !== 'newest') && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <div className="flex flex-wrap gap-2">
            <span className="text-sm text-gray-400">Filtros ativos:</span>

            {currentGenre && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-primary-600/20 border border-primary-600/30 text-primary-400 text-sm rounded-full">
                {currentGenre}
                <button
                  onClick={() => handleFilterChange('genre', '')}
                  className="ml-1 hover:text-primary-300 transition-colors"
                >
                  ×
                </button>
              </span>
            )}

            {currentSort && currentSort !== 'newest' && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600/20 border border-blue-600/30 text-blue-400 text-sm rounded-full">
                {sortOptions.find(opt => opt.value === currentSort)?.label}
                <button
                  onClick={() => handleFilterChange('sort', 'newest')}
                  className="ml-1 hover:text-blue-300 transition-colors"
                >
                  ×
                </button>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}