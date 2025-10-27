'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import VideoPlayer from '@/components/VideoPlayer/VideoPlayer';
import { VideoContent } from '@/types/video';

interface Episode {
  id: string;
  season_number: number;
  episode_number: number;
  title: string;
  description: string;
  thumbnail_url?: string;
  duration_minutes: number;
  video_url?: string;
  file_storage_key?: string;
}

interface WatchPageProps {
  params: { id: string };
}

export default function WatchPage({ params }: WatchPageProps) {
  const router = useRouter();
  const id = params.id;
  const searchParams = useSearchParams();
  const selectedLanguageId = searchParams?.get('lang');
  const episodeParam = searchParams?.get('episode');
  const seasonParam = searchParams?.get('season');

  const [content, setContent] = useState<VideoContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [resumePosition, setResumePosition] = useState<number>(0);
  const [showResumeModal, setShowResumeModal] = useState<boolean>(true);

  // Series-specific state
  const [isSeries, setIsSeries] = useState(false);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [currentEpisode, setCurrentEpisode] = useState<Episode | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);

  // Fetch content details and access token
  useEffect(() => {
    const fetchContent = async () => {
      if (!id) return;

      try {
        setLoading(true);
        setError(null);

        // Try to get content details - first try movies endpoint, then series
        let contentResponse = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/v1/content/movies/${id}`,
          {
            credentials: 'include',
          }
        );

        // If movie endpoint returns 404, try series endpoint
        if (!contentResponse.ok && contentResponse.status === 404) {
          contentResponse = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/v1/content/series/${id}`,
            {
              credentials: 'include',
            }
          );
        }

        if (!contentResponse.ok) {
          throw new Error(`Failed to load content: ${contentResponse.statusText}`);
        }

        let contentData = await contentResponse.json();

        // If a language ID was selected, fetch the presigned URL for that language
        if (selectedLanguageId) {
          try {
            const presignedResponse = await fetch(
              `${process.env.NEXT_PUBLIC_API_URL}/api/v1/content-language-upload/public/video-url/${selectedLanguageId}`
            );

            if (presignedResponse.ok) {
              const presignedData = await presignedResponse.json();

              if (presignedData.url) {
                // Override the video URL with the presigned URL
                contentData = {
                  ...contentData,
                  video_url: presignedData.url,
                  language_type: presignedData.language_type,
                  language_code: presignedData.language_code,
                };
              }
            }
          } catch (langError) {
            console.error('Error fetching presigned URL:', langError);
            // Continue with default content
          }
        }

        // If no video URL but has file_storage_key, generate presigned URL
        if (!contentData.video_url && contentData.file_storage_key) {
          try {
            const presignedUrl = await getPresignedVideoUrl(contentData.file_storage_key);
            contentData = {
              ...contentData,
              video_url: presignedUrl,
            };
          } catch (presignedError) {
            console.error('Error generating presigned URL for content:', presignedError);
          }
        }

        setContent(contentData);

        // Check if this is a series
        const isSeriesContent = contentData.content_type === 'series';
        setIsSeries(isSeriesContent);

        // If series, fetch episodes
        if (isSeriesContent) {
          try {
            setLoadingEpisodes(true);
            const episodesResponse = await fetch(
              `${process.env.NEXT_PUBLIC_API_URL}/api/v1/content/series/${id}/episodes`,
              { credentials: 'include' }
            );

            if (episodesResponse.ok) {
              const episodesData = await episodesResponse.json();
              setEpisodes(episodesData);

              // Set selected season from URL or default to 1
              const season = seasonParam ? parseInt(seasonParam) : 1;
              setSelectedSeason(season);

              // Find the episode to play
              let episodeToPlay: Episode | null = null;
              if (episodeParam) {
                const epNum = parseInt(episodeParam);
                episodeToPlay = episodesData.find(
                  (ep: Episode) => ep.season_number === season && ep.episode_number === epNum
                ) || null;
              }

              // If no episode specified, play first episode of selected season
              if (!episodeToPlay && episodesData.length > 0) {
                episodeToPlay = episodesData.find(
                  (ep: Episode) => ep.season_number === season
                ) || episodesData[0];
              }

              setCurrentEpisode(episodeToPlay);

              // For series, always update the content with episode info
              if (episodeToPlay) {
                // If episode has no video_url but has file_storage_key, generate presigned URL
                let episodeVideoUrl = episodeToPlay.video_url;
                if (!episodeVideoUrl && episodeToPlay.file_storage_key) {
                  try {
                    episodeVideoUrl = await getPresignedVideoUrl(episodeToPlay.file_storage_key);
                  } catch (presignedError) {
                    console.error('Error generating presigned URL for episode:', presignedError);
                  }
                }

                contentData = {
                  ...contentData,
                  // Use episode video URL (presigned or direct) if available, otherwise keep content video URL
                  video_url: episodeVideoUrl || contentData.video_url,
                  title: `${contentData.title} - S${episodeToPlay.season_number}E${episodeToPlay.episode_number}: ${episodeToPlay.title}`,
                  duration_minutes: episodeToPlay.duration_minutes || contentData.duration_minutes,
                };
                setContent(contentData);
              }
            }
          } catch (episodesError) {
            console.error('Error fetching episodes:', episodesError);
          } finally {
            setLoadingEpisodes(false);
          }
        }

        // Get access token if authenticated
        const token = localStorage.getItem('access_token');
        if (token) {
          setAccessToken(token);

          // Get resume position from backend if user is authenticated
          try {
            // For series, we track progress per episode
            let progressKey = id;
            if (isSeriesContent && currentEpisode) {
              progressKey = `${id}_s${currentEpisode.season_number}e${currentEpisode.episode_number}`;
            }

            const progressResponse = await fetch(
              `${process.env.NEXT_PUBLIC_API_URL}/api/v1/purchases/progress/${progressKey}`,
              {
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
              }
            );

            if (progressResponse.ok) {
              const progressData = await progressResponse.json();
              if (progressData.progress_seconds > 30) {
                setResumePosition(progressData.progress_seconds);
              }
            }
          } catch (progressError) {
            console.log('Could not load watch progress:', progressError);
            // Fallback to localStorage for backward compatibility
            let storageKey = `resume_${id}`;
            if (isSeriesContent && currentEpisode) {
              storageKey = `resume_${id}_s${currentEpisode.season_number}e${currentEpisode.episode_number}`;
            }
            const savedPosition = localStorage.getItem(storageKey);
            if (savedPosition) {
              setResumePosition(parseFloat(savedPosition));
            }
          }
        } else {
          // Fallback to localStorage for unauthenticated users
          let storageKey = `resume_${id}`;
          if (isSeriesContent && currentEpisode) {
            storageKey = `resume_${id}_s${currentEpisode.season_number}e${currentEpisode.episode_number}`;
          }
          const savedPosition = localStorage.getItem(storageKey);
          if (savedPosition) {
            setResumePosition(parseFloat(savedPosition));
          }
        }

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load content';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchContent();
  }, [id, selectedLanguageId, episodeParam, seasonParam, router]);

  // Save resume position
  const handleTimeUpdate = (currentTime: number) => {
    if (!id || currentTime < 30) return; // Don't save very early positions

    // For series, save progress per episode
    let progressKey = id;
    let storageKey = `resume_${id}`;
    if (isSeries && currentEpisode) {
      progressKey = `${id}_s${currentEpisode.season_number}e${currentEpisode.episode_number}`;
      storageKey = `resume_${id}_s${currentEpisode.season_number}e${currentEpisode.episode_number}`;
    }

    const token = localStorage.getItem('access_token');
    if (token && content) {
      // Save to backend if authenticated
      try {
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/purchases/progress/${progressKey}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            progress_seconds: currentTime,
            total_duration_seconds: content.duration_minutes ? content.duration_minutes * 60 : 7200, // fallback to 2 hours
          }),
        }).catch(error => {
          console.error('Failed to save progress to backend:', error);
          // Fallback to localStorage
          localStorage.setItem(storageKey, currentTime.toString());
        });
      } catch (error) {
        console.error('Failed to save progress to backend:', error);
        // Fallback to localStorage
        localStorage.setItem(storageKey, currentTime.toString());
      }
    } else {
      // Fallback to localStorage for unauthenticated users
      localStorage.setItem(storageKey, currentTime.toString());
    }
  };

  // Handle video end
  const handleVideoEnded = () => {
    if (!id) return;

    // For series, use episode-specific keys
    let progressKey = id;
    let storageKey = `resume_${id}`;
    if (isSeries && currentEpisode) {
      progressKey = `${id}_s${currentEpisode.season_number}e${currentEpisode.episode_number}`;
      storageKey = `resume_${id}_s${currentEpisode.season_number}e${currentEpisode.episode_number}`;
    }

    const token = localStorage.getItem('access_token');
    if (token && content) {
      // Mark as completed in backend
      try {
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/purchases/progress/${progressKey}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            progress_seconds: content.duration_minutes ? content.duration_minutes * 60 : 7200,
            total_duration_seconds: content.duration_minutes ? content.duration_minutes * 60 : 7200,
          }),
        }).catch(error => {
          console.error('Failed to mark as completed:', error);
        });
      } catch (error) {
        console.error('Failed to mark as completed:', error);
      }
    }

    // Clear resume position from localStorage
    localStorage.removeItem(storageKey);

    // For series, auto-play next episode
    if (isSeries && currentEpisode) {
      const nextEpisode = getNextEpisode();
      if (nextEpisode) {
        playEpisode(nextEpisode);
      } else {
        console.log('Series completed - no more episodes');
      }
    } else {
      console.log('Video playback completed');
    }
  };

  // Get next episode in the series
  const getNextEpisode = (): Episode | null => {
    if (!currentEpisode || episodes.length === 0) return null;

    // Sort episodes by season and episode number
    const sortedEpisodes = [...episodes].sort((a, b) => {
      if (a.season_number !== b.season_number) {
        return a.season_number - b.season_number;
      }
      return a.episode_number - b.episode_number;
    });

    // Find current episode index
    const currentIndex = sortedEpisodes.findIndex(
      ep => ep.season_number === currentEpisode.season_number &&
            ep.episode_number === currentEpisode.episode_number
    );

    // Return next episode if exists
    if (currentIndex >= 0 && currentIndex < sortedEpisodes.length - 1) {
      return sortedEpisodes[currentIndex + 1];
    }

    return null;
  };

  // Get previous episode in the series
  const getPreviousEpisode = (): Episode | null => {
    if (!currentEpisode || episodes.length === 0) return null;

    // Sort episodes by season and episode number
    const sortedEpisodes = [...episodes].sort((a, b) => {
      if (a.season_number !== b.season_number) {
        return a.season_number - b.season_number;
      }
      return a.episode_number - b.episode_number;
    });

    // Find current episode index
    const currentIndex = sortedEpisodes.findIndex(
      ep => ep.season_number === currentEpisode.season_number &&
            ep.episode_number === currentEpisode.episode_number
    );

    // Return previous episode if exists
    if (currentIndex > 0) {
      return sortedEpisodes[currentIndex - 1];
    }

    return null;
  };

  // Play a specific episode
  const playEpisode = (episode: Episode) => {
    router.push(`/watch/${id}?season=${episode.season_number}&episode=${episode.episode_number}`);
  };

  // Generate presigned URL from S3 storage key
  const getPresignedVideoUrl = async (fileStorageKey: string): Promise<string> => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/content/video-url/${encodeURIComponent(fileStorageKey)}`
      );

      if (!response.ok) {
        throw new Error(`Failed to get presigned URL: ${response.statusText}`);
      }

      const data = await response.json();
      return data.url;
    } catch (error) {
      console.error('Error getting presigned URL:', error);
      throw error;
    }
  };

  // Handle playback errors
  const handleVideoError = (error: any) => {
    console.error('Video playback error:', error);

    if (error.code === 'UNAUTHORIZED') {
      // Redirect to login or purchase page
      router.push(`/login?redirect=/watch/${id}`);
    } else if (error.code === 'FORBIDDEN') {
      // Redirect to purchase page
      router.push(`/purchase/${id}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="flex items-center space-x-3">
          <div className="animate-spin w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full"></div>
          <span className="text-white text-lg">Loading content...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-red-500 text-4xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-white mb-4">Content Error</h1>
          <p className="text-gray-400 mb-6">{error}</p>
          <div className="space-y-3">
            <button
              onClick={() => window.location.reload()}
              className="btn-primary w-full"
            >
              Try Again
            </button>
            <button
              onClick={() => router.push('/')}
              className="btn-secondary w-full"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Content Not Found</h1>
          <p className="text-gray-400 mb-6">The requested content could not be found.</p>
          <button
            onClick={() => router.push('/')}
            className="btn-primary"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-950">
      {/* Video Player Container */}
      <div className="relative">
        {!content.video_url && isSeries && currentEpisode ? (
          <div className="w-full aspect-video max-h-screen bg-dark-900 flex items-center justify-center">
            <div className="text-center px-6 py-12 max-w-md">
              <div className="mb-6">
                <svg className="w-20 h-20 mx-auto text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">
                Episódio Não Disponível
              </h2>
              <p className="text-gray-400 mb-2">
                O vídeo para <span className="text-white font-semibold">S{currentEpisode.season_number}E{currentEpisode.episode_number}</span> ainda não foi carregado.
              </p>
              <p className="text-sm text-gray-500 mb-6">
                Por favor, tente outro episódio ou aguarde o upload deste conteúdo.
              </p>
              <button
                onClick={() => router.push(`/series/${id}`)}
                className="btn-primary"
              >
                Ver Todos os Episódios
              </button>
            </div>
          </div>
        ) : (
          <VideoPlayer
            contentId={content.id}
            title={content.title}
            subtitle={content.description}
            accessToken={accessToken || undefined}
            autoplay={true}
            poster={content.poster}
            startTime={resumePosition}
            videoUrl={content.video_url}
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleVideoEnded}
            onError={handleVideoError}
            onBackToCatalog={() => router.push('/dashboard')}
            className="w-full aspect-video max-h-screen"
          />
        )}
      </div>

      {/* Content Info (shown below player on mobile, overlay on desktop) */}
      <div className="lg:absolute lg:top-0 lg:left-0 lg:right-0 lg:bottom-0 lg:pointer-events-none">
        <div className="lg:absolute lg:bottom-20 lg:left-8 lg:right-8 lg:pointer-events-auto">
          <div className="bg-dark-900/90 backdrop-blur-sm rounded-lg p-6 lg:max-w-2xl">
            <h1 className="text-2xl lg:text-3xl font-bold text-white mb-2">
              {content.title}
            </h1>

            {content.description && (
              <p className="text-gray-300 mb-4 leading-relaxed">
                {content.description}
              </p>
            )}

            <div className="flex items-center space-x-4 text-sm text-gray-400">
              {content.duration && (
                <span>{Math.floor(content.duration / 60)}m</span>
              )}

              {content.status === 'ready' && (
                <span className="text-green-400">✓ Ready</span>
              )}

              {content.status === 'processing' && (
                <span className="text-yellow-400">⏳ Processing</span>
              )}

              {content.price_cents > 0 ? (
                <span className="text-primary-400">
                  Premium Content
                </span>
              ) : (
                <span className="text-green-400">Free</span>
              )}
            </div>

            {/* Episode Navigation (for series) */}
            {isSeries && episodes.length > 0 && (
              <div className="mt-6 space-y-4">
                {/* Current Episode Info */}
                {currentEpisode && (
                  <div className="p-4 bg-dark-800/60 rounded-lg border border-white/10">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold text-white">
                        S{currentEpisode.season_number}E{currentEpisode.episode_number}: {currentEpisode.title}
                      </h3>
                      {currentEpisode.duration_minutes && (
                        <span className="text-xs text-gray-400">
                          {currentEpisode.duration_minutes}min
                        </span>
                      )}
                    </div>
                    {currentEpisode.description && (
                      <p className="text-xs text-gray-400 line-clamp-2">
                        {currentEpisode.description}
                      </p>
                    )}
                  </div>
                )}

                {/* Season Selector Dropdown */}
                <div className="p-4 bg-dark-800/60 rounded-lg border border-white/10">
                  <label className="block text-xs font-semibold text-gray-400 mb-2">
                    Selecionar Temporada e Episódio
                  </label>
                  <select
                    value={selectedSeason}
                    onChange={(e) => {
                      const season = Number(e.target.value);
                      setSelectedSeason(season);
                      // Auto-play first episode of selected season
                      const firstEp = episodes.find(ep => ep.season_number === season);
                      if (firstEp) playEpisode(firstEp);
                    }}
                    className="w-full mb-3 px-3 py-2 bg-dark-700 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-primary-500"
                  >
                    {Array.from(new Set(episodes.map(ep => ep.season_number)))
                      .sort((a, b) => a - b)
                      .map(season => (
                        <option key={season} value={season}>
                          Temporada {season}
                        </option>
                      ))}
                  </select>

                  {/* Episode List for Selected Season */}
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {episodes
                      .filter(ep => ep.season_number === selectedSeason)
                      .map(ep => (
                        <button
                          key={ep.id}
                          onClick={() => playEpisode(ep)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors ${
                            currentEpisode?.id === ep.id
                              ? 'bg-primary-600 text-white'
                              : 'bg-dark-700 hover:bg-dark-600 text-gray-300'
                          }`}
                        >
                          <span className="text-sm font-medium">
                            Ep. {ep.episode_number}: {ep.title}
                          </span>
                          <div className="flex items-center space-x-2">
                            {ep.duration_minutes && (
                              <span className="text-xs text-gray-400">
                                {ep.duration_minutes}min
                              </span>
                            )}
                            {!ep.video_url && (
                              <span className="text-xs text-yellow-400">
                                Em breve
                              </span>
                            )}
                          </div>
                        </button>
                      ))}
                  </div>
                </div>

                {/* Navigation Buttons */}
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      const prevEp = getPreviousEpisode();
                      if (prevEp) playEpisode(prevEp);
                    }}
                    disabled={!getPreviousEpisode()}
                    className="flex-1 px-4 py-2 bg-dark-700 hover:bg-dark-600 disabled:bg-dark-800 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-sm text-white font-medium transition-colors flex items-center justify-center space-x-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    <span>Anterior</span>
                  </button>

                  <button
                    onClick={() => {
                      const nextEp = getNextEpisode();
                      if (nextEp) playEpisode(nextEp);
                    }}
                    disabled={!getNextEpisode()}
                    className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-500 disabled:bg-dark-800 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-sm text-white font-medium transition-colors flex items-center justify-center space-x-2"
                  >
                    <span>Próximo</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center space-x-3 mt-6">
              <button className="btn-icon bg-dark-700 hover:bg-dark-600">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                </svg>
              </button>

              <button className="btn-icon bg-dark-700 hover:bg-dark-600">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M15 8a3 3 0 10-6 0v5a2 2 0 104 0V8z" clipRule="evenodd" />
                  <path d="M14 8v7a1 1 0 11-2 0V8a1 1 0 011-1h1z" />
                </svg>
              </button>

              <button className="btn-icon bg-dark-700 hover:bg-dark-600">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Resume Position Prompt */}
      {resumePosition > 30 && showResumeModal && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50">
          <div className="bg-dark-800 border border-white/20 rounded-lg p-4 shadow-lg">
            <p className="text-white text-sm mb-3">
              Resume from {Math.floor(resumePosition / 60)}:
              {String(Math.floor(resumePosition % 60)).padStart(2, '0')}?
            </p>
            <div className="flex space-x-2">
              <button
                onClick={() => {
                  setResumePosition(0);
                  setShowResumeModal(false);
                }}
                className="btn-secondary text-xs px-3 py-1"
              >
                Start Over
              </button>
              <button
                onClick={() => {
                  // Close the modal - video will resume from resumePosition automatically
                  setShowResumeModal(false);
                }}
                className="btn-primary text-xs px-3 py-1"
              >
                Resume
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}