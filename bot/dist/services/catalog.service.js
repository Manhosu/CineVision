"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CatalogService = void 0;
const axios_1 = __importDefault(require("axios"));
class CatalogService {
    constructor() {
        this.cache = new Map();
        this.cacheDuration = 5 * 60 * 1000;
        this.categoryMap = {
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
        this.baseUrl = process.env.BACKEND_API_URL || process.env.BACKEND_URL || 'http://localhost:3001/api/v1';
    }
    async fetchMovies(category = 'new_releases', page = 1, limit = 10) {
        try {
            const cacheKey = `movies_${category}_${page}_${limit}`;
            const cached = this.getFromCache(cacheKey);
            if (cached) {
                return cached;
            }
            const filters = this.categoryMap[category] || { sort: 'newest' };
            const params = {
                page,
                limit,
            };
            if (filters.genre) {
                params.genre = filters.genre;
            }
            if (filters.sort) {
                params.sort = filters.sort;
            }
            const response = await axios_1.default.get(`${this.baseUrl}/content/movies`, {
                params,
                timeout: 10000,
            });
            const result = {
                movies: response.data.movies || response.data.data || [],
                total: response.data.total || 0,
                page: response.data.page || page,
                totalPages: response.data.totalPages || Math.ceil((response.data.total || 0) / limit),
            };
            this.saveToCache(cacheKey, result);
            return result;
        }
        catch (error) {
            console.error('Error fetching movies from backend:', error);
            return {
                movies: [],
                total: 0,
                page: 1,
                totalPages: 0,
            };
        }
    }
    async fetchMovieById(movieId) {
        try {
            const cacheKey = `movie_${movieId}`;
            const cached = this.getFromCache(cacheKey);
            if (cached) {
                return cached;
            }
            const response = await axios_1.default.get(`${this.baseUrl}/content/movies/${movieId}`, {
                timeout: 10000,
            });
            const movie = response.data;
            this.saveToCache(cacheKey, movie);
            return movie;
        }
        catch (error) {
            console.error(`Error fetching movie ${movieId}:`, error);
            return null;
        }
    }
    async searchMovies(query, page = 1, limit = 10) {
        try {
            const cacheKey = `search_${query}_${page}_${limit}`;
            const cached = this.getFromCache(cacheKey);
            if (cached) {
                return cached;
            }
            const response = await axios_1.default.get(`${this.baseUrl}/content/movies`, {
                params: {
                    page,
                    limit,
                    search: query,
                },
                timeout: 10000,
            });
            const result = {
                movies: response.data.movies || response.data.data || [],
                total: response.data.total || 0,
                page: response.data.page || page,
                totalPages: response.data.totalPages || Math.ceil((response.data.total || 0) / limit),
            };
            this.saveToCache(cacheKey, result, 2 * 60 * 1000);
            return result;
        }
        catch (error) {
            console.error('Error searching movies:', error);
            return {
                movies: [],
                total: 0,
                page: 1,
                totalPages: 0,
            };
        }
    }
    async fetchCategories() {
        try {
            const cacheKey = 'categories';
            const cached = this.getFromCache(cacheKey);
            if (cached) {
                return cached;
            }
            const response = await axios_1.default.get(`${this.baseUrl}/content/categories`, {
                timeout: 10000,
            });
            const categories = response.data || [];
            this.saveToCache(cacheKey, categories, 30 * 60 * 1000);
            return categories;
        }
        catch (error) {
            console.error('Error fetching categories:', error);
            return [];
        }
    }
    formatMovieForDisplay(movie) {
        const priceBRL = (movie.price_cents / 100).toFixed(2).replace('.', ',');
        return {
            title: movie.title,
            price: `R$ ${priceBRL}`,
            description: movie.synopsis || movie.description || 'Sem descrição disponível',
            poster: movie.poster_url || movie.thumbnail_url,
        };
    }
    invalidateCache(pattern) {
        if (pattern) {
            for (const key of this.cache.keys()) {
                if (key.includes(pattern)) {
                    this.cache.delete(key);
                }
            }
        }
        else {
            this.cache.clear();
        }
    }
    getFromCache(key) {
        const cached = this.cache.get(key);
        if (!cached) {
            return null;
        }
        if (Date.now() - cached.timestamp > this.cacheDuration) {
            this.cache.delete(key);
            return null;
        }
        return cached.data;
    }
    saveToCache(key, data, duration) {
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
        });
        setTimeout(() => {
            this.cache.delete(key);
        }, duration || this.cacheDuration);
    }
    getCategoryName(category) {
        const names = {
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
exports.CatalogService = CatalogService;
//# sourceMappingURL=catalog.service.js.map