import { Injectable, Logger, NotFoundException, BadRequestException, Optional, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Content, ContentStatus, VideoProcessingStatus } from '../../content/entities/content.entity';
import { Series } from '../../content/entities/series.entity';
import { Episode } from '../../content/entities/episode.entity';
import { Category } from '../../content/entities/category.entity';
import { SystemLog } from '../../logs/entities/system-log.entity';
import { StripeService } from '../../payments/services/stripe.service';
import { VideoUploadService } from '../../video/video-upload.service';
import { BotNotificationService } from '../../telegrams/services/bot-notification.service';
import { QueueService } from '../../queue/services/queue.service';
import { SupabaseRestClient } from '../../../config/supabase-rest-client';
import {
  CreateContentDto,
  InitiateUploadDto,
  CompleteUploadDto,
  PublishContentDto,
  CreateSeriesDto,
  CreateEpisodeDto,
} from '../dto/create-content.dto';

@Injectable()
export class AdminContentService {
  private readonly logger = new Logger(AdminContentService.name);

  constructor(
    @Optional() @InjectRepository(Content)
    private contentRepository: Repository<Content>,
    @Optional() @InjectRepository(Series)
    private seriesRepository: Repository<Series>,
    @Optional() @InjectRepository(Episode)
    private episodeRepository: Repository<Episode>,
    @Optional() @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
    @Optional() @InjectRepository(SystemLog)
    private systemLogRepository: Repository<SystemLog>,
    @Optional() private stripeService: StripeService,
    @Optional() private uploadService: VideoUploadService,
    @Optional() private botNotificationService: BotNotificationService,
    @Optional() private queueService: QueueService,
    @Optional() private supabaseClient: SupabaseRestClient,
  ) {
    console.log('AdminContentService instantiated successfully');
    console.log('TypeORM available:', !!this.contentRepository);
    console.log('Supabase available:', !!this.supabaseClient);
  }

  /**
   * Create content with automatic Stripe Product + Price creation
   */
  async createContent(dto: CreateContentDto, userId?: string): Promise<Content> {
    this.logger.log(`Creating content: ${dto.title}`);

    try {
      // Check if TypeORM is available
      if (!this.contentRepository) {
        // Use ContentService (Supabase) when TypeORM is not available
        return this.createContentWithSupabase(dto, userId);
      }

      // Step 1: Create Stripe Product and Price (if available)
      let stripeResult = null;
      if (this.stripeService) {
        stripeResult = await this.stripeService.createProductWithPrice(
        {
          name: dto.title,
          description: dto.description || dto.synopsis,
          images: dto.cover_url ? [dto.cover_url] : undefined,
          metadata: {
            content_type: dto.type,
            availability: dto.availability,
          },
        },
        {
          unitAmount: dto.price_cents,
          currency: dto.currency || 'brl',
          metadata: {
            content_type: dto.type,
          },
        },
      );
      }

      if (stripeResult) {
        this.logger.log(`Stripe product created: ${stripeResult.productId}, price: ${stripeResult.priceId}`);
      } else {
        this.logger.log('Stripe service not available - skipping product creation');
      }

      // Step 2: Get categories if provided
      let categories: Category[] = [];
      if (dto.category_ids && dto.category_ids.length > 0) {
        categories = await this.categoryRepository.find({
          where: { id: In(dto.category_ids) },
        });
      }

      // Step 3: Create content in database with status = DRAFT
      const content = this.contentRepository.create({
        title: dto.title,
        description: dto.description,
        synopsis: dto.synopsis,
        type: dto.type,
        price_cents: dto.price_cents,
        currency: dto.currency || 'BRL',
        availability: dto.availability,
        stripe_product_id: stripeResult?.productId,
        stripe_price_id: stripeResult?.priceId,
        trailer_url: dto.trailer_url,
        thumbnail_url: dto.cover_url, // cover_url -> thumbnail_url
        poster_url: dto.poster_url,
        genres: dto.genres ? JSON.stringify(dto.genres) : undefined,
        release_year: dto.release_year,
        director: dto.director,
        cast: Array.isArray(dto.cast) ? dto.cast.join(', ') : dto.cast,
        imdb_rating: dto.imdb_rating,
        duration_minutes: dto.duration_minutes,
        is_featured: dto.is_featured || false,
        status: ContentStatus.DRAFT,
        processing_status: VideoProcessingStatus.PENDING,
        categories,
        created_by: userId ? ({ id: userId } as any) : undefined,
      }) as Content;

      const savedContent = await this.contentRepository.save(content) as Content;

      // Step 4: Log the creation
      await this.systemLogRepository.save({
        entity_type: 'content',
        entity_id: savedContent.id,
        action: 'content_create',
        user_id: userId,
        meta: {
          title: dto.title,
          type: dto.type,
          stripe_product_id: stripeResult.productId,
          stripe_price_id: stripeResult.priceId,
        },
      });

      this.logger.log(`Content created successfully: ${savedContent.id}`);
      return savedContent;
    } catch (error) {
      this.logger.error(`Failed to create content: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to create content: ${error.message}`);
    }
  }

