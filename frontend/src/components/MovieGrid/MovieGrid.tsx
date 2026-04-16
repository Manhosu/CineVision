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
      {/* Movies Grid - Clean poster design */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 mb-8">
        {movies.map((movie) => {
          const purchased = isPurchased(movie.id);
          const isSeries = (movie as any).content_type === 'series';
          const detailsPath = isSeries ? `/series/${movie.id}` : `/movies/${movie.id}`;

          const formatPrice = (cents: number) =>
            new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);

          return (
            <Link
              key={movie.id}
              href={detailsPath}
              className="group relative transition-all duration-300 hover:scale-[1.03]"
            >
              {/* Poster - 100% clean */}
              <div className="aspect-[2/3] relative overflow-hidden rounded-xl">
                <Image
                  src={movie.poster_url || movie.thumbnail_url || '/images/placeholder-poster.svg'}
                  alt={movie.title}
                  fill
                  className="object-cover group-hover:scale-105 group-hover:brightness-110 transition-all duration-500"
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 20vw"
                />
              </div>

              {/* Info + Price below poster */}
              <div className="pt-2 px-0.5">
                <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
                  {movie.release_year && <span>{movie.release_year}</span>}
                  {isSeries && (
                    <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded text-[10px] font-medium">Série</span>
                  )}
                </div>

                <div className="w-full flex items-center justify-center gap-2 bg-white/10 text-white font-semibold py-2 px-3 rounded-lg border border-white/10">
                  {purchased ? (
                    <span className="text-xs text-emerald-400">Adquirido</span>
                  ) : movie.discounted_price_cents && movie.discounted_price_cents < movie.price_cents ? (
                    <span className="text-xs flex items-center gap-1.5">
                      <span className="line-through text-gray-500">{formatPrice(movie.price_cents)}</span>
                      <span className="text-green-400 font-bold">{formatPrice(movie.discounted_price_cents)}</span>
                    </span>
                  ) : (
                    <span className="text-xs">{formatPrice(movie.price_cents)}</span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Pagination is handled by parent page */}
    </div>
  );
}
