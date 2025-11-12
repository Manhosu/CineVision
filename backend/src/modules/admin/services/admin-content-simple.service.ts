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
    this.bucketName = this.configService.get('S3_VIDEO_BUCKET') || this.configService.get('AWS_S3_BUCKET') || 'cinevision-video';
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

  async getContentById(id: string) {
    console.log(`AdminContentSimpleService.getContentById called with id: ${id}`);

    const { data, error } = await this.supabaseService.client
      .from('content')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      this.logger.error(`Error fetching content by id ${id}:`, error);
      throw new NotFoundException(`Content with ID ${id} not found`);
    }

    return data;
  }

  async createContent(data: any, userId?: string) {
    this.logger.log('Creating content with data:', JSON.stringify(data));

    // Mapear campos do frontend para o formato do banco
    const contentData: any = {
      title: data.title,
      description: data.description || null,
      synopsis: data.synopsis || null,
      poster_url: data.poster_url || null,
      backdrop_url: data.backdrop_url || null,
      trailer_url: data.trailer_url || null,
      content_type: data.content_type || data.type || 'movie', // Mapeia para coluna content_type
      status: 'DRAFT', // Sempre começa como draft
      availability: 'site', // Padrão
      price_cents: data.price_cents || 0,
      currency: 'BRL',
      is_featured: data.is_featured || false,
      is_release: data.is_release || false,
      genres: data.genres ? (Array.isArray(data.genres) ? data.genres : [data.genres]) : null, // Coluna genres (plural), tipo array
      director: data.director || null,
      cast: data.cast ? (Array.isArray(data.cast) ? data.cast : data.cast.split(',').map((c: string) => c.trim())) : null, // Tipo array
      release_year: data.release_year || null,
      duration_minutes: data.duration_minutes || null,
      imdb_rating: data.imdb_rating || null,
    };

    // Adicionar campos específicos de série se aplicável
    if (contentData.content_type === 'series') {
      contentData.total_seasons = data.total_seasons || null;
      contentData.total_episodes = data.total_episodes || null;
    }

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
    const contentId = data.content_id;
    this.logger.log(`Publishing content with ID: ${contentId}`);

    // Validar que o conteúdo existe
    const { data: content, error: fetchError } = await this.supabaseService.client
      .from('content')
      .select('*')
      .eq('id', contentId)
      .single();

    if (fetchError || !content) {
      throw new NotFoundException(`Content with ID ${contentId} not found`);
    }

    // Atualizar status para PUBLISHED
    const { data: updatedContent, error: updateError } = await this.supabaseService.client
      .from('content')
      .update({
        status: 'PUBLISHED',
        updated_at: new Date().toISOString(),
      })
      .eq('id', contentId)
      .select()
      .single();

    if (updateError) {
      this.logger.error('Error publishing content:', updateError);
      throw new Error(`Failed to publish content: ${updateError.message}`);
    }

    this.logger.log(`Content ${contentId} published successfully`);

    return {
      success: true,
      data: updatedContent,
      message: `Content "${content.title}" published successfully`
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

    // Validate series exists
    const { data: series, error: seriesError } = await this.supabaseService.client
      .from('content')
      .select('id, content_type')
      .eq('id', data.series_id)
      .single();

    if (seriesError || !series) {
      throw new NotFoundException(`Series with ID ${data.series_id} not found`);
    }

    if (series.content_type !== 'series') {
      throw new Error('Content is not a series');
    }

    // Insert episode into episodes table
    const episodeData = {
      series_id: data.series_id,
      season_number: data.season_number,
      episode_number: data.episode_number,
      title: data.title,
      description: data.description,
      duration_minutes: data.duration_minutes,
      thumbnail_url: data.thumbnail_url || null,
      video_url: data.video_url || null,
      storage_path: data.storage_path || null,
      file_storage_key: data.file_storage_key || null,
      processing_status: data.processing_status || 'pending',
      created_by_id: userId || null,
      updated_by_id: userId || null,
    };

    const { data: episode, error: insertError } = await this.supabaseService.client
      .from('episodes')
      .insert(episodeData)
      .select()
      .single();

    if (insertError) {
      this.logger.error('Error creating episode:', insertError);
      throw new Error(`Failed to create episode: ${insertError.message}`);
    }

    return {
      success: true,
      data: episode,
      message: 'Episode created successfully'
    };
  }

  async updateEpisode(seriesId: string, episodeId: string, updateData: any, userId?: string) {
    this.logger.log(`Updating episode ${episodeId} for series ${seriesId}`);

    // Verify episode belongs to series
    const { data: episode, error: fetchError } = await this.supabaseService.client
      .from('episodes')
      .select('*')
      .eq('id', episodeId)
      .eq('series_id', seriesId)
      .single();

    if (fetchError || !episode) {
      throw new NotFoundException(`Episode ${episodeId} not found in series ${seriesId}`);
    }

    // Prepare update data
    const episodeUpdate: any = {
      updated_by_id: userId || null,
      updated_at: new Date().toISOString(),
    };

    // Only update fields that are provided
    if (updateData.title !== undefined) episodeUpdate.title = updateData.title;
    if (updateData.description !== undefined) episodeUpdate.description = updateData.description;
    if (updateData.season_number !== undefined) episodeUpdate.season_number = updateData.season_number;
    if (updateData.episode_number !== undefined) episodeUpdate.episode_number = updateData.episode_number;
    if (updateData.duration_minutes !== undefined) episodeUpdate.duration_minutes = updateData.duration_minutes;
    if (updateData.thumbnail_url !== undefined) episodeUpdate.thumbnail_url = updateData.thumbnail_url;
    if (updateData.video_url !== undefined) episodeUpdate.video_url = updateData.video_url;
    if (updateData.storage_path !== undefined) episodeUpdate.storage_path = updateData.storage_path;
    if (updateData.file_storage_key !== undefined) episodeUpdate.file_storage_key = updateData.file_storage_key;
    if (updateData.file_size_bytes !== undefined) episodeUpdate.file_size_bytes = updateData.file_size_bytes;
    if (updateData.processing_status !== undefined) episodeUpdate.processing_status = updateData.processing_status;
    if (updateData.available_qualities !== undefined) episodeUpdate.available_qualities = updateData.available_qualities;

    // Update episode
    const { data: updatedEpisode, error: updateError } = await this.supabaseService.client
      .from('episodes')
      .update(episodeUpdate)
      .eq('id', episodeId)
      .select()
      .single();

    if (updateError) {
      this.logger.error('Error updating episode:', updateError);
      throw new Error(`Failed to update episode: ${updateError.message}`);
    }

    return {
      success: true,
      data: updatedEpisode,
      message: 'Episode updated successfully'
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

    // 4. Se for série, deletar episódios e seus arquivos do S3
    if (content.content_type === 'series') {
      const { data: episodes } = await this.supabaseService.client
        .from('episodes')
        .select('id, file_storage_key, thumbnail_url')
        .eq('series_id', contentId);

      if (episodes && episodes.length > 0) {
        this.logger.log(`Found ${episodes.length} episodes to delete`);

        for (const episode of episodes) {
          // Deletar arquivo de vídeo do episódio do S3
          if (episode.file_storage_key) {
            try {
              await this.s3Client.send(new DeleteObjectCommand({
                Bucket: this.bucketName,
                Key: episode.file_storage_key,
              }));
              this.logger.log(`Deleted episode video from S3: ${episode.file_storage_key}`);
            } catch (s3Error) {
              this.logger.warn(`Failed to delete episode video ${episode.file_storage_key}:`, s3Error);
            }
          }

          // Deletar thumbnail do episódio do S3
          if (episode.thumbnail_url) {
            try {
              const url = new URL(episode.thumbnail_url);
              const key = url.pathname.substring(1);
              await this.s3Client.send(new DeleteObjectCommand({
                Bucket: this.bucketName,
                Key: key,
              }));
              this.logger.log(`Deleted episode thumbnail from S3: ${key}`);
            } catch (error) {
              this.logger.warn(`Failed to delete episode thumbnail from S3:`, error);
            }
          }
        }

        // Deletar episódios do banco
        await this.supabaseService.client
          .from('episodes')
          .delete()
          .eq('series_id', contentId);

        this.logger.log(`Deleted ${episodes.length} episodes from database`);
      }
    }

    // 5. Deletar registros relacionados (cascade deve funcionar, mas garantimos)
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

    // 6. Deletar o conteúdo do banco
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

  async updateContent(contentId: string, updateData: any) {
    this.logger.log(`Updating content ${contentId} with data:`, updateData);

    // Validar que o conteúdo existe
    const { data: existingContent, error: fetchError } = await this.supabaseService.client
      .from('content')
      .select('*')
      .eq('id', contentId)
      .single();

    if (fetchError || !existingContent) {
      throw new NotFoundException(`Content with ID ${contentId} not found`);
    }

    // Preparar dados de atualização
    const updatePayload: any = {
      updated_at: new Date().toISOString(),
    };

    // Mapear campos permitidos
    const allowedFields = [
      'title', 'description', 'synopsis', 'poster_url', 'backdrop_url',
      'trailer_url', 'telegram_group_link', 'release_year',
      'duration_minutes', 'imdb_rating', 'age_rating', 'director', 'cast',
      'genres', 'price_cents', 'is_featured', 'is_release', 'total_seasons', 'total_episodes',
      'status', 'availability'
    ];

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        updatePayload[field] = updateData[field];
      }
    }

    // Atualizar no banco
    const { data: updatedContent, error: updateError } = await this.supabaseService.client
      .from('content')
      .update(updatePayload)
      .eq('id', contentId)
      .select()
      .single();

    if (updateError) {
      this.logger.error('Error updating content:', updateError);
      throw new Error(`Failed to update content: ${updateError.message}`);
    }

    this.logger.log(`Content ${contentId} updated successfully`);

    return {
      success: true,
      message: 'Content updated successfully',
      data: updatedContent,
    };
  }

  async getAudioTracks(contentId: string) {
    this.logger.log(`Fetching audio tracks for content: ${contentId}`);

    const { data, error } = await this.supabaseService.client
      .from('content_languages')
      .select('*')
      .eq('content_id', contentId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error('Error fetching audio tracks:', error);
      throw new Error(`Failed to fetch audio tracks: ${error.message}`);
    }

    return {
      success: true,
      data: data || [],
      count: data?.length || 0,
    };
  }

  async addAudioTrack(contentId: string, audioData: any) {
    this.logger.log(`Adding audio track to content ${contentId}:`, audioData);

    // Validar que o conteúdo existe
    const { data: content, error: contentError } = await this.supabaseService.client
      .from('content')
      .select('id, title')
      .eq('id', contentId)
      .single();

    if (contentError || !content) {
      throw new NotFoundException(`Content with ID ${contentId} not found`);
    }

    // Preparar dados do audio track
    const audioTrackData = {
      content_id: contentId,
      language_type: audioData.language_type || 'dubbed',
      language_code: audioData.language_code || 'pt-BR',
      language_name: audioData.language_name,
      audio_type: audioData.audio_type,
      quality: audioData.quality || '1080p',
      video_url: audioData.video_url || null,
      video_storage_key: audioData.video_storage_key || null,
      hls_master_url: audioData.hls_master_url || null,
      hls_base_path: audioData.hls_base_path || null,
      is_active: true,
      is_primary: audioData.is_primary || false,
      status: audioData.status || 'ready',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: insertedAudio, error: insertError } = await this.supabaseService.client
      .from('content_languages')
      .insert([audioTrackData])
      .select()
      .single();

    if (insertError) {
      this.logger.error('Error adding audio track:', insertError);
      throw new Error(`Failed to add audio track: ${insertError.message}`);
    }

    this.logger.log(`Audio track added successfully: ${insertedAudio.id}`);

    return {
      success: true,
      message: 'Audio track added successfully',
      data: insertedAudio,
    };
  }

  async deleteAudioTrack(contentId: string, audioId: string) {
    this.logger.log(`Deleting audio track ${audioId} from content ${contentId}`);

    // Buscar o audio track para obter informações do S3
    const { data: audioTrack, error: fetchError } = await this.supabaseService.client
      .from('content_languages')
      .select('*')
      .eq('id', audioId)
      .eq('content_id', contentId)
      .single();

    if (fetchError || !audioTrack) {
      throw new NotFoundException(`Audio track with ID ${audioId} not found for content ${contentId}`);
    }

    // Deletar arquivo do S3 se existir
    if (audioTrack.video_storage_key) {
      try {
        await this.s3Client.send(new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: audioTrack.video_storage_key,
        }));
        this.logger.log(`Deleted S3 object: ${audioTrack.video_storage_key}`);
      } catch (s3Error) {
        this.logger.warn(`Failed to delete S3 object:`, s3Error);
      }
    }

    // Deletar arquivos HLS se existirem
    if (audioTrack.hls_base_path) {
      try {
        const listCommand = new ListObjectsV2Command({
          Bucket: this.bucketName,
          Prefix: audioTrack.hls_base_path,
        });
        const listResult = await this.s3Client.send(listCommand);

        if (listResult.Contents && listResult.Contents.length > 0) {
          for (const object of listResult.Contents) {
            await this.s3Client.send(new DeleteObjectCommand({
              Bucket: this.bucketName,
              Key: object.Key,
            }));
          }
          this.logger.log(`Deleted HLS files from: ${audioTrack.hls_base_path}`);
        }
      } catch (s3Error) {
        this.logger.warn(`Failed to delete HLS files:`, s3Error);
      }
    }

    // Deletar do banco
    const { error: deleteError } = await this.supabaseService.client
      .from('content_languages')
      .delete()
      .eq('id', audioId);

    if (deleteError) {
      this.logger.error('Error deleting audio track:', deleteError);
      throw new Error(`Failed to delete audio track: ${deleteError.message}`);
    }

    this.logger.log(`Audio track ${audioId} deleted successfully`);

    return {
      success: true,
      message: 'Audio track deleted successfully',
      deletedAudio: {
        id: audioTrack.id,
        language_name: audioTrack.language_name,
      },
    };
  }

  async deleteEpisode(episodeId: string) {
    this.logger.log(`Deleting episode: ${episodeId}`);

    // Buscar o episódio primeiro
    const { data: episode, error: fetchError } = await this.supabaseService.client
      .from('episodes')
      .select('*')
      .eq('id', episodeId)
      .single();

    if (fetchError || !episode) {
      throw new NotFoundException(`Episode with ID ${episodeId} not found`);
    }

    // Deletar arquivos do S3 se existirem
    if (episode.file_storage_key) {
      try {
        await this.s3Client.send(new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: episode.file_storage_key,
        }));
        this.logger.log(`Deleted S3 object: ${episode.file_storage_key}`);
      } catch (s3Error) {
        this.logger.warn(`Failed to delete S3 object:`, s3Error);
      }
    }

    // Deletar arquivos HLS se existirem
    if (episode.hls_base_path) {
      try {
        const listCommand = new ListObjectsV2Command({
          Bucket: this.bucketName,
          Prefix: episode.hls_base_path,
        });
        const listResult = await this.s3Client.send(listCommand);

        if (listResult.Contents && listResult.Contents.length > 0) {
          for (const object of listResult.Contents) {
            await this.s3Client.send(new DeleteObjectCommand({
              Bucket: this.bucketName,
              Key: object.Key,
            }));
          }
          this.logger.log(`Deleted HLS files from: ${episode.hls_base_path}`);
        }
      } catch (s3Error) {
        this.logger.warn(`Failed to delete HLS files:`, s3Error);
      }
    }

    // Deletar do banco
    const { error: deleteError } = await this.supabaseService.client
      .from('episodes')
      .delete()
      .eq('id', episodeId);

    if (deleteError) {
      this.logger.error('Error deleting episode:', deleteError);
      throw new Error(`Failed to delete episode: ${deleteError.message}`);
    }

    this.logger.log(`Episode ${episodeId} deleted successfully`);

    return {
      success: true,
      message: 'Episode deleted successfully',
      deletedEpisode: {
        id: episode.id,
        title: episode.title,
        season: episode.season_number,
        episode: episode.episode_number,
      },
    };
  }

  /**
   * Sync/create all categories based on AVAILABLE_GENRES
   */
  async syncCategories() {
    this.logger.log('Syncing categories...');

    const AVAILABLE_GENRES = [
      'Ação',
      'Aventura',
      'Animação',
      'Comédia',
      'Crime',
      'Documentário',
      'Drama',
      'Fantasia',
      'Ficção Científica',
      'Guerra',
      'História',
      'Horror',
      'Musical',
      'Mistério',
      'Romance',
      'Suspense',
      'Terror',
      'Thriller',
      'Western',
      'Séries', // Special category for all series
    ];

    const createdCategories = [];
    const skippedCategories = [];

    for (const genreName of AVAILABLE_GENRES) {
      // Generate slug
      const slug = genreName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');

      // Check if category exists
      const { data: existingCategory } = await this.supabaseService.client
        .from('categories')
        .select('id, name')
        .eq('slug', slug)
        .single();

      if (existingCategory) {
        skippedCategories.push(genreName);
        continue;
      }

      // Create category
      const { data: newCategory, error } = await this.supabaseService.client
        .from('categories')
        .insert({
          name: genreName,
          slug: slug,
          description: `Filmes e séries de ${genreName}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        this.logger.error(`Error creating category ${genreName}:`, error);
      } else {
        createdCategories.push(genreName);
        this.logger.log(`Created category: ${genreName}`);
      }
    }

    return {
      success: true,
      created: createdCategories,
      skipped: skippedCategories,
      message: `Synced ${createdCategories.length} categories, ${skippedCategories.length} already existed`,
    };
  }

  /**
   * Populate content_categories for all existing content based on their genres column
   */
  async populateContentCategories() {
    this.logger.log('Populating content categories...');

    // Fetch all content
    const { data: allContent, error: contentError } = await this.supabaseService.client
      .from('content')
      .select('id, title, content_type, genres, status');

    if (contentError) {
      this.logger.error('Error fetching content:', contentError);
      throw new Error(`Failed to fetch content: ${contentError.message}`);
    }

    if (!allContent || allContent.length === 0) {
      return {
        success: true,
        message: 'No content found',
        populated: 0,
      };
    }

    let populatedCount = 0;

    for (const content of allContent) {
      try {
        // Clear existing associations
        await this.supabaseService.client
          .from('content_categories')
          .delete()
          .eq('content_id', content.id);

        const categoriesToAssociate: string[] = [];

        // Add genre-based categories
        if (content.genres && Array.isArray(content.genres) && content.genres.length > 0) {
          categoriesToAssociate.push(...content.genres);
        }

        // Add "Séries" category for all series
        if (content.content_type === 'series') {
          categoriesToAssociate.push('Séries');
        }

        // Associate categories
        if (categoriesToAssociate.length > 0) {
          await this.associateCategories(content.id, categoriesToAssociate);
          populatedCount++;
          this.logger.log(`Populated categories for: ${content.title}`);
        }
      } catch (error) {
        this.logger.error(`Error populating categories for ${content.title}:`, error);
      }
    }

    return {
      success: true,
      message: `Populated categories for ${populatedCount} content items`,
      total: allContent.length,
      populated: populatedCount,
    };
  }
}