  /**
   * Create content using Supabase when TypeORM is not available
   */
  private async createContentWithSupabase(dto: CreateContentDto, userId?: string): Promise<any> {
    this.logger.log(`Creating content with Supabase: ${dto.title}`);

    // Create content data for Supabase
    const contentData = {
      title: dto.title,
      description: dto.description,
      synopsis: dto.synopsis,
      content_type: dto.type,
      price_cents: dto.price_cents,
      currency: dto.currency || 'BRL',
      trailer_url: dto.trailer_url,
      poster_url: dto.poster_url,
      cover_url: dto.cover_url,
      genre: dto.genres ? (Array.isArray(dto.genres) ? dto.genres.join(', ') : dto.genres) : undefined,
      release_year: dto.release_year,
      director: dto.director,
      cast: Array.isArray(dto.cast) ? dto.cast.join(', ') : dto.cast,
      imdb_rating: dto.imdb_rating,
      duration_minutes: dto.duration_minutes,
      is_featured: dto.is_featured || false,
      status: 'PUBLISHED',
      availability: dto.availability,
    };

    // Use SupabaseRestClient to create the content
    const result = await this.supabaseClient.insert('content', contentData);
    const createdContent = result[0];

    this.logger.log(`Content created successfully with Supabase: ${(createdContent as any)?.id || 'unknown'}`);

    // Notify Telegram subscribers if content is published and bot service is available
    if (contentData.status === 'PUBLISHED' && this.botNotificationService) {
      try {
        const notifiedCount = await this.botNotificationService.notifyNewContent(
          createdContent as any,
          true, // throttle enabled
        );
        this.logger.log(`Telegram notification sent to ${notifiedCount} subscribers for content ${(createdContent as any)?.id}`);
      } catch (botError) {
        this.logger.error(`Failed to send Telegram notifications: ${botError.message}`);
        // Don't fail the creation if bot notification fails
      }
    }

    return createdContent;
  }

  /**
   * Initiate multipart upload for content video file
   */
  async initiateUpload(dto: InitiateUploadDto, userId?: string) {
    this.logger.log(`Initiating upload for content ${dto.content_id}`);

    // Verify content exists
    const content = await this.contentRepository.findOne({
      where: { id: dto.content_id },
    });

    if (!content) {
      throw new NotFoundException(`Content ${dto.content_id} not found`);
    }

    // Validate file
    const validation = this.uploadService.validateUploadFile(
      dto.file_name,
      dto.file_size,
      dto.content_type,
    );

    if (!validation.valid) {
      throw new BadRequestException(validation.error);
    }

    // Initiate multipart upload
    const uploadResult = await this.uploadService.initiateMultipartUpload(
      dto.file_name,
      dto.content_type,
      dto.file_size,
      dto.chunk_size,
    );

    // Update content with upload info
    await this.contentRepository.update(dto.content_id, {
      processing_status: VideoProcessingStatus.UPLOADING,
      file_storage_key: uploadResult.key,
    });

    // Log upload initiation
    await this.systemLogRepository.save({
      entity_type: 'content',
      entity_id: dto.content_id,
      action: 'upload_initiate',
      user_id: userId,
      meta: {
        file_name: dto.file_name,
        file_size: dto.file_size,
        upload_id: uploadResult.uploadId,
        key: uploadResult.key,
      },
    });

    this.logger.log(`Upload initiated for content ${dto.content_id}: ${uploadResult.uploadId}`);

    return {
      uploadId: uploadResult.uploadId,
      key: uploadResult.key,
      presignedUrls: uploadResult.presignedUrls,
      contentId: dto.content_id,
    };
  }

