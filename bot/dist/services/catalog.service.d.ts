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
export declare class CatalogService {
    private baseUrl;
    private cache;
    private cacheDuration;
    private categoryMap;
    constructor();
    fetchMovies(category?: string, page?: number, limit?: number): Promise<PaginatedMovies>;
    fetchMovieById(movieId: string): Promise<Movie | null>;
    searchMovies(query: string, page?: number, limit?: number): Promise<PaginatedMovies>;
    fetchCategories(): Promise<any[]>;
    formatMovieForDisplay(movie: Movie): {
        title: string;
        price: string;
        description: string;
        poster?: string;
    };
    invalidateCache(pattern?: string): void;
    private getFromCache;
    private saveToCache;
    getCategoryName(category: string): string;
}
export {};
//# sourceMappingURL=catalog.service.d.ts.map