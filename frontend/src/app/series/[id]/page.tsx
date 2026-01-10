'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import LazyImage from '@/components/ui/LazyImage';
import TrailerSection from '@/components/TrailerSection/TrailerSection';
import { ViewingOptionsModal } from '@/components/ViewingOptionsModal/ViewingOptionsModal';
import { ArrowLeftIcon, PlayIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import { Movie, getEffectiveAvailability } from '@/types/movie';

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
  cast?: string | string[];
  genres?: string | string[];
  imdb_rating?: number;
  status: string;
  age_rating?: string;
  duration_minutes?: number;
  telegram_group_link?: string;
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
  const [isOwned, setIsOwned] = useState<boolean>(false);
  const [checkingOwnership, setCheckingOwnership] = useState(true);
  const [showViewingOptions, setShowViewingOptions] = useState(false);
  const [selectedEpisodeToWatch, setSelectedEpisodeToWatch] = useState<Episode | null>(null);

  // Helper function to normalize string or array fields
  const normalizeToArray = (value: string | string[] | undefined): string[] => {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    // If string, try to parse as JSON first
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // If not JSON, split by comma and trim
      return value.split(',').map(item => item.trim()).filter(item => item.length > 0);
    }
    return [];
  };

  useEffect(() => {
    if (!seriesId) return;

    const fetchSeriesData = async () => {
      try {
        setLoading(true);

        // Fetch series details
        const seriesResponse = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/v1/content/series/${seriesId}`
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

        // Normalize cast and genres to arrays
        seriesData.cast = normalizeToArray(seriesData.cast);
        seriesData.genres = normalizeToArray(seriesData.genres);

        setSeries(seriesData);

        // Check ownership status
        try {
          const ownershipResponse = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/v1/purchases/check/${seriesId}`,
            { credentials: 'include' }
          );

          if (ownershipResponse.ok) {
            const ownershipData = await ownershipResponse.json();
            setIsOwned(ownershipData.isOwned || false);
          } else {
            setIsOwned(false);
          }
        } catch (ownershipError) {
          console.error('Erro ao verificar propriedade:', ownershipError);
          setIsOwned(false);
        } finally {
          setCheckingOwnership(false);
        }

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
    // Verificar se o usuário possui a série antes de permitir assistir
    if (!isOwned) {
      toast.error('Você precisa comprar a série para assistir os episódios', {
        duration: 4000,
        icon: '🔒'
      });
      return;
    }

    // Armazenar episódio selecionado e abrir modal de escolha
    setSelectedEpisodeToWatch(episode);
    setShowViewingOptions(true);
  };

  const handleChooseSite = () => {
    // Fechar modal e redirecionar para o player do site
    setShowViewingOptions(false);
    if (selectedEpisodeToWatch) {
      router.push(`/watch/${seriesId}?episode=${selectedEpisodeToWatch.id}&season=${selectedEpisodeToWatch.season_number}&ep=${selectedEpisodeToWatch.episode_number}`);
    }
  };

  const handlePurchase = () => {
    // Gerar deep link do Telegram para compra da série
    const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'cinevisionv2bot';
    const deepLink = `https://t.me/${botUsername}?start=buy_${seriesId}`;

    toast.success('Abrindo Telegram...', {
      duration: 2000,
      icon: '📱'
    });

    // Abrir Telegram
    window.open(deepLink, '_blank');
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
            href="/series"
            className="px-6 py-3 bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
          >
            Voltar para Séries
          </Link>
        </div>
      </div>
    );
  }

  const seasonsEpisodes = episodes.filter(ep => ep.season_number === selectedSeason);
  const seasons = Array.from({ length: series.total_seasons }, (_, i) => i + 1);
  const backdropUrl = series.backdrop_url || series.poster_url;

  return (
    <main className="min-h-screen bg-dark-950 relative">
      {/* Full page background image */}
      {backdropUrl && (
        <div className="fixed inset-0 z-0">
          <img
            src={backdropUrl}
            alt={series.title}
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
            href="/series"
            className="inline-flex items-center gap-2 px-4 py-2 bg-dark-800/80 backdrop-blur-sm border border-white/10 rounded-lg text-white hover:bg-dark-700/80 hover:border-white/20 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 mb-6"
          >
            <ArrowLeftIcon className="w-5 h-5" />
            <span className="font-medium">Voltar para Séries</span>
          </Link>
        </div>
      </div>

      <div className="relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 tv:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-3 tv:grid-cols-4 gap-8 lg:gap-12 tv:gap-16">
            {/* Main Content */}
            <div className="lg:col-span-2 tv:col-span-3 space-y-8 tv:space-y-12">
              <div className="bg-dark-800/50 backdrop-blur-sm border border-white/10 rounded-xl p-6 sm:p-8 tv:p-12">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 tv:gap-8 mb-6 tv:mb-10">
                  <div>
                    <h1 className="text-3xl sm:text-4xl lg:text-5xl tv:text-6xl font-bold text-white mb-4 tv:mb-6">
                      {series.title}
                    </h1>

                    {series.genres && series.genres.length > 0 && (
                      <div className="flex flex-wrap gap-2 tv:gap-3 mb-4 tv:mb-6">
                        {series.genres.slice(0, 3).map((genre) => (
                          <span
                            key={genre}
                            className="px-3 py-1 tv:px-4 tv:py-2 bg-blue-600/20 border border-blue-600/30 text-blue-400 text-sm tv:text-base font-medium rounded-full"
                          >
                            {genre}
                          </span>
                        ))}
                      </div>
                    )}

                    {series.age_rating && (
                      <div className="flex items-center gap-2 tv:gap-3">
                        <div className="border-2 border-yellow-500 text-yellow-500 px-3 py-1 rounded font-bold">
                          {series.age_rating}
                        </div>
                        <span className="text-gray-400">Anos</span>
                      </div>
                    )}
                  </div>

                  <div className="text-right">
                    <div className="text-3xl sm:text-4xl tv:text-5xl font-bold text-blue-600 mb-2">
                      R$ {(series.price_cents / 100).toFixed(2)}
                    </div>
                    <div className="text-sm tv:text-base text-gray-400">
                      Compra única
                    </div>
                  </div>
                </div>

                <p className="text-gray-300 text-lg tv:text-xl leading-relaxed mb-8 tv:mb-12">
                  {series.description}
                </p>

                {/* Action Button */}
                <div className="flex items-center space-x-4">
                  {checkingOwnership ? (
                    <div className="px-8 py-3 bg-gray-600 rounded-lg flex items-center space-x-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span className="font-semibold">Verificando...</span>
                    </div>
                  ) : isOwned ? (
                    <button
                      onClick={() => {
                        if (episodes.length > 0) {
                          handleEpisodePlay(episodes[0]);
                        } else {
                          toast.error('Nenhum episódio disponível');
                        }
                      }}
                      className="px-8 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-semibold transition-colors flex items-center space-x-2"
                    >
                      <PlayIcon className="w-5 h-5" />
                      <span>Assistir Agora</span>
                    </button>
                  ) : (
                    <button
                      onClick={handlePurchase}
                      className="px-8 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors flex items-center space-x-2"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                      </svg>
                      <span>Comprar via Telegram</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Trailer Section */}
              <TrailerSection movie={series as any} />

              {/* Synopsis */}
              {series.synopsis && (
                <div className="bg-dark-800/50 backdrop-blur-sm border border-white/10 rounded-xl p-6 sm:p-8 tv:p-12">
                  <h2 className="text-2xl tv:text-3xl font-bold text-white mb-4 tv:mb-6">
                    Sinopse
                  </h2>
                  <p className="text-gray-300 text-lg tv:text-xl leading-relaxed">
                    {series.synopsis}
                  </p>
                </div>
              )}

              {/* Episodes Section */}
              <div className="bg-dark-800/50 backdrop-blur-sm border border-white/10 rounded-xl p-6 sm:p-8 tv:p-12">
                <div className="flex items-center justify-between mb-6 tv:mb-8">
                  <h2 className="text-2xl tv:text-3xl font-bold text-white">Episódios</h2>

                  {/* Season Selector */}
                  {series.total_seasons > 1 && (
                    <div className="flex items-center space-x-2">
                      <label className="text-gray-400 font-medium">Temporada:</label>
                      <select
                        value={selectedSeason}
                        onChange={(e) => setSelectedSeason(parseInt(e.target.value))}
                        className="px-4 py-2 bg-dark-800/80 backdrop-blur-sm border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  <div className="grid grid-cols-1 gap-4">
                    {seasonsEpisodes.map((episode) => (
                      <div
                        key={episode.id}
                        className="bg-dark-900/50 backdrop-blur-sm border border-white/10 rounded-xl p-4 hover:border-blue-500/30 transition-all duration-200 cursor-pointer group"
                        onClick={() => handleEpisodePlay(episode)}
                      >
                        <div className="flex space-x-4">
                          {/* Episode Thumbnail */}
                          <div className="relative w-40 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-dark-900">
                            {episode.thumbnail_url ? (
                              <img
                                src={episode.thumbnail_url}
                                alt={`S${episode.season_number}E${episode.episode_number}`}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-600">
                                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                                </svg>
                              </div>
                            )}
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <PlayIcon className="w-10 h-10 text-white" />
                            </div>
                          </div>

                          {/* Episode Info */}
                          <div className="flex-1">
                            <div className="flex items-start justify-between mb-2">
                              <h3 className="font-semibold text-white text-lg group-hover:text-blue-400 transition-colors">
                                E{episode.episode_number}: {episode.title}
                              </h3>
                              <span className="text-sm text-gray-400 ml-2">{episode.duration_minutes}min</span>
                            </div>
                            <p className="text-sm text-gray-400 line-clamp-2">{episode.description}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                    </svg>
                    <p className="text-gray-400 text-lg">Nenhum episódio disponível para a Temporada {selectedSeason}</p>
                    <p className="text-gray-500 text-sm mt-2">Os episódios serão adicionados em breve</p>
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-1 tv:col-span-1">
              <div className="sticky top-8 tv:top-12">
                <div className="bg-dark-800/50 backdrop-blur-sm border border-white/10 rounded-xl p-6 tv:p-8 mb-8 tv:mb-12">
                  <h3 className="text-xl tv:text-2xl font-bold text-white mb-4 tv:mb-6">
                    Informações da Série
                  </h3>

                  <div className="space-y-4 tv:space-y-6">
                    {series.release_year && (
                      <div>
                        <dt className="text-sm tv:text-base font-medium text-gray-400 mb-1 tv:mb-2">Ano</dt>
                        <dd className="text-white tv:text-lg font-semibold">{series.release_year}</dd>
                      </div>
                    )}

                    <div>
                      <dt className="text-sm tv:text-base font-medium text-gray-400 mb-1 tv:mb-2">Temporadas</dt>
                      <dd className="text-white tv:text-lg font-semibold">
                        {series.total_seasons} {series.total_seasons === 1 ? 'Temporada' : 'Temporadas'}
                      </dd>
                    </div>

                    <div>
                      <dt className="text-sm tv:text-base font-medium text-gray-400 mb-1 tv:mb-2">Episódios</dt>
                      <dd className="text-white tv:text-lg font-semibold">{series.total_episodes} Episódios</dd>
                    </div>

                    {series.duration_minutes && (
                      <div>
                        <dt className="text-sm tv:text-base font-medium text-gray-400 mb-1 tv:mb-2">Duração (por episódio)</dt>
                        <dd className="text-white tv:text-lg font-semibold">~{series.duration_minutes}min</dd>
                      </div>
                    )}

                    {series.imdb_rating && (
                      <div>
                        <dt className="text-sm tv:text-base font-medium text-gray-400 mb-1 tv:mb-2">Avaliação</dt>
                        <dd className="flex items-center gap-2">
                          <span className="text-yellow-500 text-xl">⭐</span>
                          <span className="text-white tv:text-lg font-semibold">{series.imdb_rating}/10</span>
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

                {/* Additional Info */}
                {(series.director || (series.cast && series.cast.length > 0)) && (
                  <div className="bg-dark-800/50 backdrop-blur-sm border border-white/10 rounded-xl p-6 tv:p-8">
                    <h3 className="text-xl tv:text-2xl font-bold text-white mb-4 tv:mb-6">
                      Equipe
                    </h3>
                    <div className="space-y-4">
                      {series.director && (
                        <div>
                          <dt className="text-sm font-medium text-gray-400 mb-1">Diretor</dt>
                          <dd className="text-white">{series.director}</dd>
                        </div>
                      )}
                      {series.cast && series.cast.length > 0 && (
                        <div>
                          <dt className="text-sm font-medium text-gray-400 mb-1">Elenco Principal</dt>
                          <dd className="text-white">{series.cast.slice(0, 5).join(', ')}</dd>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de escolha de visualização */}
      {series && (
        <ViewingOptionsModal
          isOpen={showViewingOptions}
          onClose={() => setShowViewingOptions(false)}
          movieTitle={`${series.title}${selectedEpisodeToWatch ? ` - T${selectedEpisodeToWatch.season_number}E${selectedEpisodeToWatch.episode_number}` : ''}`}
          telegramGroupLink={series.telegram_group_link || ''}
          onChooseSite={handleChooseSite}
          availability={getEffectiveAvailability(series as unknown as Movie)}
        />
      )}
    </main>
  );
}
