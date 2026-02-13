import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { SupabaseService } from '../../../config/supabase.service';
import { ContentStatus, ContentType } from '../entities/content.entity';

@Injectable()
export class ContentSupabaseService {
  private readonly logger = new Logger(ContentSupabaseService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Smart search using PostgreSQL RPC function with fuzzy search, unaccent, and word splitting.
   * Falls back to improved ILIKE if RPC is not available.
   */
  private async smartSearch(search: string, contentType: string, page: number, limit: number, sort: string) {
    const offset = (page - 1) * limit;

    try {
      // Call the PostgreSQL search function via RPC
      const { data: results, error } = await this.supabaseService.client
        .rpc('search_content', {
          search_query: search.trim(),
          content_type_filter: contentType,
          result_limit: limit,
          result_offset: offset,
        });

      if (error) throw error;

      // Get total count for pagination
      const { data: countData, error: countError } = await this.supabaseService.client
        .rpc('search_content_count', {
          search_query: search.trim(),
          content_type_filter: contentType,
        });

      if (countError) throw countError;

      const total = typeof countData === 'number' ? countData : 0;

      // Apply secondary sort if not using relevance
      let sortedResults = Array.isArray(results) ? results : [];
      if (sort !== 'newest') {
        switch (sort) {
          case 'popular':
            sortedResults.sort((a: any, b: any) => (b.views_count || 0) - (a.views_count || 0));
            break;
          case 'rating':
            sortedResults.sort((a: any, b: any) => (b.imdb_rating || 0) - (a.imdb_rating || 0));
            break;
          case 'price_low':
            sortedResults.sort((a: any, b: any) => (a.price_cents || 0) - (b.price_cents || 0));
            break;
          case 'price_high':
            sortedResults.sort((a: any, b: any) => (b.price_cents || 0) - (a.price_cents || 0));
            break;
        }
      }

      return {
        movies: sortedResults,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      this.logger.warn(`Smart search RPC failed, falling back to ILIKE: ${error}`);
      return this.ilikeFallbackSearch(search, contentType, page, limit, sort);
    }
  }

  /**
   * Improved ILIKE fallback: splits multi-word queries and searches each word independently.
   */
  private async ilikeFallbackSearch(search: string, contentType: string, page: number, limit: number, sort: string) {
    const offset = (page - 1) * limit;
    const words = search.trim().split(/\s+/).filter(w => w.length > 0);

    // Build OR filter: each word must appear in title OR description
    // For PostgREST, we build an or() filter string
    const orConditions = words.map(word => {
      const encoded = word.replace(/[%_]/g, '');
      return `title.ilike.%${encoded}%`;
    });

    let query = this.supabaseService.client
      .from('content')
      .select('*', { count: 'exact' })
      .eq('status', ContentStatus.PUBLISHED)
      .eq('content_type', contentType);

    // Apply each word as an ILIKE filter (AND logic - all words must match)
    for (const word of words) {
      const encoded = word.replace(/[%_]/g, '');
      query = query.ilike('title', `%${encoded}%`);
    }

    // Apply sorting
    switch (sort) {
      case 'newest':
        query = query.order('created_at', { ascending: false });
        break;
      case 'popular':
        query = query.order('views_count', { ascending: false });
        break;
      case 'rating':
        query = query.order('imdb_rating', { ascending: false });
        break;
      case 'price_low':
        query = query.order('price_cents', { ascending: true });
        break;
      case 'price_high':
        query = query.order('price_cents', { ascending: false });
        break;
      default:
        query = query.order('created_at', { ascending: false });
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to search content: ${error.message}`);
    }

    return {
      movies: data || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    };
  }

  async findAllMovies(page = 1, limit = 20, genre?: string, sort = 'newest', search?: string) {
    // Use smart search when searching without genre filter
    if (search && search.trim() && !genre) {
      return this.smartSearch(search, ContentType.MOVIE, page, limit, sort);
    }

    const offset = (page - 1) * limit;

    // Step 1: If genre filter is provided, get content IDs for this category
    let contentIds: string[] | null = null;
    if (genre) {
      // Find the category by name
      const { data: category } = await this.supabaseService.client
        .from('categories')
        .select('id')
        .eq('name', genre)
        .single();

      if (category) {
        // Get all content IDs associated with this category
        const { data: associations } = await this.supabaseService.client
          .from('content_categories')
          .select('content_id')
          .eq('category_id', category.id);

        contentIds = associations?.map(a => a.content_id) || [];

        // If no content found for this category, return empty result
        if (contentIds.length === 0) {
          return {
            movies: [],
            total: 0,
            page,
            limit,
            totalPages: 0,
          };
        }
      } else {
        // Category doesn't exist, return empty result
        return {
          movies: [],
          total: 0,
          page,
          limit,
          totalPages: 0,
        };
      }
    }

    // Step 2: Build the main query with optional ID filter
    let query = this.supabaseService.client
      .from('content')
      .select(`
        *,
        categories:content_categories(
          category:categories(*)
        ),
        content_languages(
          id,
          language_name,
          video_url,
          hls_master_url,
          upload_status
        )
      `, { count: 'exact' })
      .eq('status', ContentStatus.PUBLISHED)
      .eq('content_type', ContentType.MOVIE);

    // Apply content ID filter if genre was specified
    if (contentIds) {
      query = query.in('id', contentIds);
    }

    // Apply search filter with word splitting (AND logic)
    if (search && search.trim()) {
      const words = search.trim().split(/\s+/).filter(w => w.length > 0);
      for (const word of words) {
        query = query.ilike('title', `%${word}%`);
      }
    }

    // Apply sorting
    switch (sort) {
      case 'newest':
        query = query.order('created_at', { ascending: false });
        break;
      case 'popular':
        query = query.order('views_count', { ascending: false });
        break;
      case 'rating':
        query = query.order('imdb_rating', { ascending: false });
        break;
      case 'price_low':
        query = query.order('price_cents', { ascending: true });
        break;
      case 'price_high':
        query = query.order('price_cents', { ascending: false });
        break;
      default:
        query = query.order('created_at', { ascending: false });
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: movies, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch movies: ${error.message}`);
    }

    return {
      movies: movies || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    };
  }

  async findMovieById(id: string) {
    // Include content_languages to check if video is uploaded
    const { data: movie, error } = await this.supabaseService.client
      .from('content')
      .select(`
        *,
        categories:content_categories(
          category:categories(*)
        ),
        content_languages(
          id,
          language_name,
          video_url,
          hls_master_url,
          upload_status
        )
      `)
      .eq('id', id)
      .eq('content_type', ContentType.MOVIE)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundException(`Movie with ID ${id} not found`);
      }
      throw new Error(`Failed to fetch movie: ${error.message}`);
    }