  /**
   * Complete multipart upload and trigger transcoding
   */
  async completeUpload(dto: CompleteUploadDto, userId?: string) {
    this.logger.log(`Completing upload for content ${dto.content_id}`);

    const content = await this.contentRepository.findOne({
      where: { id: dto.content_id },
    });

    if (!content) {
      throw new NotFoundException(`Content ${dto.content_id} not found`);
    }

    try {
      // Complete S3 multipart upload
      const s3Location = await this.uploadService.completeMultipartUpload({
        uploadId: dto.upload_id,
        key: dto.key,
        parts: dto.parts,
      });

      // Update content status to PROCESSING
      await this.contentRepository.update(dto.content_id, {
        processing_status: VideoProcessingStatus.PROCESSING,
        processing_started_at: new Date(),
        original_file_path: s3Location,
      });

      // Log completion
      await this.systemLogRepository.save({
        entity_type: 'content',
        entity_id: dto.content_id,
        action: 'upload_complete',
        user_id: userId,
        meta: {
          upload_id: dto.upload_id,
          key: dto.key,
          parts_count: dto.parts.length,
          s3_location: s3Location,
        },
      });

      // Push to transcode queue
      const transcodeJob = await this.queueService.addTranscodingJob({
        contentId: dto.content_id,
        type: 'content',
        sourceKey: dto.key,
        outputBasePath: `content/${dto.content_id}/hls`,
        qualities: ['1080p', '720p', '480p', '360p'],
        userId,
      });

      this.logger.log(`Upload completed for content ${dto.content_id}, transcode job ${transcodeJob.id} added to queue`);

      return {
        success: true,
        contentId: dto.content_id,
        s3Location,
        jobId: transcodeJob.id,
        status: VideoProcessingStatus.PROCESSING,
        message: 'Upload completed successfully. Transcoding will begin shortly.',
      };
    } catch (error) {
      this.logger.error(`Failed to complete upload: ${error.message}`, error.stack);

      // Update content with error
      await this.contentRepository.update(dto.content_id, {
        processing_status: VideoProcessingStatus.FAILED,
        processing_error: error.message,
      });

      throw new BadRequestException(`Failed to complete upload: ${error.message}`);
    }
  }

  /**
   * Publish content (set status to PUBLISHED)
   */
  async publishContent(dto: PublishContentDto, userId?: string) {
    this.logger.log(`Publishing content ${dto.content_id}`);

    const content = await this.contentRepository.findOne({
      where: { id: dto.content_id },
    });

    if (!content) {
      throw new NotFoundException(`Content ${dto.content_id} not found`);
    }

    // Verify content is ready for publishing
    if (content.processing_status !== VideoProcessingStatus.READY) {
      throw new BadRequestException(
        `Content cannot be published. Processing status: ${content.processing_status}`,
      );
    }

    // For movies, verify at least one language has video uploaded
    // (Old system used hls_master_url, new system uses content_languages)
    if (content.type === 'movie') {
      const languages = await this.supabaseClient.select(
        'content_languages',
        {
          select: 'id,video_url',
          where: { content_id: dto.content_id }
        }
      );

      if (!languages || languages.length === 0 || !languages.some(lang => lang.video_url)) {
        throw new BadRequestException('Filme não possui vídeos. Faça upload de pelo menos um idioma (DUBLADO ou LEGENDADO) antes de publicar.');
      }

      this.logger.log(`Movie has ${languages.length} language(s) with videos uploaded`);
    }

    // For series, verify at least one episode has video uploaded
    if (content.type === 'series') {
      const episodes = await this.supabaseClient.select(
        'episodes',
        {
          select: 'id,storage_path,season_number,episode_number',
          where: { series_id: dto.content_id }
        }
      );

      if (!episodes || episodes.length === 0 || !episodes.some(ep => ep.storage_path)) {
        throw new BadRequestException('Série não possui episódios. Faça upload de pelo menos um episódio antes de publicar.');
      }

      this.logger.log(`Series has ${episodes.length} episode(s) with videos uploaded`);
    }

    // Update status to PUBLISHED
    await this.contentRepository.update(dto.content_id, {
      status: ContentStatus.PUBLISHED,
    });

    // Reload content with updated status
    const publishedContent = await this.contentRepository.findOne({
      where: { id: dto.content_id },
      relations: ['categories'],
    });

    // Log publication
    await this.systemLogRepository.save({
      entity_type: 'content',
      entity_id: dto.content_id,
      action: 'content_publish',
      user_id: userId,
      meta: {
        title: content.title,
        notify_users: dto.notify_users,
      },
    });

    this.logger.log(`Content published: ${dto.content_id}`);

    // Notify Telegram subscribers if requested
    if (dto.notify_users && publishedContent) {
      try {
        const notifiedCount = await this.botNotificationService.notifyNewContent(
          publishedContent,
          true, // throttle enabled (30 msgs/sec)
        );
        this.logger.log(`Telegram notification sent to ${notifiedCount} subscribers for content ${dto.content_id}`);
      } catch (botError) {
        this.logger.error(`Failed to send Telegram notifications: ${botError.message}`);
        // Don't fail the publish operation if bot notification fails
      }
    }

    return {
      success: true,
      contentId: dto.content_id,
      status: ContentStatus.PUBLISHED,
      message: 'Content published successfully',
    };
  }

