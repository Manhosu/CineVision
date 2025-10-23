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
  age_rating?: string; // Classificação indicativa: 'L' | '10' | '12' | '14' | '16' | '18'
  release_year?: number;
  duration_minutes?: number;
  genres?: string[];
  featured?: boolean;
  status?: string; // From database: 'ACTIVE' | 'INACTIVE' | 'PUBLISHED'
  availability?: string; // From database: 'SITE' | 'TELEGRAM' | 'BOTH'
  created_at?: string;
  updated_at?: string;
  // Purchase related fields (when movie is purchased)
  purchased_at?: string;
  access_token?: string;
  access_expires_at?: string;
}