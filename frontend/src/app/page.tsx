'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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

// Component that uses useSearchParams - must be wrapped in Suspense
function AutoLoginHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams?.get('token');
    const redirect = searchParams?.get('redirect') || '/';

    if (token) {
      // Redirect to auto-login page with token
      router.push(`/auth/auto-login?token=${token}&redirect=${redirect}`);
    }
  }, [searchParams, router]);

  return null;
}

function HomePageContent() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [heroMovies, setHeroMovies] = useState<Movie[]>([]);
  const [contentSections, setContentSections] = useState<ContentSection[]>([]);
  const [purchasedMovies, setPurchasedMovies] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadContent() {
      try {
        setIsLoading(true);

        // Get auth token from localStorage
        const token = localStorage.getItem('access_token') || localStorage.getItem('auth_token');
        const headers: HeadersInit = {
          'Content-Type': 'application/json',
        };

        // Add Authorization header if user is authenticated
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        // Fetch real data from API
        const [featuredRes, top10Res, top10SeriesRes, releasesRes, allMoviesRes, allSeriesRes] = await Promise.all([
          fetch(`${API_URL}/api/v1/content/featured?limit=5`, {
            cache: 'no-store',
            headers
          }),
          fetch(`${API_URL}/api/v1/content/top10/films`, {
            cache: 'no-store',
            headers
          }),
          fetch(`${API_URL}/api/v1/content/top10/series`, {
            cache: 'no-store',
            headers
          }),
          fetch(`${API_URL}/api/v1/content/releases?limit=20`, {
            cache: 'no-store',
            headers
          }),
          fetch(`${API_URL}/api/v1/content/movies?limit=20`, {
            cache: 'no-store',
            headers
          }),
          fetch(`${API_URL}/api/v1/content/series?limit=20`, {
            cache: 'no-store',
            headers
          })
        ]);

        if (!featuredRes.ok || !top10Res.ok || !top10SeriesRes.ok || !releasesRes.ok || !allMoviesRes.ok || !allSeriesRes.ok) {
          throw new Error('Erro ao carregar dados da API');
        }

        const featuredData = await featuredRes.json();
        const top10Films = await top10Res.json();
        const top10Series = await top10SeriesRes.json();
        const releasesData = await releasesRes.json();
        const allMoviesData = await allMoviesRes.json();
        const allSeriesData = await allSeriesRes.json();

        // Use featured content for hero banner - API already returns only featured items
        const heroMoviesData = (Array.isArray(featuredData) ? featuredData.slice(0, 5) : []) as Movie[];

        // If no featured content, fallback to releases or all movies
        if (heroMoviesData.length === 0) {
          const fallbackMovies = (Array.isArray(releasesData) ? releasesData : allMoviesData.movies || []).slice(0, 3);
          setHeroMovies(fallbackMovies);
        } else {
          setHeroMovies(heroMoviesData);
        }

        // Organize content sections with real data - ORDEM CORRETA
        const sections: ContentSection[] = [
          {
            title: 'Brasil: Top 10 em Filmes Hoje',
            type: 'top10' as const,
            movies: Array.isArray(top10Films) ? top10Films : []
          },
          {
            title: 'Brasil: Top 10 em Séries Hoje',
            type: 'top10' as const,
            movies: Array.isArray(top10Series) ? top10Series : []
          },
          {
            title: 'Lançamentos',
            type: 'latest' as const,
            movies: Array.isArray(releasesData) ? releasesData : []
          },
          {
            title: 'Filmes',
            type: 'latest' as const,
            movies: allMoviesData.movies || []
          },
          {
            title: 'Séries',
            type: 'latest' as const,
            movies: allSeriesData.movies || []
          }
        ].filter(section => section.movies.length > 0);

        setContentSections(sections);
        // Fetch user purchases if authenticated (using same endpoint as dashboard)
        if (token) {
          try {
            const userStr = localStorage.getItem('user');
            if (userStr) {
              const user = JSON.parse(userStr);
              console.log('👤 Usuário logado:', user);

              if (user.id) {
                // Use the SAME endpoint as dashboard: returns content objects directly
                const contentUrl = `${API_URL}/api/v1/purchases/user/${user.id}/content`;
                console.log('🔍 Buscando conteúdos comprados:', contentUrl);

                const contentRes = await fetch(contentUrl, { headers });

                if (contentRes.ok) {
                  const contentData = await contentRes.json();
                  console.log('📦 Conteúdos comprados:', contentData);
                  console.log('📊 Total:', contentData?.length);

                  // Extract content IDs directly (endpoint returns content objects, not purchases)
                  const purchasedIds = new Set(
                    contentData.map((content: any) => content.id).filter(Boolean)
                  );

                  console.log('✅ IDs de conteúdos comprados:', Array.from(purchasedIds));
                  setPurchasedMovies(purchasedIds);
                } else {
                  console.error('❌ Erro ao buscar conteúdos:', contentRes.status, contentRes.statusText);
                  const errorText = await contentRes.text();
                  console.error('❌ Erro detalhado:', errorText);
                }
              }
            }
          } catch (err) {
            console.error('Erro ao carregar compras:', err);
          }
        }
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

  const handleMovieClick = (movie: Movie) => {
    // Navigate to detail page based on content type
    const contentType = (movie as any).content_type || 'movie';
    if (contentType === 'series') {
      router.push(`/series/${movie.id}`);
    } else {
      router.push(`/movies/${movie.id}`);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0d0d0d' }}>
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
    <div className="min-h-screen" style={{ backgroundColor: '#0d0d0d' }}>
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
        <div className="relative z-10 -mt-32 pb-20">
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
                key={`${section.type}-${index}`}
                title={section.title}
                movies={section.movies}
                type={section.type}
                priority={index === 0}
                purchasedMovieIds={purchasedMovies}
                onMovieClick={handleMovieClick}
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

export default function HomePage() {
  return (
    <>
      {/* Auto-login handler wrapped in Suspense */}
      <Suspense fallback={null}>
        <AutoLoginHandler />
      </Suspense>

      {/* Main content */}
      <HomePageContent />
    </>
  );
}
