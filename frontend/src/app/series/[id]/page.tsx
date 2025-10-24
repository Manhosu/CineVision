'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import LazyImage from '@/components/ui/LazyImage';
import { ArrowLeftIcon, PlayIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';

interface Episode {
  id: string;
  season_number: number;
  episode_number: number;
  title: string;
  description: string;
  thumbnail_url?: string;
  duration_minutes: number;
  video_url?: string;
}

interface Series {
  id: string;
  title: string;
  description: string;
  synopsis?: string;
  poster_url: string;
  backdrop_url?: string;
  trailer_url?: string;
  price_cents: number;
  currency: string;
  total_seasons: number;
  total_episodes: number;
  release_year?: number;
  director?: string;
  cast?: string[];
  genres?: string[];
  imdb_rating?: number;
  status: string;
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

  useEffect(() => {
    if (!seriesId) return;

    const fetchSeriesData = async () => {
      try {
        setLoading(true);

        // Fetch series details - tentamos primeiro no endpoint de series, depois movies
        let seriesResponse = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/v1/content/movies/${seriesId}`
        );

        if (!seriesResponse.ok) {
          throw new Error('Série não encontrada');
        }

        const seriesData = await seriesResponse.json();

        // Verificar se é realmente uma série
        if (seriesData.content_type !== 'series') {
          // Se não for série, redirecionar para página de filme
          router.push(`/movies/${seriesId}`);
          return;
        }

        setSeries(seriesData);

        // Fetch episodes
        try {
          const episodesResponse = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/v1/content/series/${seriesId}/episodes`,
            { credentials: 'include' }
          );

          if (episodesResponse.ok) {
            const episodesData = await episodesResponse.json();
            setEpisodes(Array.isArray(episodesData) ? episodesData : []);
          } else {
            console.warn('Não foi possível carregar episódios');
            setEpisodes([]);
          }
        } catch (episodesError) {
          console.error('Erro ao carregar episódios:', episodesError);
          setEpisodes([]);
        }

      } catch (err: any) {
        console.error('Erro ao carregar série:', err);
        setError(err.message || 'Erro ao carregar série');
      } finally {
        setLoading(false);
      }
    };

    fetchSeriesData();
  }, [seriesId, router]);

  const handleEpisodePlay = (episode: Episode) => {
    // Redirecionar para página de player com o episódio selecionado
    router.push(`/watch/${seriesId}?episode=${episode.id}&season=${episode.season_number}&ep=${episode.episode_number}`);
  };

  const handlePurchase = () => {
    // TODO: Implementar fluxo de compra
    toast.info('Funcionalidade de compra em desenvolvimento');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (error || !series) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-500 mb-4">Erro</h2>
          <p className="text-gray-400 mb-6">{error || 'Série não encontrada'}</p>
          <Link
            href="/"
            className="px-6 py-3 bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
          >
            Voltar para Início
          </Link>
        </div>
      </div>
    );
  }

  const seasonsEpisodes = episodes.filter(ep => ep.season_number === selectedSeason);
  const seasons = Array.from({ length: series.total_seasons }, (_, i) => i + 1);

  return (
    <main className="min-h-screen bg-dark-950 relative">
      {/* Background Image */}
      {series.backdrop_url && (
        <div className="fixed inset-0 z-0">
          <img
            src={series.backdrop_url}
            alt={series.title}
            className="w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/85 to-black/90" />
        </div>
      )}

      {/* Back Button */}
      <div className="relative z-10 pt-20 lg:pt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 bg-dark-800/80 backdrop-blur-sm border border-white/10 rounded-lg text-white hover:bg-dark-700/80 hover:border-white/20 transition-all duration-200 mb-6"
          >
            <ArrowLeftIcon className="w-5 h-5" />
            <span className="font-medium">Voltar para Início</span>
          </Link>
        </div>
      </div>

      {/* Series Info */}
      <div className="relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
            {/* Poster */}
            <div className="lg:col-span-1">
              <div className="aspect-[2/3] rounded-xl overflow-hidden shadow-2xl">
                <LazyImage
                  src={series.poster_url}
                  alt={series.title}
                  fill
                  className="object-cover"
                  placeholder={series.title}
                  fallbackSrc="/images/placeholder-poster.svg"
                />
              </div>
            </div>

            {/* Info */}
            <div className="lg:col-span-2 space-y-6">
              <div>
                <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
                  {series.title}
                </h1>

                {series.genres && series.genres.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {series.genres.slice(0, 3).map((genre) => (
                      <span
                        key={genre}
                        className="px-3 py-1 bg-primary-600/20 border border-primary-600/30 text-primary-400 text-sm font-medium rounded-full"
                      >
                        {genre}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center space-x-4 text-gray-400 text-sm mb-6">
                  {series.release_year && <span>{series.release_year}</span>}
                  <span>•</span>
                  <span>📺 {series.total_seasons} {series.total_seasons > 1 ? 'Temporadas' : 'Temporada'}</span>
                  <span>•</span>
                  <span>{series.total_episodes} Episódios</span>
                  {series.imdb_rating && (
                    <>
                      <span>•</span>
                      <span className="text-yellow-500">⭐ {series.imdb_rating}</span>
                    </>
                  )}
                </div>
              </div>

              <p className="text-gray-300 text-lg leading-relaxed">
                {series.description}
              </p>

              {series.synopsis && (
                <div className="bg-dark-800/50 backdrop-blur-sm border border-white/10 rounded-xl p-6">
                  <h3 className="text-xl font-bold text-white mb-3">Sinopse</h3>
                  <p className="text-gray-300 leading-relaxed">{series.synopsis}</p>
                </div>
              )}

              {/* Purchase Button */}
              <div className="flex items-center space-x-4">
                <div className="text-3xl font-bold text-primary-500">
                  R$ {(series.price_cents / 100).toFixed(2)}
                </div>
                <button
                  onClick={handlePurchase}
                  className="px-8 py-3 bg-primary-600 hover:bg-primary-700 rounded-lg font-semibold transition-colors flex items-center space-x-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <span>Comprar Série Completa</span>
                </button>
              </div>

              {/* Additional Info */}
              {(series.director || (series.cast && series.cast.length > 0)) && (
                <div className="bg-dark-800/50 backdrop-blur-sm border border-white/10 rounded-xl p-6 space-y-4">
                  {series.director && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-400 mb-1">Diretor</h4>
                      <p className="text-white">{series.director}</p>
                    </div>
                  )}
                  {series.cast && series.cast.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-400 mb-1">Elenco</h4>
                      <p className="text-white">{series.cast.join(', ')}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Episodes Section */}
          <div className="mb-16">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-3xl font-bold text-white">Episódios</h2>

              {/* Season Selector */}
              {series.total_seasons > 1 && (
                <div className="flex items-center space-x-2">
                  <label className="text-gray-400 font-medium">Temporada:</label>
                  <select
                    value={selectedSeason}
                    onChange={(e) => setSelectedSeason(parseInt(e.target.value))}
                    className="px-4 py-2 bg-dark-800/80 backdrop-blur-sm border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    {seasons.map(season => (
                      <option key={season} value={season}>Temporada {season}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Episodes Grid */}
            {seasonsEpisodes.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {seasonsEpisodes.map((episode) => (
                  <div
                    key={episode.id}
                    className="bg-dark-800/50 backdrop-blur-sm border border-white/10 rounded-xl p-4 hover:border-white/20 transition-all duration-200 cursor-pointer group"
                    onClick={() => handleEpisodePlay(episode)}
                  >
                    <div className="flex space-x-4">
                      {/* Episode Thumbnail */}
                      <div className="relative w-32 h-18 flex-shrink-0 rounded-lg overflow-hidden bg-dark-900">
                        {episode.thumbnail_url ? (
                          <img
                            src={episode.thumbnail_url}
                            alt={`S${episode.season_number}E${episode.episode_number}`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-600">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                            </svg>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <PlayIcon className="w-8 h-8 text-white" />
                        </div>
                      </div>

                      {/* Episode Info */}
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-semibold text-white group-hover:text-primary-400 transition-colors">
                            E{episode.episode_number}: {episode.title}
                          </h3>
                          <span className="text-xs text-gray-400 ml-2">{episode.duration_minutes}min</span>
                        </div>
                        <p className="text-sm text-gray-400 line-clamp-2">{episode.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16 bg-dark-800/30 backdrop-blur-sm border border-white/10 rounded-xl">
                <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                </svg>
                <p className="text-gray-400 text-lg">Nenhum episódio disponível para a Temporada {selectedSeason}</p>
                <p className="text-gray-500 text-sm mt-2">Os episódios serão adicionados em breve</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
