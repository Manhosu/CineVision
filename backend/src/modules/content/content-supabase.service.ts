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

  /**
   * Busca inteligente usando funcao PostgreSQL com fuzzy search, unaccent e full-text search.
   * Requer que a migracao 003-smart-search.sql tenha sido executada no banco.
   */
  async searchContent(
    search: string,
    contentType?: string,
    page = 1,
    limit = 20,
    sort = 'relevance'
  ) {
    try {
      this.logger.log(`Smart search: query="${search}", type=${contentType}, page=${page}`);

      if (!search || !search.trim()) {
        return {
          movies: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
            hasNext: false,
            hasPrev: false,
          },
        };
      }

      const offset = (page - 1) * limit;

      // Call the PostgreSQL search function via RPC
      const results = await this.supabaseClient.rpc('search_content', {
        search_query: search.trim(),
        content_type_filter: contentType || null,
        result_limit: limit,
        result_offset: offset,
      });

      // Get total count for pagination
      const totalCount = await this.supabaseClient.rpc('search_content_count', {
        search_query: search.trim(),
        content_type_filter: contentType || null,
      });

      let sortedResults = Array.isArray(results) ? results : [];

      // N11 (Igor 04/05): se o RPC retornou vazio MAS o usuário tinha
      // search query, é provável que (a) a migration 003-smart-search
      // não tem a extensão unaccent ativa em produção, ou (b) a função
      // existe mas está degradada. Tenta o fallback JS-side antes de
      // devolver vazio. Isso cobre o caso de RPC succeed-but-empty —
      // que o catch sozinho não pegaria. ~50ms de overhead no path raro.
      if (sortedResults.length === 0) {
        this.logger.warn(
          `RPC search_content returned 0 for "${search}" — trying JS-side accent-insensitive fallback`,
        );
        return this.fallbackAccentInsensitiveSearch(search, contentType, page, limit);
      }

      // Apply secondary sort if not using relevance
      if (sort !== 'relevance' && sort !== 'created_at') {
        switch (sort) {
          case 'newest':
            sortedResults.sort((a: any, b: any) =>
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );
            break;
          case 'popular':
            sortedResults.sort((a: any, b: any) => (b.views_count || 0) - (a.views_count || 0));
            break;
          case 'rating':
            sortedResults.sort((a: any, b: any) => (b.imdb_rating || 0) - (a.imdb_rating || 0));
            break;
        }
      }

      const total = typeof totalCount === 'number' ? totalCount : (Array.isArray(totalCount) ? totalCount.length : 0);

      return {
        movies: sortedResults,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      this.logger.error('Error in smart search:', error);
      // N11 (Igor 04/05): a migration 003-smart-search.sql ainda não foi
      // aplicada em produção (Igor reportou que "diario" não acha
      // "Diário"). Em vez de cair em ILIKE — que não normaliza acentos
      // no Postgres sem a extensão unaccent — usamos um fallback JS:
      // baixa todos publicados do tipo e filtra in-memory por título
      // normalizado (NFD + strip diacritics). Para ~250 conteúdos é
      // O(n) e cabe em <50ms. Some o RPC for aplicado, esse path nem
      // executa.
      this.logger.warn('Falling back to JS-side accent-insensitive search');
      return this.fallbackAccentInsensitiveSearch(search, contentType, page, limit);
    }
  }

  /**
   * N11 — fallback acento-insensível em JS quando search_content RPC
   * não está disponível. Filtra in-memory após buscar todos publicados.
   */
  private async fallbackAccentInsensitiveSearch(
    search: string,
    contentType?: string,
    page = 1,
    limit = 20,
  ) {
    try {
      const where: any = { status: ContentStatus.PUBLISHED };
      if (contentType) where.content_type = contentType;

      const all = await this.supabaseClient.select('content', {
        where,
        limit: 500, // safety cap; catálogo atual é ~258
        order: { column: 'created_at', ascending: false },
      });
      this.logger.log(`[N11] fallbackAccentInsensitiveSearch loaded ${Array.isArray(all) ? all.length : 'NOT_ARRAY'} records for type=${contentType} query="${search}"`);

      // U+0300..U+036F = "Combining Diacritical Marks" block (acentos
      // separados depois da decomposição NFD). Removendo, "Mãe" → "mae".
      const normalize = (s: string) =>
        (s || '')
          .normalize('NFD')
          .replace(/[̀-ͯ]/g, '')
          .toLowerCase();

      const normalizedQuery = normalize(search.trim());
      this.logger.log(`[N11] normalizedQuery: "${normalizedQuery}" (from "${search}")`);
      if (Array.isArray(all) && all.length > 0) {
        const sample = all[0] as any;
        this.logger.log(`[N11] sample record: title="${sample?.title}" → normalized="${normalize(sample?.title)}"`);
      }

      const filtered = (Array.isArray(all) ? all : []).filter((c: any) => {
        const title = normalize(c.title);
        const description = normalize(c.description || '');
        return title.includes(normalizedQuery) || description.includes(normalizedQuery);
      });
      this.logger.log(`[N11] filtered to ${filtered.length} matches`);

      const offset = (page - 1) * limit;
      const paged = filtered.slice(offset, offset + limit);
      const total = filtered.length;

      return {
        movies: paged,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1,
        },
      };
    } catch (err) {
      this.logger.error('fallbackAccentInsensitiveSearch failed:', err);
      return {
        movies: [],
        pagination: { page, limit, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
      };
    }
  }

  async findAllMovies(page = 1, limit = 20, genre?: string, sort = 'created_at', search?: string) {
    // Use smart search when searching without genre filter
    if (search && search.trim() && !genre) {
      return this.searchContent(search, ContentType.MOVIE, page, limit, sort === 'created_at' ? 'relevance' : sort);
    }

    return this.findAllMoviesBasic(page, limit, genre, sort, search);
  }

  private async findAllMoviesBasic(page = 1, limit = 20, genre?: string, sort = 'created_at', search?: string) {
    try {
      this.logger.log(`Finding movies: page=${page}, limit=${limit}, genre=${genre}, sort=${sort}, search=${search}`);

      // Filter by category if genre is provided
      let contentIds: string[] = [];
      if (genre) {
        // Find category by name
        const category = await this.supabaseClient.selectOne('categories', {
          where: { name: genre }
        });

        if (category) {
          // Get content IDs for this category
          const associations = await this.supabaseClient.select('content_categories', {
            where: { category_id: category.id },
            select: 'content_id'
          });

          contentIds = associations.map((assoc: any) => assoc.content_id);
          this.logger.debug(`Found ${contentIds.length} content items for category ${genre}`);
        }

        // If no content found for this category, return empty result
        if (contentIds.length === 0) {
          return {
            movies: [],
            pagination: {
              page,
              limit,
              total: 0,
              totalPages: 0,
              hasNext: false,
              hasPrev: false,
            },
          };
        }
      }

      // Build query options
      const queryOptions: any = {
        where: {
          status: ContentStatus.PUBLISHED,
          content_type: ContentType.MOVIE
        },
        limit,
        offset: (page - 1) * limit
      };

      // Add category filter if genre was specified
      if (genre && contentIds.length > 0) {
        queryOptions.where.id = { in: contentIds };
      }

      // Add search filter if search term is provided (case-insensitive)
      if (search && search.trim()) {
        // Use ilike for case-insensitive pattern matching
        // %text% matches anywhere in the string (% is the wildcard for PostgREST ILIKE)
        const searchPattern = `%${search.trim()}%`;
        this.logger.log(`Adding search filter: title ilike '${searchPattern}'`);
        queryOptions.where.title = { ilike: searchPattern };
      }

      this.logger.log(`Query options: ${JSON.stringify(queryOptions, null, 2)}`);

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
      const countWhere: any = {
        status: ContentStatus.PUBLISHED,
        content_type: ContentType.MOVIE
      };

      // Add category filter to count if genre was specified
      if (genre && contentIds.length > 0) {
        countWhere.id = { in: contentIds };
      }

      // Add search filter to count if search term is provided
      if (search && search.trim()) {
        countWhere.title = { ilike: `%${search.trim()}%` };
      }

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

  async findAllSeries(page = 1, limit = 20, genre?: string, sort = 'created_at', search?: string) {
    // Use smart search when searching without genre filter
    if (search && search.trim() && !genre) {
      return this.searchContent(search, ContentType.SERIES, page, limit, sort === 'created_at' ? 'relevance' : sort);
    }

    return this.findAllSeriesBasic(page, limit, genre, sort, search);
  }

  private async findAllSeriesBasic(page = 1, limit = 20, genre?: string, sort = 'created_at', search?: string) {
    try {
      this.logger.debug(`Finding series: page=${page}, limit=${limit}, genre=${genre}, sort=${sort}, search=${search}`);

      // Filter by category if genre is provided
      let contentIds: string[] = [];
      if (genre) {
        // Find category by name
        const category = await this.supabaseClient.selectOne('categories', {
          where: { name: genre }
        });

        if (category) {
          // Get content IDs for this category
          const associations = await this.supabaseClient.select('content_categories', {
            where: { category_id: category.id },
            select: 'content_id'
          });

          contentIds = associations.map((assoc: any) => assoc.content_id);
          this.logger.debug(`Found ${contentIds.length} content items for category ${genre}`);
        }

        // If no content found for this category, return empty result
        if (contentIds.length === 0) {
          return {
            movies: [], // Keep the same property name for compatibility with frontend
            pagination: {
              page,
              limit,
              total: 0,
              totalPages: 0,
              hasNext: false,
              hasPrev: false,
            },
          };
        }
      }

      // Build query options
      const queryOptions: any = {
        where: {
          status: ContentStatus.PUBLISHED,
          content_type: ContentType.SERIES
        },
        limit,
        offset: (page - 1) * limit
      };

      // Add category filter if genre was specified
      if (genre && contentIds.length > 0) {
        queryOptions.where.id = { in: contentIds };
      }

      // Add search filter if search term is provided (case-insensitive)
      if (search && search.trim()) {
        // Use ilike for case-insensitive pattern matching
        // %text% matches anywhere in the string (% is the wildcard for PostgREST ILIKE)
        const searchPattern = `%${search.trim()}%`;
        this.logger.log(`Adding search filter: title ilike '${searchPattern}'`);
        queryOptions.where.title = { ilike: searchPattern };
      }

      this.logger.log(`Query options: ${JSON.stringify(queryOptions, null, 2)}`);

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

      const series = await this.supabaseClient.select('content', queryOptions);

      // Get total count for pagination
      const countWhere: any = {
        status: ContentStatus.PUBLISHED,
        content_type: ContentType.SERIES
      };

      // Add category filter to count if genre was specified
      if (genre && contentIds.length > 0) {
        countWhere.id = { in: contentIds };
      }

      // Add search filter to count if search term is provided
      if (search && search.trim()) {
        countWhere.title = { ilike: `%${search.trim()}%` };
      }

      const totalCount = await this.supabaseClient.count('content', countWhere);

      return {
        movies: series, // Keep the same property name for compatibility with frontend
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
      this.logger.error('Error finding series:', error);
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

  async findFeaturedContent(limit = 10) {
    try {
      this.logger.debug(`Finding featured content (limit: ${limit})`);

      const queryOptions = {
        where: {
          status: ContentStatus.PUBLISHED,
          is_featured: true
        },
        order: { column: 'created_at', ascending: false },
        limit
      };

      return await this.supabaseClient.select('content', queryOptions);
    } catch (error) {
      this.logger.error('Error finding featured content:', error);
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