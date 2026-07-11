import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { Suspense } from 'react';
import ContentHero from '@/components/ContentHero/ContentHero';
import CastSection from '@/components/CastSection/CastSection';
import TrailerSection from '@/components/TrailerSection/TrailerSection';
import RelatedMovies from '@/components/RelatedMovies/RelatedMovies';
import BusinessLinkCapture from '@/components/BusinessLinkCapture/BusinessLinkCapture';
import PromoLinkCapture from '@/components/PromoLinkCapture';
import { Movie } from '@/types/movie';
import { ogImageUrl } from '@/lib/ogImage';

interface MoviePageProps {
  params: { id: string };
}

async function getMovie(id: string): Promise<Movie | null> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) return null;
    const res = await fetch(`${apiUrl}/api/v1/content/movies/${id}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function getRelatedMovies(movieId: string, genres?: string[]): Promise<Movie[]> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) return [];
    const res = await fetch(
      `${apiUrl}/api/v1/content/movies/related/${movieId}?genres=${genres?.join(',')}`,
      { cache: 'no-store' }
    );
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: MoviePageProps): Promise<Metadata> {
  const movie = await getMovie(params.id);
  if (!movie) return { title: 'Filme não encontrado - Cine Vision' };

  // Igor (18/05): og:image via proxy que força JPEG — WhatsApp não renderiza WebP.
  // N26 (Igor 07/06): filmes antigos podem ter backdrop_url null — usar poster_url
  // como fallback para garantir que o preview aparece no Twitter/WhatsApp.
  const ogImg = ogImageUrl(movie.backdrop_url || movie.poster_url || movie.thumbnail_url);

  return {
    title: `${movie.title} - Cine Vision`,
    description: movie.description,
    openGraph: {
      title: movie.title,
      description: movie.description,
      images: ogImg ? [{ url: ogImg, width: 1200, height: 630, alt: movie.title }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: movie.title,
      description: movie.description,
      images: ogImg ? [ogImg] : undefined,
    },
  };
}

export default async function MoviePage({ params }: MoviePageProps) {
  const movie = await getMovie(params.id);
  if (!movie || movie.status !== 'PUBLISHED') notFound();

  const relatedMovies = await getRelatedMovies(movie.id, movie.genres);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Movie',
    name: movie.title,
    description: movie.description,
    datePublished: movie.release_year ? `${movie.release_year}-01-01` : undefined,
    duration: movie.duration_minutes ? `PT${movie.duration_minutes}M` : undefined,
    genre: movie.genres,
    aggregateRating: movie.imdb_rating
      ? { '@type': 'AggregateRating', ratingValue: movie.imdb_rating, bestRating: '10' }
      : undefined,
    offers: {
      '@type': 'Offer',
      price: ((movie.discounted_price_cents || movie.price_cents) / 100).toFixed(2),
      priceCurrency: 'BRL',
      availability: 'https://schema.org/InStock',
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <main className="bg-dark-950">
        {/* Captura ?via=business&bid=...&chat=... pro fluxo de IA Business DM. */}
        <Suspense fallback={null}>
          <BusinessLinkCapture />
        </Suspense>

        {/* Igor (04/07): captura ?promo_bot=&promo_content= pra Cenário 1
            (cliente veio de bot promocional → Comprar desvia pra bot oficial). */}
        <Suspense fallback={null}>
          <PromoLinkCapture />
        </Suspense>

        {/* Hero - fullscreen backdrop */}
        <ContentHero content={movie} backHref="/" backLabel="Início" contentType="movie" />

        {/* Cast */}
        <CastSection
          cast={movie.cast}
          director={movie.director}
          people={(movie as any).content_people?.map((cp: any) => cp.person).filter(Boolean)}
        />

        {/* Trailer */}
        {movie.trailer_url && (
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-10 tv:px-16 pb-10 tv:pb-14">
            <TrailerSection movie={movie} />
          </div>
        )}

        {/* Related */}
        {relatedMovies.length > 0 && (
          <div className="py-8 sm:py-12 tv:py-16">
            <RelatedMovies movies={relatedMovies} currentMovieId={movie.id} />
          </div>
        )}
      </main>
    </>
  );
}
