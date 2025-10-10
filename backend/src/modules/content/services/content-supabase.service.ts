import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../../config/supabase.service';
import { ContentStatus, ContentType } from '../entities/content.entity';

@Injectable()
export class ContentSupabaseService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async findAllMovies(page = 1, limit = 20, genre?: string, sort = 'newest') {
    const offset = (page - 1) * limit;

    // If genre filter is provided, get movie IDs from content_categories first
    let filteredMovieIds: string[] | null = null;
    if (genre) {
      // Get the category ID for the genre
      const { data: category } = await this.supabaseService.client
        .from('categories')
        .select('id')
        .eq('name', genre)
        .single();

      if (category) {
        // Get all content IDs that have this category
        const { data: contentCategories } = await this.supabaseService.client
          .from('content_categories')
          .select('content_id')
          .eq('category_id', category.id);

        filteredMovieIds = contentCategories?.map(cc => cc.content_id) || [];

        // If no movies found with this genre, return empty result
        if (filteredMovieIds.length === 0) {
          return {
            movies: [],
            total: 0,
            page,
            limit,
            totalPages: 0,
          };
        }
      }
    }

    let query = this.supabaseService.client
      .from('content')
      .select(`
        *,
        categories:content_categories(
          category:categories(*)
        )
      `, { count: 'exact' })
      .eq('status', ContentStatus.PUBLISHED)
      .eq('content_type', ContentType.MOVIE);

    // Apply genre filter if we have filtered IDs
    if (filteredMovieIds) {
      query = query.in('id', filteredMovieIds);
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
    const { data: movie, error } = await this.supabaseService.client
      .from('content')
      .select(`
        *,
        categories:content_categories(
          category:categories(*)
        ),
        video_variants(*),
        content_languages(*)
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

  async findAllSeries(page = 1, limit = 20, genre?: string, sort = 'newest') {
    const offset = (page - 1) * limit;
    
    let query = this.supabaseService.client
      .from('content')
      .select(`
        *,
        categories:content_categories(
          category:categories(*)
        ),
        series:series(*)
      `)
      .eq('status', ContentStatus.PUBLISHED)
      .eq('content_type', ContentType.SERIES);

    // Filter by genre if provided
    if (genre) {
      query = query.contains('categories.category.name', [genre]);
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

    return {
      data: series || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    };
  }

  async findSeriesById(id: string) {
    const { data: series, error } = await this.supabaseService.client
      .from('content')
      .select(`
        *,
        categories:content_categories(
          category:categories(*)
        ),
        series:series(
          *,
          episodes:episodes(*)
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

  async searchContent(query: string, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    
    const { data: content, error, count } = await this.supabaseService.client
      .from('content')
      .select(`
        *,
        categories:content_categories(
          category:categories(*)
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

  async findRelatedMovies(movieId: string, genres: string[] = [], limit = 6) {
    let query = this.supabaseService.client
      .from('content')
      .select(`
        *,
        categories:content_categories(
          category:categories(*)
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