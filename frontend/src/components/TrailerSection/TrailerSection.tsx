'use client';

import { useState } from 'react';
import { Movie } from '@/types/movie';

interface TrailerSectionProps {
  movie: Movie;
}

export default function TrailerSection({ movie }: TrailerSectionProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  // Extract YouTube video ID from URL
  const getYouTubeVideoId = (url?: string): string | null => {
    if (!url) return null;

    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /^([a-zA-Z0-9_-]{11})$/ // Direct video ID
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  };

  const videoId = getYouTubeVideoId(movie.trailer_url);

  // If no trailer URL, don't render anything
  if (!movie.trailer_url || !videoId) {
    return null;
  }

  const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`;
  const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

  return (
    <div className="bg-dark-800/50 backdrop-blur-sm border border-white/10 rounded-xl p-6 sm:p-8 tv:p-12">
      <h2 className="text-2xl sm:text-3xl tv:text-4xl font-bold text-white mb-4 tv:mb-6">
        Trailer
      </h2>

      <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
        {!isPlaying ? (
          // Thumbnail with play button
          <button
            className="absolute inset-0 w-full h-full cursor-pointer group"
            onClick={() => setIsPlaying(true)}
            aria-label="Reproduzir trailer"
          >
            <img
              src={thumbnailUrl}
              alt={`${movie.title} - Trailer`}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 rounded-lg"
            />

            {/* Dark overlay */}
            <div className="absolute inset-0 bg-black/30 group-hover:bg-black/20 transition-colors rounded-lg" />

            {/* Play button */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-16 h-16 sm:w-20 sm:h-20 tv:w-24 tv:h-24 bg-primary-600 rounded-full flex items-center justify-center transform group-hover:scale-110 transition-transform duration-300 shadow-lg">
                <svg className="w-8 h-8 sm:w-10 sm:h-10 tv:w-12 tv:h-12 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>

            {/* Hover text */}
            <div className="absolute bottom-4 left-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              <p className="text-white text-sm sm:text-base tv:text-lg font-semibold">
                Clique para assistir ao trailer
              </p>
            </div>
          </button>
        ) : (
          // YouTube player inline
          <iframe
            src={embedUrl}
            title={`${movie.title} - Trailer`}
            className="absolute inset-0 w-full h-full rounded-lg"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        )}
      </div>
    </div>
  );
}
