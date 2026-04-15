'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { PlayIcon } from '@heroicons/react/24/solid';
import { toast } from 'react-hot-toast';
import ContentHero from '@/components/ContentHero/ContentHero';
import CastSection from '@/components/CastSection/CastSection';
import TrailerSection from '@/components/TrailerSection/TrailerSection';
import { Movie } from '@/types/movie';

interface Episode {
  id: string;
  season_number: number;
  episode_number: number;
  title: string;
  description: string;
  thumbnail_url?: string;
  duration_minutes: number;
}

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
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [selectedSeason, setSelectedSeason] = useState(1);
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

        // Episodes
        try {
          const epRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/content/series/${seriesId}/episodes`, { credentials: 'include' });
          if (epRes.ok) { const d = await epRes.json(); setEpisodes(Array.isArray(d) ? d : []); }
        } catch { setEpisodes([]); }
      } catch (err: any) {
        setError(err.message || 'Erro ao carregar série');
      } finally { setLoading(false); }
    };
    fetchData();
  }, [seriesId, router]);

  const handleEpisodePlay = (episode: Episode) => {
    if (!isOwned) { toast.error('Você precisa comprar a série para assistir', { duration: 4000 }); return; }
    if (!series?.telegram_group_link) { toast.error('Conteúdo indisponível no momento'); return; }
    window.open(series.telegram_group_link, '_blank');
  };

  const handlePlay = () => {
    if (episodes.length > 0) handleEpisodePlay(episodes[0]);
    else toast.error('Nenhum episódio disponível');
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

  const seasonsEpisodes = episodes.filter(ep => ep.season_number === selectedSeason);
  const seasons = Array.from({ length: series.total_seasons || 1 }, (_, i) => i + 1);
  const castString = Array.isArray(series.cast) ? series.cast.join(', ') : series.cast;

  return (
    <main className="bg-dark-950">
      {/* Hero */}
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

      {/* Cast */}
      <CastSection cast={castString} director={series.director} />

      {/* Trailer */}
      {series.trailer_url && (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-10 tv:px-16 pb-10 tv:pb-14">
          <TrailerSection movie={series as any} />
        </div>
      )}

      {/* Episodes */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-10 tv:px-16 pb-10 tv:pb-14">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl sm:text-2xl tv:text-3xl font-bold text-white">Episódios</h2>
          {(series.total_seasons || 1) > 1 && (
            <select
              value={selectedSeason}
              onChange={(e) => setSelectedSeason(parseInt(e.target.value))}
              className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 appearance-none cursor-pointer"
            >
              {seasons.map(s => (
                <option key={s} value={s} className="bg-dark-900">Temporada {s}</option>
              ))}
            </select>
          )}
        </div>

        {/* Episode list */}
        {seasonsEpisodes.length > 0 ? (
          <div className="space-y-2">
            {seasonsEpisodes.map((ep, i) => (
              <div
                key={ep.id}
                onClick={() => handleEpisodePlay(ep)}
                className="flex items-center gap-4 p-3 sm:p-4 rounded-xl hover:bg-white/5 transition-colors cursor-pointer group"
              >
                {/* Episode number */}
                <span className="text-white/20 font-bold text-lg sm:text-xl w-8 text-center flex-shrink-0">
                  {ep.episode_number}
                </span>

                {/* Thumbnail */}
                <div className="relative w-24 sm:w-32 h-14 sm:h-18 flex-shrink-0 rounded-lg overflow-hidden bg-white/5">
                  {ep.thumbnail_url ? (
                    <img src={ep.thumbnail_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <PlayIcon className="w-6 h-6 text-white/20" />
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                    <PlayIcon className="w-8 h-8 text-white" />
                  </div>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-white text-sm sm:text-base font-medium truncate group-hover:text-primary-400 transition-colors">
                    {ep.title}
                  </h3>
                  {ep.description && (
                    <p className="text-white/40 text-xs sm:text-sm line-clamp-1 mt-0.5">{ep.description}</p>
                  )}
                </div>

                {/* Duration */}
                {ep.duration_minutes > 0 && (
                  <span className="text-white/30 text-xs sm:text-sm flex-shrink-0">{ep.duration_minutes}min</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-white/30 text-base">Nenhum episódio disponível para a Temporada {selectedSeason}</p>
          </div>
        )}
      </div>
    </main>
  );
}
