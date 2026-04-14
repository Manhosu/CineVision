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

              {/* Minimal info below */}
              <div className="pt-1.5 px-0.5 flex items-center justify-between">
                <span className="text-[10px] text-gray-500">{movie.release_year || ''}</span>
                {purchased ? (
                  <span className="text-[10px] text-emerald-400 font-semibold">Adquirido</span>
                ) : movie.discounted_price_cents && movie.discounted_price_cents < movie.price_cents ? (
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-gray-500 line-through">{formatPrice(movie.price_cents)}</span>
                    <span className="text-[11px] text-green-400 font-bold">{formatPrice(movie.discounted_price_cents)}</span>
                  </div>
                ) : (
                  <span className="text-[11px] text-white/60 font-medium">{formatPrice(movie.price_cents)}</span>
                )}
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
