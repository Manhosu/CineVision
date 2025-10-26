import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../../config/supabase.service';
import { ContentStatus, ContentType } from '../entities/content.entity';

@Injectable()
export class ContentSupabaseService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async findAllMovies(page = 1, limit = 20, genre?: string, sort = 'newest') {
    const offset = (page - 1) * limit;
    
    let query = this.supabaseService.client
      .from('content')
      .select(`
        *,
        categories:content_categories(
          category:categories(*)
        )
      `)
      .eq('status', ContentStatus.PUBLISHED)
      .eq('content_type', ContentType.MOVIE);

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

    const { data: movies, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch movies: ${error.message}`);
    }

    // Generate video_url for movies that don't have it
    const moviesWithUrls = (movies || []).map(movie => {
      if (!movie.video_url && movie.file_storage_key) {
        if (movie.file_storage_key.startsWith('raw/')) {
          const awsRegion = process.env.AWS_REGION || 'us-east-2';
          const s3Bucket = process.env.S3_RAW_BUCKET || 'cinevision-raw';
          movie.video_url = `https://${s3Bucket}.s3.${awsRegion}.amazonaws.com/${movie.file_storage_key}`;
        } else {
          const supabaseUrl = process.env.SUPABASE_URL || 'https://szghyvnbmjlquznxhqum.supabase.co';
          const bucketName = 'cinevision-filmes';
          movie.video_url = `${supabaseUrl}/storage/v1/object/public/${bucketName}/${movie.file_storage_key}`;
        }
      }
      return movie;
    });

    return {
      movies: moviesWithUrls,
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

    // Generate video_url from file_storage_key if video_url is null
    if (movie && !movie.video_url && movie.file_storage_key) {
      // Check if it's an S3 key (starts with "raw/")
      if (movie.file_storage_key.startsWith('raw/')) {
        // AWS S3 URL
        const awsRegion = process.env.AWS_REGION || 'us-east-2';
        const s3Bucket = process.env.S3_RAW_BUCKET || 'cinevision-raw';
        movie.video_url = `https://${s3Bucket}.s3.${awsRegion}.amazonaws.com/${movie.file_storage_key}`;
      } else {
        // Supabase Storage URL (fallback)
        const supabaseUrl = process.env.SUPABASE_URL || 'https://szghyvnbmjlquznxhqum.supabase.co';
        const bucketName = 'cinevision-filmes';
        movie.video_url = `${supabaseUrl}/storage/v1/object/public/${bucketName}/${movie.file_storage_key}`;
      }
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
        )
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
      data: seriesWithUrls,
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

    // Generate video_url from file_storage_key if video_url is null
    const episodesWithUrls = (episodes || []).map(episode => {
      if (!episode.video_url && episode.file_storage_key) {
        // Check if it's an S3 key (starts with "raw/")
        if (episode.file_storage_key.startsWith('raw/')) {
          // AWS S3 URL
          const awsRegion = process.env.AWS_REGION || 'us-east-2';
          const s3Bucket = process.env.S3_RAW_BUCKET || 'cinevision-raw';
          episode.video_url = `https://${s3Bucket}.s3.${awsRegion}.amazonaws.com/${episode.file_storage_key}`;
        } else {
          // Supabase Storage URL (fallback)
          const supabaseUrl = process.env.SUPABASE_URL || 'https://szghyvnbmjlquznxhqum.supabase.co';
          const bucketName = 'cinevision-filmes';
          episode.video_url = `${supabaseUrl}/storage/v1/object/public/${bucketName}/${episode.file_storage_key}`;
        }
      }
      return episode;
    });

    return episodesWithUrls;
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