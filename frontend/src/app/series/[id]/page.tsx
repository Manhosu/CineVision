'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import ContentHero from '@/components/ContentHero/ContentHero';
import CastSection from '@/components/CastSection/CastSection';
import TrailerSection from '@/components/TrailerSection/TrailerSection';
import { Movie } from '@/types/movie';

interface Series extends Movie {
  synopsis?: string;
  total_seasons?: number;
  total_episodes?: number;
  content_type?: string;
}

export default function SeriesDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const seriesId = params?.id as string;

  const [series, setSeries] = useState<Series | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOwned, setIsOwned] = useState(false);
  const [checkingOwnership, setCheckingOwnership] = useState(true);

  const normalizeToArray = (value: string | string[] | undefined): string[] => {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return value.split(',').map(s => s.trim()).filter(Boolean);
    }
    return [];
  };

  useEffect(() => {
    if (!seriesId) return;
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/content/series/${seriesId}`);
        if (!res.ok) throw new Error('Série não encontrada');
        const data = await res.json();

        if (data.content_type !== 'series') { router.push(`/movies/${seriesId}`); return; }

        data.cast = normalizeToArray(data.cast);
        data.genres = normalizeToArray(data.genres);
        setSeries(data);

        // Ownership
        try {
          const owRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/purchases/check/${seriesId}`, { credentials: 'include' });
          if (owRes.ok) { const d = await owRes.json(); setIsOwned(d.isOwned || false); }
        } catch { /* ignore */ } finally { setCheckingOwnership(false); }
      } catch (err: any) {
        setError(err.message || 'Erro ao carregar série');
      } finally { setLoading(false); }
    };
    fetchData();
  }, [seriesId, router]);

  const handlePlay = () => {
    if (!series?.telegram_group_link) { toast.error('Conteúdo indisponível no momento'); return; }
    window.open(series.telegram_group_link, '_blank');
  };

  const handlePurchase = () => {
    const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'cinevisionv2bot';
    window.open(`https://t.me/${botUsername}?start=buy_${seriesId}`, '_blank');
    toast.success('Abrindo Telegram...', { duration: 2000 });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  if (error || !series) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-3">Série não encontrada</h2>
          <p className="text-white/50 mb-6">{error}</p>
          <Link href="/series" className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl transition-colors font-medium">
            Voltar para Séries
          </Link>
        </div>
      </div>
    );
  }

  const castString = Array.isArray(series.cast) ? series.cast.join(', ') : series.cast;

  return (
    <main className="bg-dark-950">
      <ContentHero
        content={series}
        backHref="/series"
        backLabel="Séries"
        contentType="series"
        isOwned={isOwned}
        checkingOwnership={checkingOwnership}
        onPlay={handlePlay}
        onPurchase={handlePurchase}
      />

      <CastSection cast={castString} director={series.director} />

      {series.trailer_url && (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-10 tv:px-16 pb-10 tv:pb-14">
          <TrailerSection movie={series as any} />
        </div>
      )}
    </main>
  );
}
