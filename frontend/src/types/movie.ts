export interface ContentLanguage {
  id: string;
  language_name?: string;
  video_url?: string;
  hls_master_url?: string;
  upload_status?: string; // pending, processing, completed, failed
}

export interface Movie {
  id: string;
  title: string;
  description: string;
  thumbnail_url: string;
  poster_url?: string;
  backdrop_url?: string;
  trailer_url?: string;
  price_cents: number;
  imdb_rating?: number;
  age_rating?: string; // Classificacao indicativa: 'L' | '10' | '12' | '14' | '16' | '18'
  release_year?: number;
  duration_minutes?: number;
  genres?: string[];
  featured?: boolean;
  status?: string; // From database: 'ACTIVE' | 'INACTIVE' | 'PUBLISHED'
  availability?: string; // From database: 'SITE' | 'TELEGRAM' | 'BOTH'
  telegram_group_link?: string; // Telegram group invite link
  // Video streaming fields (legacy - on content table)
  video_url?: string; // Direct video URL
  hls_master_url?: string; // HLS master playlist URL
  // Language-based video storage (new system)
  content_languages?: ContentLanguage[];
  created_at?: string;
  updated_at?: string;
  // Purchase related fields (when movie is purchased)
  purchased_at?: string;
  access_token?: string;
  access_expires_at?: string;
}

/**
 * Helper function to determine effective availability based on video and telegram fields
 * Checks both legacy video_url fields AND content_languages for uploaded videos
 */
export function getEffectiveAvailability(movie: Movie): 'SITE' | 'TELEGRAM' | 'BOTH' | 'UNAVAILABLE' {
  // Check legacy video fields on content table
  let hasVideo = !!(movie.video_url || movie.hls_master_url);

  // Also check content_languages for uploaded videos (new system)
  if (!hasVideo && movie.content_languages && movie.content_languages.length > 0) {
    // Check if any language has a completed video upload
    hasVideo = movie.content_languages.some(
      lang => (lang.video_url || lang.hls_master_url) && lang.upload_status === 'completed'
    );
  }

  const hasTelegram = !!movie.telegram_group_link;

  if (hasVideo && hasTelegram) return 'BOTH';
  if (hasVideo && !hasTelegram) return 'SITE';
  if (!hasVideo && hasTelegram) return 'TELEGRAM';
  return 'UNAVAILABLE';
}