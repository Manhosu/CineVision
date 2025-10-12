'use client';

import { useEffect, useState } from 'react';
import { Header } from '@/components/Header/Header';
import { HeroBanner } from '@/components/HeroBanner/HeroBanner';
import { ContentRow } from '@/components/ContentRow/ContentRow';
import { Footer } from '@/components/Footer/Footer';
import { LoadingSkeleton } from '@/components/LoadingSkeleton/LoadingSkeleton';

interface Movie {
  id: string;
  title: string;
  description: string;
  thumbnail_url: string;
  poster_url?: string;
  backdrop_url?: string;
  price_cents: number;
  imdb_rating?: number;
  release_year?: number;
  duration_minutes?: number;
  genres?: string[];
  featured?: boolean;
  status: string;
  availability?: 'SITE' | 'TELEGRAM' | 'BOTH';
  price?: number; // Para compatibilidade com HeroBanner
  vote_average?: number; // Para compatibilidade com HeroBanner
  runtime?: number; // Para compatibilidade com HeroBanner
  release_date?: string; // Para compatibilidade com HeroBanner
  overview?: string; // Para compatibilidade com HeroBanner
}

interface ContentSection {
  title: string;
  movies: Movie[];
  type: 'featured' | 'latest' | 'popular' | 'top10';
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function HomePage() {
  const [isLoading, setIsLoading] = useState(true);
  const [heroMovies, setHeroMovies] = useState<Movie[]>([]);
  const [contentSections, setContentSections] = useState<ContentSection[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadContent() {
      try {
        setIsLoading(true);

        // Fetch real data from API
        const [featuredRes, top10Res, latestRes, popularRes] = await Promise.all([
          fetch(`${API_URL}/api/v1/content/movies?limit=5&sort=newest`, { cache: 'no-store' }),
          fetch(`${API_URL}/api/v1/content/top10/films`, { cache: 'no-store' }),
          fetch(`${API_URL}/api/v1/content/movies?limit=10&sort=newest`, { cache: 'no-store' }),
          fetch(`${API_URL}/api/v1/content/movies?limit=10&sort=popular`, { cache: 'no-store' })
        ]);

        if (!featuredRes.ok || !top10Res.ok || !latestRes.ok || !popularRes.ok) {
          throw new Error('Erro ao carregar dados da API');
        }

        const featuredData = await featuredRes.json();
        const top10Films = await top10Res.json();
        const latestData = await latestRes.json();
        const popularData = await popularRes.json();

        // Use featured movies or latest for hero banner
        const featuredMovies = featuredData.movies?.filter((m: Movie) => m.featured) || [];
        const heroMoviesData = (featuredMovies.length > 0
          ? featuredMovies.slice(0, 3)
          : (featuredData.movies || []).slice(0, 3)) as Movie[];
        setHeroMovies(heroMoviesData);

        // Organize content sections with real data
        const sections: ContentSection[] = [
          {
            title: 'Top 10 Filmes da Semana',
            type: 'top10' as const,
            movies: Array.isArray(top10Films) ? top10Films : []
          },
          {
            title: 'Lançamentos',
            type: 'latest' as const,
            movies: latestData.movies || []
          },
          {
            title: 'Mais Assistidos',
            type: 'popular' as const,
            movies: popularData.movies || []
          }
        ].filter(section => section.movies.length > 0);

        setContentSections(sections);
        setError(null);
      } catch (err) {
        console.error('Erro ao carregar conteúdo:', err);
        setError('Erro ao carregar o conteúdo. Tente novamente mais tarde.');
      } finally {
        setIsLoading(false);
      }
    }

    loadContent();
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-950">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-500 mb-4">Ops! Algo deu errado</h2>
          <p className="text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="btn-primary"
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-950">
      {/* Header fixo */}
      <Header />

      {/* Conteúdo principal */}
      <main className="relative">
        {/* Banner Hero */}
        {isLoading ? (
          <LoadingSkeleton type="hero" />
        ) : (
          <HeroBanner movies={heroMovies} />
        )}

        {/* Seções de conteúdo */}
        <div className="relative z-10 -mt-32 space-y-12 pb-20">
          {isLoading ? (
            // Skeleton das seções
            <>
              <LoadingSkeleton type="section" />
              <LoadingSkeleton type="section" />
              <LoadingSkeleton type="section" />
            </>
          ) : contentSections.length > 0 ? (
            contentSections.map((section, index) => (
              <ContentRow
                key={section.type}
                title={section.title}
                movies={section.movies}
                priority={index === 0} // Primeira seção tem prioridade para otimização
              />
            ))
          ) : (
            <div className="container mx-auto px-4 lg:px-6 text-center py-20">
              <h2 className="text-2xl font-bold text-gray-400 mb-4">
                Nenhum conteúdo disponível
              </h2>
              <p className="text-gray-500">
                Novos filmes serão adicionados em breve!
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Rodapé */}
      <Footer />
    </div>
  );
}
