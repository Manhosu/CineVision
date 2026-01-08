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
  // Video streaming fields
  video_url?: string; // Direct video URL
  hls_master_url?: string; // HLS master playlist URL
  created_at?: string;
  updated_at?: string;
  // Purchase related fields (when movie is purchased)
  purchased_at?: string;
  access_token?: string;
  access_expires_at?: string;
}

/**
 * Helper function to determine effective availability based on video and telegram fields
 */
export function getEffectiveAvailability(movie: Movie): 'SITE' | 'TELEGRAM' | 'BOTH' | 'UNAVAILABLE' {
  const hasVideo = !!(movie.video_url || movie.hls_master_url);
  const hasTelegram = !!movie.telegram_group_link;

  if (hasVideo && hasTelegram) return 'BOTH';
  if (hasVideo && !hasTelegram) return 'SITE';
  if (!hasVideo && hasTelegram) return 'TELEGRAM';
  return 'UNAVAILABLE';
}