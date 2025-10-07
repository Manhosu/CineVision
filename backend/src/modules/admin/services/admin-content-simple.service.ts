import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../../config/supabase.service';

@Injectable()
export class AdminContentSimpleService {
  private readonly logger = new Logger(AdminContentSimpleService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
  ) {
    console.log('AdminContentSimpleService instantiated successfully');
  }

  async getAllContent() {
    console.log('AdminContentSimpleService.getAllContent called');

    const { data, error} = await this.supabaseService.client
      .from('content')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error('Error fetching content:', error);
      throw new Error(`Failed to fetch content: ${error.message}`);
    }

    return data || [];
  }

  async createContent(data: any, userId?: string) {
    this.logger.log('Creating content with data:', JSON.stringify(data));

    // Mapear campos do frontend para o formato do banco
    const contentData = {
      title: data.title,
      description: data.description || null,
      synopsis: data.synopsis || null,
      poster_url: data.poster_url || null,
      backdrop_url: data.backdrop_url || null,
      trailer_url: data.trailer_url || null,
      content_type: data.type || 'movie', // Mapeia para coluna content_type
      status: 'DRAFT', // Sempre começa como draft
      availability: 'site', // Padrão
      price_cents: data.price_cents || 0,
      currency: 'BRL',
      is_featured: data.is_featured || false,
      genres: data.genres ? (Array.isArray(data.genres) ? data.genres : [data.genres]) : null, // Coluna genres (plural), tipo array
      director: data.director || null,
      cast: data.cast ? (Array.isArray(data.cast) ? data.cast : data.cast.split(',').map((c: string) => c.trim())) : null, // Tipo array
      release_year: data.release_year || null,
      duration_minutes: data.duration_minutes || null,
      imdb_rating: data.imdb_rating || null,
    };

    this.logger.log('Mapped content data:', JSON.stringify(contentData));

    const { data: insertedContent, error } = await this.supabaseService.client
      .from('content')
      .insert([contentData])
      .select()
      .single();

    if (error) {
      this.logger.error('Error creating content:', error);
      throw new Error(`Failed to create content: ${error.message}`);
    }

    this.logger.log('Content created successfully:', insertedContent.id);
    return insertedContent;
  }

  async initiateUpload(data: any, userId?: string) {
    console.log('AdminContentSimpleService.initiateUpload called');
    return {
      success: true,
      data: { uploadUrl: 'test-upload-url' },
      message: 'Upload initiated successfully'
    };
  }

  async completeUpload(data: any, userId?: string) {
    console.log('AdminContentSimpleService.completeUpload called');
    return {
      success: true,
      data: { id: 'test-upload-id' },
      message: 'Upload completed successfully'
    };
  }

  async getContentStatus(contentId: string) {
    console.log('AdminContentSimpleService.getContentStatus called with:', contentId);
    return {
      success: true,
      data: { status: 'active' },
      message: 'Status retrieved successfully'
    };
  }

  async publishContent(data: any, userId?: string) {
    console.log('AdminContentSimpleService.publishContent called with:', data);
    return {
      success: true,
      data: { id: data.content_id },
      message: 'Content published successfully'
    };
  }

  async createSeries(data: any, userId?: string) {
    console.log('AdminContentSimpleService.createSeries called');
    return {
      success: true,
      data: { id: 'test-series-id', ...data },
      message: 'Series created successfully'
    };
  }

  async createEpisode(data: any, userId?: string) {
    console.log('AdminContentSimpleService.createEpisode called with:', data);
    return {
      success: true,
      data: { id: 'test-episode-id', ...data },
      message: 'Episode created successfully'
    };
  }
}