  /**
   * Get content upload/processing status
   */
  async getContentStatus(contentId: string) {
    const content = await this.contentRepository.findOne({
      where: { id: contentId },
      select: [
        'id',
        'title',
        'status',
        'processing_status',
        'processing_progress',
        'processing_error',
        'processing_started_at',
        'processing_completed_at',
        'hls_master_url',
        'available_qualities',
      ],
    });

    if (!content) {
      throw new NotFoundException(`Content ${contentId} not found`);
    }

    return {
      id: content.id,
      title: content.title,
      status: content.status,
      processing_status: content.processing_status,
      processing_progress: content.processing_progress,
      processing_error: content.processing_error,
      processing_started_at: content.processing_started_at,
      processing_completed_at: content.processing_completed_at,
      is_ready: content.processing_status === VideoProcessingStatus.READY,
      hls_available: !!content.hls_master_url,
      available_qualities: content.available_qualities ? JSON.parse(content.available_qualities) : [],
    };
  }

  /**
   * Create series with Stripe integration
   */
  async createSeries(dto: CreateSeriesDto, userId?: string): Promise<Series> {
    this.logger.log(`Creating series: ${dto.title}`);

    try {
      // Create Stripe product for series (only if not price_per_episode)
      let stripeProductId: string | undefined;
      let stripePriceId: string | undefined;

      if (!dto.price_per_episode) {
        const stripeResult = await this.stripeService.createProductWithPrice(
          {
            name: dto.title,
            description: dto.description,
            metadata: {
              content_type: 'series',
              price_per_episode: dto.price_per_episode ? 'true' : 'false',
            },
          },
          {
            unitAmount: dto.price_cents,
            currency: dto.currency || 'brl',
          },
        );

        stripeProductId = stripeResult.productId;
        stripePriceId = stripeResult.priceId;

        this.logger.log(`Stripe product for series created: ${stripeProductId}`);
      }

      // Get categories
      let categories: Category[] = [];
      if (dto.category_ids && dto.category_ids.length > 0) {
        categories = await this.categoryRepository.find({
          where: { id: In(dto.category_ids) },
        });
      }

      // Create series
      const series = this.seriesRepository.create({
        title: dto.title,
        description: dto.description,
        price_cents: dto.price_cents,
        currency: dto.currency || 'BRL',
        price_per_episode: dto.price_per_episode || false,
        availability: dto.availability,
        stripe_product_id: stripeProductId,
        stripe_price_id: stripePriceId,
        genres: dto.genres ? JSON.stringify(dto.genres) : undefined,
        total_seasons: dto.total_seasons || 1,
        status: ContentStatus.DRAFT,
        categories,
        created_by: userId ? ({ id: userId } as any) : undefined,
      });

      const savedSeries = await this.seriesRepository.save(series);

      this.logger.log(`Series created: ${savedSeries.id}`);
      return savedSeries;
    } catch (error) {
      this.logger.error(`Failed to create series: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to create series: ${error.message}`);
    }
  }

  /**
   * Create episode for series
   */
  async createEpisode(dto: CreateEpisodeDto, userId?: string): Promise<Episode> {
    this.logger.log(`Creating episode S${dto.season_number}E${dto.episode_number} for series ${dto.series_id}`);

    const series = await this.seriesRepository.findOne({
      where: { id: dto.series_id },
    });

    if (!series) {
      throw new NotFoundException(`Series ${dto.series_id} not found`);
    }

    try {
      let stripeProductId: string | undefined;
      let stripePriceId: string | undefined;

      // Create Stripe product if series is price_per_episode
      if (series.price_per_episode && dto.price_cents) {
        const stripeResult = await this.stripeService.createProductWithPrice(
          {
            name: `${series.title} - S${dto.season_number}E${dto.episode_number}: ${dto.title}`,
            description: dto.description,
            metadata: {
              content_type: 'episode',
              series_id: series.id,
              season: dto.season_number.toString(),
              episode: dto.episode_number.toString(),
            },
          },
          {
            unitAmount: dto.price_cents,
            currency: series.currency,
          },
        );

        stripeProductId = stripeResult.productId;
        stripePriceId = stripeResult.priceId;
      }

      const episode = this.episodeRepository.create({
        series_id: dto.series_id,
        title: dto.title,
        description: dto.description,
        season_number: dto.season_number,
        episode_number: dto.episode_number,
        price_cents: dto.price_cents,
        currency: series.currency,
        stripe_product_id: stripeProductId,
        stripe_price_id: stripePriceId,
        duration_minutes: dto.duration_minutes,
        processing_status: VideoProcessingStatus.PENDING,
        created_by: userId ? ({ id: userId } as any) : undefined,
      });

      const savedEpisode = await this.episodeRepository.save(episode);

      this.logger.log(`Episode created: ${savedEpisode.id}`);
      return savedEpisode;
    } catch (error) {
      this.logger.error(`Failed to create episode: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to create episode: ${error.message}`);
    }
  }
}
