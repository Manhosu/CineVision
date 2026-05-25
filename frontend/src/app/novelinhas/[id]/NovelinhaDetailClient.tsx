'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import ContentHero from '@/components/ContentHero/ContentHero';
import CastSection from '@/components/CastSection/CastSection';
import TrailerSection from '@/components/TrailerSection/TrailerSection';
import BusinessLinkCapture from '@/components/BusinessLinkCapture/BusinessLinkCapture';
import { openContentGroup } from '@/lib/telegramAccess';
import { Movie } from '@/types/movie';

interface Novelinha extends Movie {
  synopsis?: string;
  total_seasons?: number;
  total_episodes?: number;
  content_type?: string;
}

export default function NovelinhaDetailClient() {
  const params = useParams();
  const novelinhaId = params?.id as string;

  const [novelinha, setNovelinha] = useState<Novelinha | null>(null);
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
      return value.split(',').map((s) => s.trim()).filter(Boolean);
    }
    return [];
  };

  useEffect(() => {
    if (!novelinhaId) return;
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/content/novelinhas/${novelinhaId}`);
        if (!res.ok) throw new Error('Novelinha não encontrada');
        const data = await res.json();

        data.cast = normalizeToArray(data.cast);
        data.genres = normalizeToArray(data.genres);
        setNovelinha(data);

        // Ownership
        try {
          const owRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/purchases/check/${novelinhaId}`, { credentials: 'include' });
          if (owRes.ok) { const d = await owRes.json(); setIsOwned(d.isOwned || false); }
        } catch { /* ignore */ } finally { setCheckingOwnership(false); }
      } catch (err: any) {
        setError(err.message || 'Erro ao carregar novelinha');
      } finally { setLoading(false); }
    };
    fetchData();
  }, [novelinhaId]);

  const handlePlay = async () => {
    if (!novelinha) return;
    await openContentGroup(novelinha.id, novelinha.telegram_group_link);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  if (error || !novelinha) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-3">Novelinha não encontrada</h2>
          <p className="text-white/50 mb-6">{error}</p>
          <Link href="/novelinhas" className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl transition-colors font-medium">
            Voltar para Novelinhas
          </Link>
        </div>
      </div>
    );
  }

  const castString = Array.isArray(novelinha.cast) ? novelinha.cast.join(', ') : novelinha.cast;

  return (
    <main className="bg-dark-950">
      {/* Captura ?via=business&bid=...&chat=... pro fluxo de IA Business DM. */}
      <BusinessLinkCapture />

      <ContentHero
        content={novelinha}
        backHref="/novelinhas"
        backLabel="Novelinhas"
        contentType="series"
        isOwned={isOwned}
        checkingOwnership={checkingOwnership}
        onPlay={handlePlay}
      />

      <CastSection
        cast={castString}
        director={novelinha.director}
        people={(novelinha as any).content_people?.map((cp: any) => cp.person).filter(Boolean)}
      />

      {novelinha.trailer_url && (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-10 tv:px-16 pb-10 tv:pb-14">
          <TrailerSection movie={novelinha as any} />
        </div>
      )}
    </main>
  );
}
