import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { SupabaseRestClient } from '../../config/supabase-rest-client';

export enum ContentStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
}

export enum ContentType {
  MOVIE = 'movie',
  SERIES = 'series',
  DOCUMENTARY = 'documentary',
}

@Injectable()
export class ContentSupabaseService {
  private readonly logger = new Logger(ContentSupabaseService.name);

  constructor(private readonly supabaseClient: SupabaseRestClient) {}

  async findAllMovies(page = 1, limit = 20, genre?: string, sort = 'created_at') {
    try {
      this.logger.debug(`Finding movies: page=${page}, limit=${limit}, genre=${genre}, sort=${sort}`);

      // Build query options
      const queryOptions: any = {
        where: {
          status: ContentStatus.PUBLISHED,
          content_type: ContentType.MOVIE
        },
        limit,
        offset: (page - 1) * limit
      };

      // Add sorting
      switch (sort) {
        case 'newest':
          queryOptions.order = { column: 'created_at', ascending: false };
          break;
        case 'popular':
          queryOptions.order = { column: 'views_count', ascending: false };
          break;
        case 'rating':
          queryOptions.order = { column: 'imdb_rating', ascending: false };
          break;
        case 'price_low':
          queryOptions.order = { column: 'price_cents', ascending: true };
          break;
        case 'price_high':
          queryOptions.order = { column: 'price_cents', ascending: false };
          break;
        default:
          queryOptions.order = { column: 'created_at', ascending: false };
      }

      const movies = await this.supabaseClient.select('content', queryOptions);

      // Get total count for pagination
      const countWhere = {
        status: ContentStatus.PUBLISHED,
        content_type: ContentType.MOVIE
      };
      const totalCount = await this.supabaseClient.count('content', countWhere);

      return {
        movies,
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit),
          hasNext: page < Math.ceil(totalCount / limit),
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      this.logger.error('Error finding movies:', error);
      throw error;
    }
  }

  async findMovieById(id: string) {
    try {
      this.logger.debug(`Finding movie by ID: ${id}`);

      const queryOptions = {
        where: {
          id,
          status: ContentStatus.PUBLISHED
        }
      };

      const movie = await this.supabaseClient.selectOne('content', queryOptions);

      if (!movie) {
        throw new NotFoundException('Movie not found');
      }

      return movie;
    } catch (error) {
      this.logger.error(`Error finding movie by ID ${id}:`, error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw error;
    }
  }

  async findRelatedMovies(movieId: string, genres: string[] = [], limit = 6) {
    try {
      this.logger.debug(`Finding related movies for ${movieId}, genres: ${genres.join(', ')}`);

      const queryOptions: any = {
        where: {
          status: ContentStatus.PUBLISHED,
          content_type: ContentType.MOVIE
        },
        limit
      };

      const relatedMovies = await this.supabaseClient.select('content', queryOptions);

      // Filter out the current movie and shuffle results
      const filtered = relatedMovies.filter(movie => movie.id !== movieId);
      const shuffled = filtered.sort(() => 0.5 - Math.random());
      return shuffled.slice(0, limit);
    } catch (error) {
      this.logger.error(`Error finding related movies for ${movieId}:`, error);
      throw error;
    }
  }

  async findAllCategories() {
    try {
      this.logger.debug('Finding all categories');

      const queryOptions = {
        order: { column: 'name', ascending: true }
      };

      return await this.supabaseClient.select('categories', queryOptions);
    } catch (error) {
      this.logger.error('Error finding categories:', error);
      throw error;
    }
  }

  async findAllContent() {
    try {
      this.logger.debug('Finding all content');

      const queryOptions = {
        where: {
          status: ContentStatus.PUBLISHED
        },
        order: { column: 'created_at', ascending: false }
      };

      return await this.supabaseClient.select('content', queryOptions);
    } catch (error) {
      this.logger.error('Error finding all content:', error);
      throw error;
    }
  }

  async findTop10Films() {
    try {
      this.logger.debug('Finding top 10 films');

      const queryOptions = {
        where: {
          status: ContentStatus.PUBLISHED,
          content_type: ContentType.MOVIE
        },
        order: { column: 'purchases_count', ascending: false },
        limit: 10
      };

      return await this.supabaseClient.select('content', queryOptions);
    } catch (error) {
      this.logger.error('Error finding top 10 films:', error);
      throw error;
    }
  }

  async findTop10Series() {
    try {
      this.logger.debug('Finding top 10 series');

      const queryOptions = {
        where: {
          status: ContentStatus.PUBLISHED,
          content_type: ContentType.SERIES
        },
        order: { column: 'purchases_count', ascending: false },
        limit: 10
      };

      return await this.supabaseClient.select('content', queryOptions);
    } catch (error) {
      this.logger.error('Error finding top 10 series:', error);
      throw error;
    }
  }

  async deleteAllMovies() {
    try {
      this.logger.debug('Deleting all movies from database');

      const deleteWhere = {
        content_type: ContentType.MOVIE
      };

      const deletedMovies = await this.supabaseClient.delete('content', deleteWhere);
      
      this.logger.log(`Successfully deleted ${deletedMovies.length} movies`);
      return {
        success: true,
        deletedCount: deletedMovies.length,
        deletedMovies
      };
    } catch (error) {
      this.logger.error('Error deleting all movies:', error);
      throw error;
    }
  }

  async deleteAllContent() {
    try {
      this.logger.debug('Deleting all content from database');

      // Delete all content regardless of type
      const deletedContent = await this.supabaseClient.delete('content', {});
      
      this.logger.log(`Successfully deleted ${deletedContent.length} content items`);
      return {
        success: true,
        deletedCount: deletedContent.length,
        deletedContent
      };
    } catch (error) {
      this.logger.error('Error deleting all content:', error);
      throw error;
    }
  }
}