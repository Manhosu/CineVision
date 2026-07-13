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
  is_release?: boolean; // Badge "Novidade" no card (overlay CSS)
  // Igor (09/07): bot promocional vinculado (Cenário 3+). Só aparece na
  // resposta se is_release=true E o bot promo está ativo (backend valida).
  promotional_bot_id?: string | null;
  promotional_bot_username?: string | null;
  is_new_season?: boolean; // Badge "Nova Temporada" no card (overlay CSS)
  // Igor (04/06): pré-venda
  is_presale?: boolean;
  presale_price_cents?: number | null;
  presale_release_at?: string | null;
  presale_purchases_count?: number;
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
  // Discount related fields
  discount_percentage?: number;
  discounted_price_cents?: number;
  original_price_cents?: number;
  is_flash_promo?: boolean;
  promo_ends_at?: string; // ISO timestamp of when the promotion ends
  // Quality label set by admin
  quality_label?: string; // 'HD CAM' | 'CINEMA' | 'FULL HD' | 'EXCLUSIVA'
  // Audio type
  audio_type?: string; // 'dubbed' | 'subtitled' | 'dubbed_subtitled'
  // Cast and director
  cast?: string;
  director?: string;
  // Backdrop focal point position (e.g. "50% 30%")
  backdrop_position?: string;
  backdrop_position_mobile?: string;
  // Igor (13/07): logo PNG oficial do filme (opcional). Se preenchido,
  // hero renderiza <img> em vez de <h1>. Só filmes novos/importantes.
  logo_url?: string | null;
  logo_position?: string | null;
  logo_position_mobile?: string | null;
  // Content type
  content_type?: string;
  type?: string;
  // Purchase related fields (when movie is purchased)
  purchased_at?: string;
  access_token?: string;
  access_expires_at?: string;
}

/**
 * Helper function to determine effective availability based on telegram fields.
 * Content delivery is now exclusively via Telegram.
 */
export function getEffectiveAvailability(movie: Movie): 'TELEGRAM' | 'UNAVAILABLE' {
  const hasTelegram = !!movie.telegram_group_link;
  return hasTelegram ? 'TELEGRAM' : 'UNAVAILABLE';
}