    // Return movie with file_storage_key - frontend will generate presigned URLs
    return movie;
  }

  async findAllCategories() {
    const { data: categories, error } = await this.supabaseService.client
      .from('categories')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch categories: ${error.message}`);
    }

    return categories || [];
  }

  async findAllSeries(page = 1, limit = 20, genre?: string, sort = 'newest', search?: string) {
    // Use smart search when searching without genre filter
    if (search && search.trim() && !genre) {
      return this.smartSearch(search, ContentType.SERIES, page, limit, sort);
    }

    const offset = (page - 1) * limit;

    // Step 1: If genre filter is provided, get content IDs for this category
    let contentIds: string[] | null = null;
    if (genre) {
      // Find the category by name
      const { data: category } = await this.supabaseService.client
        .from('categories')
        .select('id')
        .eq('name', genre)
        .single();

      if (category) {
        // Get all content IDs associated with this category
        const { data: associations } = await this.supabaseService.client
          .from('content_categories')
          .select('content_id')
          .eq('category_id', category.id);

        contentIds = associations?.map(a => a.content_id) || [];

        // If no content found for this category, return empty result
        if (contentIds.length === 0) {
          return {
            movies: [],
            total: 0,
            page,
            limit,
            totalPages: 0,
          };
        }
      } else {
        // Category doesn't exist, return empty result
        return {
          movies: [],
          total: 0,
          page,
          limit,
          totalPages: 0,
        };
      }
    }

    // Step 2: Build the main query with optional ID filter
    let query = this.supabaseService.client
      .from('content')
      .select(`
        *,
        categories:content_categories(
          category:categories(*)
        ),
        content_languages(
          id,
          language_name,
          video_url,
          hls_master_url,
          upload_status
        )
      `, { count: 'exact' })
      .eq('status', ContentStatus.PUBLISHED)
      .eq('content_type', ContentType.SERIES);

    // Apply content ID filter if genre was specified
    if (contentIds) {
      query = query.in('id', contentIds);
    }

    // Apply search filter with word splitting (AND logic)
    if (search && search.trim()) {
      const words = search.trim().split(/\s+/).filter(w => w.length > 0);
      for (const word of words) {
        query = query.ilike('title', `%${word}%`);
      }
    }

    // Apply sorting
    switch (sort) {
      case 'newest':
        query = query.order('created_at', { ascending: false });
        break;
      case 'popular':
        query = query.order('views_count', { ascending: false });
        break;
      case 'rating':
        query = query.order('imdb_rating', { ascending: false });
        break;
      case 'price_low':
        query = query.order('price_cents', { ascending: true });
        break;
      case 'price_high':
        query = query.order('price_cents', { ascending: false });
        break;
      default:
        query = query.order('created_at', { ascending: false });
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: series, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch series: ${error.message}`);
    }

    // Generate video_url for series that don't have it
    const seriesWithUrls = (series || []).map(item => {
      if (!item.video_url && item.file_storage_key) {
        if (item.file_storage_key.startsWith('raw/')) {
          const awsRegion = process.env.AWS_REGION || 'us-east-2';
          const s3Bucket = process.env.S3_RAW_BUCKET || 'cinevision-raw';
          item.video_url = `https://${s3Bucket}.s3.${awsRegion}.amazonaws.com/${item.file_storage_key}`;
        } else {
          const supabaseUrl = process.env.SUPABASE_URL || 'https://szghyvnbmjlquznxhqum.supabase.co';
          const bucketName = 'cinevision-filmes';
          item.video_url = `${supabaseUrl}/storage/v1/object/public/${bucketName}/${item.file_storage_key}`;
        }
      }
      return item;
    });

    return {
      movies: seriesWithUrls,
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    };
  }

  async findSeriesById(id: string) {
    // Include content_languages to check if video is uploaded
    const { data: series, error } = await this.supabaseService.client
      .from('content')
      .select(`
        *,
        categories:content_categories(
          category:categories(*)
        ),
        content_languages(
          id,
          language_name,
          video_url,
          hls_master_url,
          upload_status
        )
      `)
      .eq('id', id)
      .eq('content_type', ContentType.SERIES)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundException(`Series with ID ${id} not found`);
      }
      throw new Error(`Failed to fetch series: ${error.message}`);
    }

    return series;
  }

  async findSeriesEpisodes(seriesId: string, season?: number) {
    // First check if series exists
    const { data: series, error: seriesError } = await this.supabaseService.client
      .from('content')
      .select('id, status')
      .eq('id', seriesId)
      .eq('status', ContentStatus.PUBLISHED)
      .single();

    if (seriesError || !series) {
      throw new NotFoundException('Series not found');
    }

    // Query episodes from the episodes table
    let query = this.supabaseService.client
      .from('episodes')
      .select(`
        id,
        series_id,
        season_number,
        episode_number,
        title,
        description,
        thumbnail_url,
        video_url,
        duration_minutes,
        storage_path,
        file_storage_key,
        processing_status,
        available_qualities,
        views_count,
        created_at,
        updated_at
      `)
      .eq('series_id', seriesId)
      .order('season_number', { ascending: true })
      .order('episode_number', { ascending: true });

    // Filter by season if provided
    if (season) {
      query = query.eq('season_number', season);
    }

    const { data: episodes, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch episodes: ${error.message}`);
    }

    // Return episodes with file_storage_key - frontend will generate presigned URLs
    return episodes || [];
  }

  async searchContent(query: string, page = 1, limit = 20) {
    const offset = (page - 1) * limit;

    const { data: content, error, count } = await this.supabaseService.client
      .from('content')
      .select(`
        *,
        categories:content_categories(
          category:categories(*)
        ),
        content_languages(
          id,
          language_name,
          video_url,
          hls_master_url,
          upload_status
        )
      `)
      .eq('status', ContentStatus.PUBLISHED)
      .or(`title.ilike.%${query}%, description.ilike.%${query}%`)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to search content: ${error.message}`);
    }

    return {
      data: content || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    };
  }

  async incrementViews(contentId: string) {
    const { error } = await this.supabaseService.client
      .rpc('increment_views', { content_id: contentId });

    if (error) {
      console.error(`Failed to increment views for content ${contentId}:`, error);
    }
  }

  async findTop10Films() {
    const { data: films, error } = await this.supabaseService.client
      .from('content')
      .select(`
        *,
        categories:content_categories(
          category:categories(*)
        ),
        content_languages(
          id,
          language_name,
          video_url,
          hls_master_url,
          upload_status
        )
      `)
      .eq('status', ContentStatus.PUBLISHED)
      .eq('content_type', ContentType.MOVIE)
      .order('views_count', { ascending: false })
      .order('weekly_sales', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      throw new Error(`Failed to fetch top 10 films: ${error.message}`);
    }

    return films || [];
  }

  async findTop10Series() {
    const { data: series, error } = await this.supabaseService.client
      .from('content')
      .select(`
        *,
        categories:content_categories(
          category:categories(*)
        ),
        content_languages(
          id,
          language_name,
          video_url,
          hls_master_url,
          upload_status
        )
      `)
      .eq('status', ContentStatus.PUBLISHED)
      .eq('content_type', ContentType.SERIES)
      .order('views_count', { ascending: false })
      .order('weekly_sales', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      throw new Error(`Failed to fetch top 10 series: ${error.message}`);
    }

    return series || [];
  }

  async findFeaturedContent(limit = 10) {
    const { data: featured, error } = await this.supabaseService.client
      .from('content')
      .select(`
        *,
        categories:content_categories(
          category:categories(*)
        ),
        content_languages(
          id,
          language_name,
          video_url,
          hls_master_url,
          upload_status
        )
      `)
      .eq('status', ContentStatus.PUBLISHED)
      .eq('is_featured', true)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to fetch featured content: ${error.message}`);
    }

    return featured || [];
  }

  async findRelatedMovies(movieId: string, genres: string[] = [], limit = 6) {
    let query = this.supabaseService.client
      .from('content')
      .select(`
        *,
        categories:content_categories(
          category:categories(*)
        ),
        content_languages(
          id,
          language_name,
          video_url,
          hls_master_url,
          upload_status
        )
      `)
      .eq('status', ContentStatus.PUBLISHED)
      .eq('content_type', ContentType.MOVIE)
      .neq('id', movieId);

    // Filter by genres if provided
    if (genres.length > 0) {
      // This is a simplified version - in production you'd use a more sophisticated join
      query = query.filter('categories.category.name', 'in', `(${genres.join(',')})`);
    }

    const { data: movies, error } = await query
      .limit(limit);

    if (error) {
      throw new Error(`Failed to fetch related movies: ${error.message}`);
    }

    return movies || [];
  }

  async deleteAllMovies() {
    try {
      const { data, error } = await this.supabaseService.client
        .from('content')
        .delete()
        .eq('content_type', ContentType.MOVIE)
        .select();

      if (error) {
        throw new Error(`Failed to delete movies: ${error.message}`);
      }

      return {
        success: true,
        deletedCount: data?.length || 0,
        deletedMovies: []
      };
    } catch (error) {
      throw error;
    }
  }

  async findReleases(limit = 20) {
    console.log('[ContentSupabaseService] findReleases called with limit:', limit);
    try {
      const { data, error } = await this.supabaseService.client
        .from('content')
        .select(`
          *,
          categories:content_categories(
            category:categories(*)
          ),
          content_languages(
            id,
            language_name,
            video_url,
            hls_master_url,
            upload_status
          )
        `)
        .eq('status', 'PUBLISHED')
        .eq('is_release', true)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('[ContentSupabaseService] Error fetching releases:', error);
        throw new Error(`Failed to fetch releases: ${error.message}`);
      }

      console.log('[ContentSupabaseService] findReleases returned', data?.length || 0, 'items');
      return data || [];
    } catch (error) {
      console.error('[ContentSupabaseService] Exception in findReleases:', error);
      throw error;
    }
  }

  async deleteAllContent() {
    try {
      const { data, error } = await this.supabaseService.client
        .from('content')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all records
        .select();

      if (error) {
        throw new Error(`Failed to delete content: ${error.message}`);
      }

      return {
        success: true,
        deletedCount: data?.length || 0,
        deletedContent: []
      };
    } catch (error) {
      throw error;
    }
  }
}