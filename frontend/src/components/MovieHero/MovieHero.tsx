'use client';

import { Movie } from '@/types/movie';

interface MovieHeroProps {
  movie: Movie;
}

export default function MovieHero({ movie }: MovieHeroProps) {
  return (
    <div className="relative h-[30vh] sm:h-[35vh] lg:h-[40vh] max-h-[400px] overflow-hidden">

      {/* Content - Minimal overlay badge */}
      <div className="relative z-10 h-full flex items-start justify-end">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-24">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2 bg-primary-600/90 backdrop-blur-md rounded-lg shadow-xl">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
              </svg>
              <span className="text-white text-sm font-bold">FILME EM DESTAQUE</span>
            </div>

            {movie.imdb_rating && (
              <div className="flex items-center gap-2 px-4 py-2 bg-yellow-500/90 backdrop-blur-md rounded-lg shadow-xl">
                <svg className="w-5 h-5 text-white fill-current" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span className="text-white text-sm font-bold">{movie.imdb_rating.toFixed(1)}/10</span>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
