import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import Link from 'next/link';
import MovieHero from '@/components/MovieHero/MovieHero';
import ActionButtons from '@/components/ActionButtons/ActionButtons';
import TechnicalSpecs from '@/components/TechnicalSpecs/TechnicalSpecs';
import TrailerSection from '@/components/TrailerSection/TrailerSection';
import RelatedMovies from '@/components/RelatedMovies/RelatedMovies';
import { Movie } from '@/types/movie';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

interface MoviePageProps {
  params: {
    id: string;
  };
}

async function getMovie(id: string): Promise<Movie | null> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) {
      console.error('[getMovie] NEXT_PUBLIC_API_URL is not defined');
      return null;
    }

    const response = await fetch(`${apiUrl}/api/v1/content/movies/${id}`, {
      next: { revalidate: 3600 },
      cache: 'force-cache'
    });

    if (!response.ok) {
      console.error(`[getMovie] Failed to fetch movie ${id}: ${response.status}`);
      return null;
    }
    return response.json();
  } catch (error) {
    console.error(`[getMovie] Error fetching movie ${id}:`, error);
    return null;
  }
}

async function getRelatedMovies(movieId: string, genres?: string[]): Promise<Movie[]> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) {
      console.error('[getRelatedMovies] NEXT_PUBLIC_API_URL is not defined');
      return [];
    }

    const response = await fetch(
      `${apiUrl}/api/v1/content/movies/related/${movieId}?genres=${genres?.join(',')}`,
      { next: { revalidate: 3600 }, cache: 'force-cache' }
    );

    if (!response.ok) return [];
    return response.json();
  } catch (error) {
    console.error('[getRelatedMovies] Error:', error);
    return [];
  }
}

