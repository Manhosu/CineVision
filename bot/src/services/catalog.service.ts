import axios from 'axios';

interface Movie {
  id: string;
  title: string;
  price_cents: number;
  poster_url?: string;
  thumbnail_url?: string;
  trailer_url?: string;
  description?: string;
  synopsis?: string;
  release_year?: number;
  genres?: string[];
  imdb_rating?: number;
  duration_minutes?: number;
  status?: string;
  availability?: string;
}

interface PaginatedMovies {
  movies: Movie[];
  total: number;
  page: number;
  totalPages: number;
}

interface CategoryMapping {
  [key: string]: {
    genre?: string;
    sort?: string;
    filter?: string;
  };
}

export class CatalogService {
  private baseUrl: string;
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private cacheDuration = 5 * 60 * 1000; // 5 minutes

  // Mapeamento de categorias do bot para filtros da API
  private categoryMap: CategoryMapping = {
    'new_releases': { sort: 'newest' },
    'popular': { sort: 'popular' },
    'action': { genre: 'Ação' },
    'comedy': { genre: 'Comédia' },
    'romance': { genre: 'Romance' },
    'horror': { genre: 'Terror' },
    'drama': { genre: 'Drama' },
    'adventure': { genre: 'Aventura' },
    'scifi': { genre: 'Ficção Científica' },
    'animation': { genre: 'Animação' },
    'documentary': { genre: 'Documentário' },
    'thriller': { genre: 'Suspense' },
  };

  constructor() {
    this.baseUrl = process.env.BACKEND_API_URL || process.env.BACKEND_URL || 'http://localhost:3001/api/v1';
  }

  /**
   * Busca filmes do backend com filtros
   */
  async fetchMovies(category: string = 'new_releases', page: number = 1, limit: number = 10): Promise<PaginatedMovies> {
    try {
      const cacheKey = `movies_${category}_${page}_${limit}`;

      // Check cache
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }

      // Get category filters
      const filters = this.categoryMap[category] || { sort: 'newest' };

      // Build query params
      const params: any = {
        page,
        limit,
      };

      if (filters.genre) {
        params.genre = filters.genre;
      }

      if (filters.sort) {
        params.sort = filters.sort;
      }

      // Make API request
      const response = await axios.get(`${this.baseUrl}/content/movies`, {
        params,
        timeout: 10000,
      });

      const result: PaginatedMovies = {
        movies: response.data.movies || response.data.data || [],
        total: response.data.total || 0,
        page: response.data.page || page,
        totalPages: response.data.totalPages || Math.ceil((response.data.total || 0) / limit),
      };

      // Cache result
      this.saveToCache(cacheKey, result);

      return result;
    } catch (error) {
      console.error('Error fetching movies from backend:', error);

      // Return empty result on error
      return {
        movies: [],
        total: 0,
        page: 1,
        totalPages: 0,
      };
    }
  }

  /**
   * Busca detalhes de um filme específico
   */
  async fetchMovieById(movieId: string): Promise<Movie | null> {
    try {
      const cacheKey = `movie_${movieId}`;

      // Check cache
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }

      // Make API request
      const response = await axios.get(`${this.baseUrl}/content/movies/${movieId}`, {
        timeout: 10000,
      });

      const movie = response.data;

      // Cache result
      this.saveToCache(cacheKey, movie);

      return movie;
    } catch (error) {
      console.error(`Error fetching movie ${movieId}:`, error);
      return null;
    }
  }

  /**
   * Busca filmes por título
   */
  async searchMovies(query: string, page: number = 1, limit: number = 10): Promise<PaginatedMovies> {
    try {
      const cacheKey = `search_${query}_${page}_${limit}`;

      // Check cache
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }

      // Make API request
      const response = await axios.get(`${this.baseUrl}/content/movies`, {
        params: {
          page,
          limit,
          search: query,
        },
        timeout: 10000,
      });

      const result: PaginatedMovies = {
        movies: response.data.movies || response.data.data || [],
        total: response.data.total || 0,
        page: response.data.page || page,
        totalPages: response.data.totalPages || Math.ceil((response.data.total || 0) / limit),
      };

      // Cache result (shorter duration for search)
      this.saveToCache(cacheKey, result, 2 * 60 * 1000); // 2 minutes

      return result;
    } catch (error) {
      console.error('Error searching movies:', error);

      return {
        movies: [],
        total: 0,
        page: 1,
        totalPages: 0,
      };
    }
  }

  /**
   * Busca categorias disponíveis
   */
  async fetchCategories(): Promise<any[]> {
    try {
      const cacheKey = 'categories';

      // Check cache
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }

      // Make API request
      const response = await axios.get(`${this.baseUrl}/content/categories`, {
        timeout: 10000,
      });

      const categories = response.data || [];

      // Cache result (longer duration for categories)
      this.saveToCache(cacheKey, categories, 30 * 60 * 1000); // 30 minutes

      return categories;
    } catch (error) {
      console.error('Error fetching categories:', error);
      return [];
    }
  }

  /**
   * Formata filme para exibição no Telegram
   */
  formatMovieForDisplay(movie: Movie): {
    title: string;
    price: string;
    description: string;
    poster?: string;
  } {
    const priceBRL = (movie.price_cents / 100).toFixed(2).replace('.', ',');

    return {
      title: movie.title,
      price: `R$ ${priceBRL}`,
      description: movie.synopsis || movie.description || 'Sem descrição disponível',
      poster: movie.poster_url || movie.thumbnail_url,
    };
  }

  /**
   * Invalida cache (chamado quando novo filme é publicado)
   */
  invalidateCache(pattern?: string): void {
    if (pattern) {
      // Invalidate specific pattern
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      }
    } else {
      // Clear all cache
      this.cache.clear();
    }
  }

  /**
   * Get from cache
   */
  private getFromCache(key: string): any | null {
    const cached = this.cache.get(key);

    if (!cached) {
      return null;
    }

    // Check if expired
    if (Date.now() - cached.timestamp > this.cacheDuration) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  /**
   * Save to cache
   */
  private saveToCache(key: string, data: any, duration?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });

    // Auto-cleanup after duration
    setTimeout(() => {
      this.cache.delete(key);
    }, duration || this.cacheDuration);
  }

  /**
   * Get category name in Portuguese
   */
  getCategoryName(category: string): string {
    const names: { [key: string]: string } = {
      'new_releases': '🔥 LANÇAMENTOS 2024',
      'popular': '⭐ MAIS ASSISTIDOS',
      'action': '🎭 FILMES DE AÇÃO',
      'comedy': '😂 COMÉDIAS',
      'romance': '❤️ ROMANCES',
      'horror': '👻 FILMES DE TERROR',
      'drama': '🎬 DRAMAS',
      'adventure': '🗺️ AVENTURAS',
      'scifi': '🚀 FICÇÃO CIENTÍFICA',
      'animation': '🎨 ANIMAÇÕES',
      'documentary': '📹 DOCUMENTÁRIOS',
      'thriller': '🔪 SUSPENSES',
    };

    return names[category] || '🎬 FILMES';
  }
}
