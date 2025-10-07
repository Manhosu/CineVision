'use client';

interface LoadingSkeletonProps {
  type: 'hero' | 'section' | 'card' | 'grid' | 'header';
  count?: number;
}

export function LoadingSkeleton({ type, count = 1 }: LoadingSkeletonProps) {

  if (type === 'hero') {
    return (
      <div className="relative h-[70vh] md:h-[80vh] overflow-hidden bg-dark-950">
        {/* Background skeleton */}
        <div className="absolute inset-0 loading-shimmer" />

        {/* Content skeleton */}
        <div className="relative z-10 h-full flex items-center">
          <div className="container mx-auto px-4 lg:px-6">
            <div className="max-w-2xl space-y-6">
              {/* Title skeleton */}
              <div className="space-y-3">
                <div className="h-12 md:h-16 bg-dark-800 rounded loading-shimmer w-3/4" />
                <div className="h-12 md:h-16 bg-dark-800 rounded loading-shimmer w-1/2" />
              </div>

              {/* Movie info skeleton */}
              <div className="flex space-x-6">
                <div className="h-4 bg-dark-800 rounded loading-shimmer w-16" />
                <div className="h-4 bg-dark-800 rounded loading-shimmer w-12" />
                <div className="h-4 bg-dark-800 rounded loading-shimmer w-14" />
              </div>

              {/* Genres skeleton */}
              <div className="flex space-x-2">
                <div className="h-6 bg-dark-800 rounded-full loading-shimmer w-16" />
                <div className="h-6 bg-dark-800 rounded-full loading-shimmer w-20" />
                <div className="h-6 bg-dark-800 rounded-full loading-shimmer w-14" />
              </div>

              {/* Description skeleton */}
              <div className="space-y-2">
                <div className="h-4 bg-dark-800 rounded loading-shimmer w-full" />
                <div className="h-4 bg-dark-800 rounded loading-shimmer w-4/5" />
                <div className="h-4 bg-dark-800 rounded loading-shimmer w-3/5" />
              </div>

              {/* Price skeleton */}
              <div className="h-8 bg-dark-800 rounded loading-shimmer w-24" />

              {/* Buttons skeleton */}
              <div className="flex space-x-4">
                <div className="h-12 bg-dark-800 rounded-lg loading-shimmer w-36" />
                <div className="h-12 bg-dark-800 rounded-lg loading-shimmer w-40" />
              </div>
            </div>
          </div>
        </div>

        {/* Navigation dots skeleton */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex space-x-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="w-3 h-3 bg-dark-800 rounded-full loading-shimmer" />
          ))}
        </div>
      </div>
    );
  }

  if (type === 'section') {
    return (
      <section className="py-8">
        <div className="container mx-auto px-4 lg:px-6">
          {/* Section title skeleton */}
          <div className="mb-6">
            <div className="h-8 bg-dark-800 rounded loading-shimmer w-48" />
          </div>

          {/* Cards row skeleton */}
          <div className="flex space-x-4 overflow-hidden">
            {[...Array(6)].map((_, index) => (
              <div key={index} className="flex-none w-64 md:w-72">
                <LoadingSkeleton type="card" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (type === 'card') {
    return (
      <div className="card rounded-xl overflow-hidden">
        {/* Image skeleton */}
        <div className="aspect-[2/3] bg-dark-800 loading-shimmer relative">
          {/* Badges skeleton */}
          <div className="absolute top-2 left-2 h-5 bg-dark-700 rounded-full loading-shimmer w-12" />
          <div className="absolute top-2 right-2 h-5 bg-dark-700 rounded-full loading-shimmer w-16" />
        </div>

        {/* Content skeleton */}
        <div className="p-4 space-y-3">
          {/* Title skeleton */}
          <div className="h-5 bg-dark-800 rounded loading-shimmer w-3/4" />

          {/* Price skeleton */}
          <div className="h-6 bg-dark-800 rounded loading-shimmer w-20" />

          {/* Additional info skeleton */}
          <div className="space-y-2">
            <div className="flex space-x-2">
              <div className="h-4 bg-dark-800 rounded-full loading-shimmer w-12" />
              <div className="h-4 bg-dark-800 rounded-full loading-shimmer w-16" />
            </div>
            <div className="flex justify-between items-center">
              <div className="h-3 bg-dark-800 rounded loading-shimmer w-16" />
              <div className="h-3 bg-dark-800 rounded loading-shimmer w-10" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (type === 'grid') {
    return (
      <div className="movies-grid">
        {[...Array(count)].map((_, index) => (
          <LoadingSkeleton key={index} type="card" />
        ))}
      </div>
    );
  }

  if (type === 'header') {
    return (
      <header className="bg-dark-900 border-b border-white/10">
        <div className="container mx-auto px-4 lg:px-6">
          <div className="flex items-center justify-between h-16 lg:h-20">
            {/* Logo skeleton */}
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-dark-800 rounded loading-shimmer" />
              <div className="h-6 bg-dark-800 rounded loading-shimmer w-24" />
            </div>

            {/* Navigation skeleton */}
            <div className="hidden md:flex space-x-8">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-4 bg-dark-800 rounded loading-shimmer w-16" />
              ))}
            </div>

            {/* Actions skeleton */}
            <div className="flex items-center space-x-4">
              {/* Search skeleton */}
              <div className="hidden lg:block h-10 bg-dark-800 rounded-lg loading-shimmer w-64" />

              {/* Button skeleton */}
              <div className="h-10 bg-dark-800 rounded-lg loading-shimmer w-20" />

              {/* Menu button skeleton (mobile) */}
              <div className="md:hidden w-6 h-6 bg-dark-800 rounded loading-shimmer" />
            </div>
          </div>
        </div>
      </header>
    );
  }

  // Default skeleton
  return (
    <div className="space-y-3">
      <div className="h-4 bg-dark-800 rounded loading-shimmer w-3/4" />
      <div className="h-4 bg-dark-800 rounded loading-shimmer w-1/2" />
      <div className="h-4 bg-dark-800 rounded loading-shimmer w-2/3" />
    </div>
  );
}

// Componente específico para skeleton de lista de filmes
export function MovieListSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="space-y-12">
      {/* Hero skeleton */}
      <LoadingSkeleton type="hero" />

      {/* Sections skeleton */}
      <LoadingSkeleton type="section" />
      <LoadingSkeleton type="section" />
      <LoadingSkeleton type="section" />
    </div>
  );
}

// Componente específico para skeleton de busca
export function SearchSkeleton({ count = 20 }: { count?: number }) {
  return (
    <div className="space-y-8">
      {/* Search header skeleton */}
      <div className="space-y-4">
        <div className="h-8 bg-dark-800 rounded loading-shimmer w-64" />
        <div className="h-4 bg-dark-800 rounded loading-shimmer w-32" />
      </div>

      {/* Filters skeleton */}
      <div className="flex space-x-4">
        <div className="h-10 bg-dark-800 rounded-lg loading-shimmer w-24" />
        <div className="h-10 bg-dark-800 rounded-lg loading-shimmer w-32" />
        <div className="h-10 bg-dark-800 rounded-lg loading-shimmer w-28" />
      </div>

      {/* Results grid skeleton */}
      <LoadingSkeleton type="grid" count={count} />
    </div>
  );
}

// Componente específico para skeleton de detalhes do filme
export function MovieDetailsSkeleton() {
  return (
    <div className="space-y-8">
      {/* Hero section skeleton */}
      <div className="relative h-96 bg-dark-800 loading-shimmer rounded-xl">
        <div className="absolute bottom-6 left-6 right-6 space-y-4">
          <div className="h-10 bg-dark-700 rounded loading-shimmer w-1/2" />
          <div className="h-4 bg-dark-700 rounded loading-shimmer w-1/3" />
          <div className="flex space-x-4">
            <div className="h-12 bg-dark-700 rounded-lg loading-shimmer w-32" />
            <div className="h-12 bg-dark-700 rounded-lg loading-shimmer w-28" />
          </div>
        </div>
      </div>

      {/* Details section skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-6">
          {/* Description */}
          <div className="space-y-3">
            <div className="h-6 bg-dark-800 rounded loading-shimmer w-32" />
            <div className="space-y-2">
              <div className="h-4 bg-dark-800 rounded loading-shimmer w-full" />
              <div className="h-4 bg-dark-800 rounded loading-shimmer w-4/5" />
              <div className="h-4 bg-dark-800 rounded loading-shimmer w-3/5" />
            </div>
          </div>

          {/* Cast */}
          <div className="space-y-3">
            <div className="h-6 bg-dark-800 rounded loading-shimmer w-20" />
            <div className="flex space-x-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="text-center space-y-2">
                  <div className="w-16 h-16 bg-dark-800 rounded-full loading-shimmer" />
                  <div className="h-3 bg-dark-800 rounded loading-shimmer w-12" />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Movie info */}
          <div className="space-y-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex justify-between">
                <div className="h-4 bg-dark-800 rounded loading-shimmer w-20" />
                <div className="h-4 bg-dark-800 rounded loading-shimmer w-24" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}