export async function generateMetadata({ params }: MoviePageProps): Promise<Metadata> {
  const movie = await getMovie(params.id);

  if (!movie) {
    return {
      title: 'Filme não encontrado - Cine Vision'
    };
  }

  return {
    title: `${movie.title} - Cine Vision`,
    description: movie.description,
    openGraph: {
      title: movie.title,
      description: movie.description,
      images: [
        {
          url: movie.backdrop_url || movie.thumbnail_url,
          width: 1920,
          height: 1080,
          alt: movie.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: movie.title,
      description: movie.description,
      images: [movie.backdrop_url || movie.thumbnail_url],
    },
  };
}

export default async function MoviePage({ params }: MoviePageProps) {
  const movie = await getMovie(params.id);

  if (!movie || movie.status !== 'PUBLISHED') {
    notFound();
  }

  const relatedMovies = await getRelatedMovies(movie.id, movie.genres);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Movie',
    name: movie.title,
    description: movie.description,
    datePublished: movie.release_year ? `${movie.release_year}-01-01` : undefined,
    duration: movie.duration_minutes ? `PT${movie.duration_minutes}M` : undefined,
    genre: movie.genres,
    aggregateRating: movie.imdb_rating ? {
      '@type': 'AggregateRating',
      ratingValue: movie.imdb_rating,
      bestRating: '10'
    } : undefined,
    offers: {
      '@type': 'Offer',
      price: (movie.price_cents / 100).toFixed(2),
      priceCurrency: 'BRL',
      availability: 'https://schema.org/InStock'
    }
  };

  const backdropUrl = movie.backdrop_url || movie.poster_url || movie.thumbnail_url;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main className="min-h-screen bg-dark-950 relative">
        {/* Full page background image */}
        {backdropUrl && (
          <div className="fixed inset-0 z-0">
            <img
              src={backdropUrl}
              alt={movie.title}
              className="w-full h-full object-cover object-center"
            />
            {/* Dark overlay for readability */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/85 to-black/90" />
          </div>
        )}

        {/* Back Button */}
        <div className="relative z-10 pt-20 lg:pt-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 tv:px-12">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-4 py-2 bg-dark-800/80 backdrop-blur-sm border border-white/10 rounded-lg text-white hover:bg-dark-700/80 hover:border-white/20 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 mb-6"
            >
              <ArrowLeftIcon className="w-5 h-5" />
              <span className="font-medium">Voltar para Início</span>
            </Link>
          </div>
        </div>

        <div className="relative z-10">
          <MovieHero movie={movie} />
        </div>

        <div className="relative z-10 mt-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 tv:px-12">
            <div className="grid grid-cols-1 lg:grid-cols-3 tv:grid-cols-4 gap-8 lg:gap-12 tv:gap-16">
              {/* Main Content */}
              <div className="lg:col-span-2 tv:col-span-3 space-y-8 tv:space-y-12">
                <div className="bg-dark-800/50 backdrop-blur-sm border border-white/10 rounded-xl p-6 sm:p-8 tv:p-12">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 tv:gap-8 mb-6 tv:mb-10">
                    <div>
                      <h1 className="text-3xl sm:text-4xl lg:text-5xl tv:text-6xl font-bold text-white mb-4 tv:mb-6">
                        {movie.title}
                      </h1>

                      {movie.genres && movie.genres.length > 0 && (
                        <div className="flex flex-wrap gap-2 tv:gap-3 mb-4 tv:mb-6">
                          {movie.genres.slice(0, 3).map((genre) => (
                            <span
                              key={genre}
                              className="px-3 py-1 tv:px-4 tv:py-2 bg-primary-600/20 border border-primary-600/30 text-primary-400 text-sm tv:text-base font-medium rounded-full"
                            >
                              {genre}
                            </span>
                          ))}
                        </div>
                      )}

                      {movie.age_rating && (
                        <div className="flex items-center gap-2 tv:gap-3">
                          <div className="border-2 border-yellow-500 text-yellow-500 px-3 py-1 rounded font-bold">
                            {movie.age_rating}
                          </div>
                          <span className="text-gray-400">Anos</span>
                        </div>
                      )}
                    </div>

                    <div className="text-right">
                      <div className="text-3xl sm:text-4xl tv:text-5xl font-bold text-primary-600 mb-2">
                        R$ {(movie.price_cents / 100).toFixed(2)}
                      </div>
                      <div className="text-sm tv:text-base text-gray-400">
                        Compra única
                      </div>
                    </div>
                  </div>

                  <p className="text-gray-300 text-lg tv:text-xl leading-relaxed mb-8 tv:mb-12">
                    {movie.description}
                  </p>

                  <ActionButtons movie={movie} />
                </div>

                {/* Trailer Section */}
                <TrailerSection movie={movie} />

                <TechnicalSpecs movie={movie} />
              </div>

              {/* Sidebar */}
              <div className="lg:col-span-1 tv:col-span-1">
                <div className="sticky top-8 tv:top-12">
                  <div className="bg-dark-800/50 backdrop-blur-sm border border-white/10 rounded-xl p-6 tv:p-8 mb-8 tv:mb-12">
                    <h3 className="text-xl tv:text-2xl font-bold text-white mb-4 tv:mb-6">
                      Informações do Filme
                    </h3>

                    <div className="space-y-4 tv:space-y-6">
                      {movie.release_year && (
                        <div>
                          <dt className="text-sm tv:text-base font-medium text-gray-400 mb-1 tv:mb-2">Ano</dt>
                          <dd className="text-white tv:text-lg font-semibold">{movie.release_year}</dd>
                        </div>
                      )}

                      {movie.duration_minutes && (
                        <div>
                          <dt className="text-sm tv:text-base font-medium text-gray-400 mb-1 tv:mb-2">Duração</dt>
                          <dd className="text-white tv:text-lg font-semibold">
                            {Math.floor(movie.duration_minutes / 60)}h {movie.duration_minutes % 60}min
                          </dd>
                        </div>
                      )}

                      <div>
                        <dt className="text-sm tv:text-base font-medium text-gray-400 mb-1 tv:mb-2">Qualidade</dt>
                        <dd className="flex gap-2 tv:gap-3">
                          <span className="px-2 py-1 tv:px-3 tv:py-2 bg-green-600/20 border border-green-600/30 text-green-400 text-xs tv:text-sm font-bold rounded">
                            720p
                          </span>
                          <span className="px-2 py-1 tv:px-3 tv:py-2 bg-blue-600/20 border border-blue-600/30 text-blue-400 text-xs tv:text-sm font-bold rounded">
                            1080p
                          </span>
                        </dd>
                      </div>

                      <div>
                        <dt className="text-sm tv:text-base font-medium text-gray-400 mb-1 tv:mb-2">Disponível em</dt>
                        <dd className="flex items-center gap-2 tv:gap-3 text-white tv:text-lg">
                          <div className="w-2 h-2 tv:w-3 tv:h-3 bg-blue-500 rounded-full"></div>
                          Telegram
                        </dd>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Related Movies */}
        {relatedMovies.length > 0 && (
          <div className="py-16 tv:py-24">
            <RelatedMovies movies={relatedMovies} currentMovieId={movie.id} />
          </div>
        )}
      </main>
    </>
  );
}