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

                      {movie.imdb_rating && (
                        <div className="flex items-center gap-2 tv:gap-3 text-yellow-400">
                          <svg className="w-5 h-5 tv:w-6 tv:h-6 fill-current" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118l-2.8-2.034c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                          <span className="font-semibold tv:text-lg">{movie.imdb_rating.toFixed(1)}</span>
                          <span className="text-gray-400 tv:text-base">/10</span>
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
                          <div className="w-2 h-2 tv:w-3 tv:h-3 bg-green-500 rounded-full"></div>
                          Site + Telegram
                        </dd>
                      </div>
                    </div>
                  </div>

                  {/* Share Section */}
                  <div className="bg-dark-800/50 backdrop-blur-sm border border-white/10 rounded-xl p-6 tv:p-8">
                    <h3 className="text-lg tv:text-xl font-bold text-white mb-4 tv:mb-6">
                      Compartilhar
                    </h3>

                    <div className="flex gap-3 tv:gap-4">
                      <button className="flex-1 flex items-center justify-center gap-2 tv:gap-3 px-4 py-2 tv:px-6 tv:py-3 bg-blue-600/20 border border-blue-600/30 text-blue-400 text-sm tv:text-base font-medium rounded-lg hover:bg-blue-600/30 focus:bg-blue-600/30 focus:outline-none focus:ring-2 focus:ring-blue-500 tv:focus:ring-4 transition-colors">
                        <svg className="w-4 h-4 tv:w-5 tv:h-5 fill-current" viewBox="0 0 24 24">
                          <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/>
                        </svg>
                        <span className="hidden sm:inline">Twitter</span>
                      </button>

                      <button className="flex-1 flex items-center justify-center gap-2 tv:gap-3 px-4 py-2 tv:px-6 tv:py-3 bg-green-600/20 border border-green-600/30 text-green-400 text-sm tv:text-base font-medium rounded-lg hover:bg-green-600/30 focus:bg-green-600/30 focus:outline-none focus:ring-2 focus:ring-green-500 tv:focus:ring-4 transition-colors">
                        <svg className="w-4 h-4 tv:w-5 tv:h-5 fill-current" viewBox="0 0 24 24">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
                        </svg>
                        <span className="hidden sm:inline">WhatsApp</span>
                      </button>
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