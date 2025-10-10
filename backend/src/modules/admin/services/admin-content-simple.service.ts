import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../../config/supabase.service';
import { S3Client, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AdminContentSimpleService {
  private readonly logger = new Logger(AdminContentSimpleService.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
  ) {
    console.log('AdminContentSimpleService instantiated successfully');

    this.s3Client = new S3Client({
      region: this.configService.get('AWS_REGION') || 'us-east-1',
      credentials: {
        accessKeyId: this.configService.get('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.get('AWS_SECRET_ACCESS_KEY'),
      },
    });
    this.bucketName = this.configService.get('AWS_S3_BUCKET') || 'cinevision-filmes';
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

    // Associar categorias se fornecidas
    if (data.genres && Array.isArray(data.genres) && data.genres.length > 0) {
      await this.associateCategories(insertedContent.id, data.genres);
    }

    return insertedContent;
  }

  private async associateCategories(contentId: string, categoryNames: string[]) {
    this.logger.log(`Associating categories for content ${contentId}:`, categoryNames);

    // Buscar IDs das categorias pelos nomes
    const { data: categories, error: categoriesError } = await this.supabaseService.client
      .from('categories')
      .select('id, name')
      .in('name', categoryNames);

    if (categoriesError) {
      this.logger.error('Error fetching categories:', categoriesError);
      return;
    }

    if (!categories || categories.length === 0) {
      this.logger.warn('No matching categories found for:', categoryNames);
      return;
    }

    // Criar associações
    const associations = categories.map(category => ({
      content_id: contentId,
      category_id: category.id
    }));

    const { error: insertError } = await this.supabaseService.client
      .from('content_categories')
      .insert(associations);

    if (insertError) {
      this.logger.error('Error creating category associations:', insertError);
    } else {
      this.logger.log(`Successfully associated ${categories.length} categories`);
    }
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

  async deleteContent(contentId: string, userId?: string) {
    this.logger.log(`Deleting content with ID: ${contentId}`);

    // 1. Buscar o conteúdo para obter informações antes de deletar
    const { data: content, error: fetchError } = await this.supabaseService.client
      .from('content')
      .select('*')
      .eq('id', contentId)
      .single();

    if (fetchError || !content) {
      this.logger.error(`Content not found: ${contentId}`);
      throw new NotFoundException(`Content with ID ${contentId} not found`);
    }

    this.logger.log(`Found content: ${content.title}`);

    // 2. Deletar arquivos de vídeo do S3 (content_languages table)
    const { data: languages } = await this.supabaseService.client
      .from('content_languages')
      .select('video_storage_key')
      .eq('content_id', contentId);

    if (languages && languages.length > 0) {
      for (const lang of languages) {
        if (lang.video_storage_key) {
          try {
            await this.s3Client.send(new DeleteObjectCommand({
              Bucket: this.bucketName,
              Key: lang.video_storage_key,
            }));
            this.logger.log(`Deleted S3 object: ${lang.video_storage_key}`);
          } catch (s3Error) {
            this.logger.warn(`Failed to delete S3 object ${lang.video_storage_key}:`, s3Error);
          }
        }
      }
    }

    // 3. Deletar imagens (poster e backdrop) do S3
    const imagesToDelete = [content.poster_url, content.backdrop_url].filter(Boolean);
    for (const imageUrl of imagesToDelete) {
      try {
        // Extrair a key da URL
        const url = new URL(imageUrl);
        const key = url.pathname.substring(1); // Remove leading /
        await this.s3Client.send(new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        }));
        this.logger.log(`Deleted image from S3: ${key}`);
      } catch (error) {
        this.logger.warn(`Failed to delete image from S3:`, error);
      }
    }

    // 4. Deletar registros relacionados (cascade deve funcionar, mas garantimos)
    await this.supabaseService.client
      .from('content_languages')
      .delete()
      .eq('content_id', contentId);

    await this.supabaseService.client
      .from('purchases')
      .delete()
      .eq('content_id', contentId);

    await this.supabaseService.client
      .from('favorites')
      .delete()
      .eq('content_id', contentId);

    // 5. Deletar o conteúdo do banco
    const { error: deleteError } = await this.supabaseService.client
      .from('content')
      .delete()
      .eq('id', contentId);

    if (deleteError) {
      this.logger.error('Error deleting content from database:', deleteError);
      throw new Error(`Failed to delete content: ${deleteError.message}`);
    }

    this.logger.log(`Content ${contentId} deleted successfully`);

    return {
      success: true,
      message: `Content "${content.title}" deleted successfully`,
      deletedContent: {
        id: content.id,
        title: content.title,
      },
    };
  }
}