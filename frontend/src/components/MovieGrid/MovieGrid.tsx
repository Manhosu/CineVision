'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Movie } from '@/types/movie';
import Pagination from '@/components/Pagination/Pagination';

interface MovieGridProps {
  movies: Movie[];
  pagination?: {
    page: number;
    totalPages: number;
    total: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  currentPage?: number;
  baseUrl?: string; // Dynamic base URL for pagination
}

export default function MovieGrid({ movies, pagination, currentPage = 1, baseUrl = '/movies' }: MovieGridProps) {
  const [purchasedContentIds, setPurchasedContentIds] = useState<Set<string>>(new Set());
  const [telegramId, setTelegramId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Get Telegram ID from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedTelegramId = localStorage.getItem('telegram_user_id');
      setTelegramId(storedTelegramId);
      setLoading(false);
    }
  }, []);

  // Fetch purchased content when telegramId is available
  useEffect(() => {
    const fetchPurchasedContent = async () => {
      if (!telegramId) {
        setPurchasedContentIds(new Set());
        return;
      }

      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/v1/purchases/user/${telegramId}`,
          { cache: 'no-store' }
        );

        if (response.ok) {
          const purchases = await response.json();
          const contentIds = new Set(purchases.map((p: any) => p.content_id));
          setPurchasedContentIds(contentIds);
        } else {
          setPurchasedContentIds(new Set());
        }
      } catch (error) {
        console.error('Error fetching purchased content:', error);
        setPurchasedContentIds(new Set());
      }
    };

    if (!loading) {
      fetchPurchasedContent();
    }
  }, [telegramId, loading]);

  // Check if a movie was purchased
  const isPurchased = (movieId: string) => {
    return purchasedContentIds.has(movieId);
  };

  return (
    <div>
      {/* Movies Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 mb-8">
        {movies.map((movie) => {
          const purchased = isPurchased(movie.id);
          // Detect if content is a series
          const isSeries = (movie as any).content_type === 'series';
          const detailsPath = isSeries ? `/series/${movie.id}` : `/movies/${movie.id}`;
          const linkHref = purchased ? `/player?contentId=${movie.id}` : detailsPath;
          const buttonText = purchased ? 'Assistir' : 'Ver detalhes';
          const buttonIcon = purchased ? (
            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
            </svg>
          ) : null;

          return (
            <Link
              key={movie.id}
              href={linkHref}
              className="group relative bg-dark-800/50 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden hover:border-primary-500/30 transition-all duration-300 hover:scale-105"
            >
              <div className="aspect-[2/3] relative overflow-hidden">
                <Image
                  src={movie.poster_url || movie.thumbnail_url || '/images/placeholder-poster.svg'}
                  alt={movie.title}
                  fill
                  className="object-cover group-hover:scale-110 transition-transform duration-500"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, (max-width: 1536px) 25vw, 20vw"
                />

                {/* Overlay on hover */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                {/* Play button on hover */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="w-16 h-16 bg-primary-600/90 rounded-full flex items-center justify-center backdrop-blur-sm">
                    <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>

                {/* Quality badge */}
                <div className="absolute top-3 left-3">
                  <span className="px-2 py-1 bg-green-600/80 text-green-100 text-xs font-bold rounded">
                    HD
                  </span>
                </div>

                {/* Price or Purchased badge */}
                <div className="absolute top-3 right-3">
                  {purchased ? (
                    <span className="px-2 py-1 bg-green-600/80 text-green-100 text-xs font-bold rounded flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Adquirido
                    </span>
                  ) : movie.price_cents ? (
                    <span className="px-2 py-1 bg-primary-600/80 text-primary-100 text-xs font-bold rounded">
                      R$ {(movie.price_cents / 100).toFixed(2)}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="p-4">
                <h3 className="font-semibold text-white mb-2 line-clamp-2 group-hover:text-primary-300 transition-colors">
                  {movie.title}
                </h3>

                <div className="flex items-center justify-between text-sm text-gray-400 mb-2">
                  {movie.release_year && (
                    <span>{movie.release_year}</span>
                  )}
                  {movie.duration_minutes && (
                    <span>
                      {Math.floor(movie.duration_minutes / 60)}h {movie.duration_minutes % 60}min
                    </span>
                  )}
                </div>

                {movie.age_rating && (
                  <div className="flex items-center gap-2 mb-3">
                    <div className="border-2 border-yellow-500 text-yellow-500 px-2 py-1 rounded text-xs font-bold">
                      {movie.age_rating}
                    </div>
                    <span className="text-xs text-gray-400">Anos</span>
                  </div>
                )}

                {/* Genres */}
                {movie.genres && movie.genres.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {movie.genres.slice(0, 2).map((genre) => (
                      <span
                        key={genre}
                        className="px-2 py-1 bg-dark-700/50 text-gray-300 text-xs rounded"
                      >
                        {genre}
                      </span>
                    ))}
                    {movie.genres.length > 2 && (
                      <span className="px-2 py-1 bg-dark-700/50 text-gray-400 text-xs rounded">
                        +{movie.genres.length - 2}
                      </span>
                    )}
                  </div>
                )}

                {/* Description */}
                {movie.description && (
                  <p className="text-sm text-gray-400 line-clamp-2 mb-3">
                    {movie.description}
                  </p>
                )}

                {/* Action button */}
                <div className="mt-auto">
                  <div
                    className={`w-full px-4 py-2 ${
                      purchased
                        ? 'bg-green-600/20 border-green-600/30 text-green-400 group-hover:bg-green-600 group-hover:text-white'
                        : 'bg-primary-600/20 border-primary-600/30 text-primary-400 group-hover:bg-primary-600 group-hover:text-white'
                    } border text-sm font-medium rounded text-center transition-all duration-300 flex items-center justify-center`}
                  >
                    {buttonIcon}
                    {buttonText}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={pagination.totalPages}
          baseUrl={baseUrl}
        />
      )}
    </div>
  );
}
