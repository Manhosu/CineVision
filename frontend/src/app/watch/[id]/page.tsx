'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import VideoPlayer from '@/components/VideoPlayer/VideoPlayer';
import { VideoContent } from '@/types/video';

interface WatchPageProps {
  params: { id: string };
}

export default function WatchPage({ params }: WatchPageProps) {
  const router = useRouter();
  const { id } = useParams();
  const searchParams = useSearchParams();
  const selectedLanguageId = searchParams.get('lang');

  const [content, setContent] = useState<VideoContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [resumePosition, setResumePosition] = useState<number>(0);
  const [showResumeModal, setShowResumeModal] = useState<boolean>(true);

  // Fetch content details and access token
  useEffect(() => {
    const fetchContent = async () => {
      if (!id) return;

      try {
        setLoading(true);
        setError(null);

        // Get content details
        const contentResponse = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/v1/content/movies/${id}`,
          {
            credentials: 'include',
          }
        );

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

        setContent(contentData);

        // Get access token if authenticated
        const token = localStorage.getItem('access_token');
        if (token) {
          setAccessToken(token);

          // Get resume position from backend if user is authenticated
          try {
            const progressResponse = await fetch(
              `${process.env.NEXT_PUBLIC_API_URL}/api/v1/purchases/progress/${id}`,
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
            const savedPosition = localStorage.getItem(`resume_${id}`);
            if (savedPosition) {
              setResumePosition(parseFloat(savedPosition));
            }
          }
        } else {
          // Fallback to localStorage for unauthenticated users
          const savedPosition = localStorage.getItem(`resume_${id}`);
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
  }, [id, selectedLanguageId]);

  // Save resume position
  const handleTimeUpdate = (currentTime: number) => {
    if (!id || currentTime < 30) return; // Don't save very early positions

    const token = localStorage.getItem('access_token');
    if (token && content) {
      // Save to backend if authenticated
      try {
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/purchases/progress/${id}`, {
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
          localStorage.setItem(`resume_${id}`, currentTime.toString());
        });
      } catch (error) {
        console.error('Failed to save progress to backend:', error);
        // Fallback to localStorage
        localStorage.setItem(`resume_${id}`, currentTime.toString());
      }
    } else {
      // Fallback to localStorage for unauthenticated users
      localStorage.setItem(`resume_${id}`, currentTime.toString());
    }
  };

  // Handle video end
  const handleVideoEnded = () => {
    if (!id) return;

    const token = localStorage.getItem('access_token');
    if (token && content) {
      // Mark as completed in backend
      try {
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/purchases/progress/${id}`, {
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
    localStorage.removeItem(`resume_${id}`);

    // Redirect to next episode or related content
    // For now, just show completion message
    console.log('Video playback completed');
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