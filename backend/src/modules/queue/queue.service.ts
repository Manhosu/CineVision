import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Queue, Worker, Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { Content, VideoProcessingStatus } from '../content/entities/content.entity';
import { Episode } from '../content/entities/episode.entity';
import { SystemLog } from '../logs/entities/system-log.entity';
import Redis from 'ioredis';

export interface TranscodeJobData {
  contentId?: string;
  episodeId?: string;
  type: 'content' | 'episode';
  sourceKey: string;
  outputBasePath: string;
  qualities?: string[]; // ['1080p', '720p', '480p', '360p']
}

export interface TranscodeJobProgress {
  stage: 'downloading' | 'transcoding' | 'uploading' | 'complete';
  progress: number; // 0-100
  currentQuality?: string;
  error?: string;
}

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);
  private transcodeQueue: Queue<TranscodeJobData>;
  private transcodeWorker: Worker<TranscodeJobData>;
  private redisConnection: Redis;

  constructor(
    @InjectRepository(Content)
    private contentRepository: Repository<Content>,
    @InjectRepository(Episode)
    private episodeRepository: Repository<Episode>,
    @InjectRepository(SystemLog)
    private systemLogRepository: Repository<SystemLog>,
    private configService: ConfigService,
  ) {
    this.initializeQueue();
  }

  private initializeQueue() {
    const redisEnabled = this.configService.get('REDIS_ENABLED') === 'true';

    if (!redisEnabled) {
      this.logger.warn('Redis is disabled. Queue functionality will be mocked.');
      return;
    }

    // Initialize Redis connection
    this.redisConnection = new Redis({
      host: this.configService.get('REDIS_HOST', 'localhost'),
      port: this.configService.get('REDIS_PORT', 6379),
      password: this.configService.get('REDIS_PASSWORD'),
      db: this.configService.get('REDIS_DB', 0),
      maxRetriesPerRequest: null,
    });

    // Initialize transcode queue
    this.transcodeQueue = new Queue<TranscodeJobData>('video-transcode', {
      connection: this.redisConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: {
          age: 24 * 3600, // Keep completed jobs for 24 hours
          count: 100,
        },
        removeOnFail: {
          age: 7 * 24 * 3600, // Keep failed jobs for 7 days
        },
      },
    });

    this.logger.log('Transcode queue initialized');

    // Initialize worker (this would normally be in a separate worker process)
    this.initializeWorker();
  }

  private initializeWorker() {
    this.transcodeWorker = new Worker<TranscodeJobData>(
      'video-transcode',
      async (job: Job<TranscodeJobData>) => {
        return this.processTranscodeJob(job);
      },
      {
        connection: this.redisConnection,
        concurrency: this.configService.get('TRANSCODE_CONCURRENCY', 2),
      },
    );

    this.transcodeWorker.on('completed', (job) => {
      this.logger.log(`Transcode job ${job.id} completed successfully`);
    });

    this.transcodeWorker.on('failed', (job, err) => {
      this.logger.error(`Transcode job ${job?.id} failed: ${err.message}`);
    });

    this.transcodeWorker.on('error', (err) => {
      this.logger.error(`Worker error: ${err.message}`);
    });

    this.logger.log('Transcode worker initialized');
  }

  /**
   * Add a transcode job to the queue
   */
  async addTranscodeJob(data: TranscodeJobData): Promise<string> {
    if (!this.transcodeQueue) {
      this.logger.warn('Queue not initialized. Simulating job addition.');

      // In development/mock mode, immediately update status to PROCESSING
      if (data.type === 'content') {
        await this.contentRepository.update(data.contentId, {
          processing_status: VideoProcessingStatus.PROCESSING,
          processing_progress: 0,
        });
      }

      return 'mock-job-id';
    }

    try {
      const job = await this.transcodeQueue.add('transcode', data, {
        jobId: `${data.type}-${data.contentId || data.episodeId}-${Date.now()}`,
      });

      this.logger.log(`Transcode job added: ${job.id} for ${data.type} ${data.contentId || data.episodeId}`);

      // Update processing status
      if (data.type === 'content') {
        await this.contentRepository.update(data.contentId, {
          processing_status: VideoProcessingStatus.PROCESSING,
          processing_progress: 0,
        });
      } else {
        await this.episodeRepository.update(data.episodeId, {
          processing_status: VideoProcessingStatus.PROCESSING,
          processing_progress: 0,
        });
      }

      return job.id;
    } catch (error) {
      this.logger.error(`Failed to add transcode job: ${error.message}`);
      throw error;
    }
  }

  /**
   * Process a transcode job (worker function)
   */
  private async processTranscodeJob(job: Job<TranscodeJobData>): Promise<void> {
    const { contentId, episodeId, type, sourceKey, outputBasePath, qualities } = job.data;

    this.logger.log(`Processing transcode job ${job.id} for ${type} ${contentId || episodeId}`);

    try {
      // Update progress: downloading
      await job.updateProgress({ stage: 'downloading', progress: 10 } as TranscodeJobProgress);
      await this.updateProgress(type, contentId, episodeId, 10);

      // TODO: Download source file from S3
      // const sourceFile = await this.downloadFromS3(sourceKey);

      // Update progress: transcoding
      await job.updateProgress({ stage: 'transcoding', progress: 20 } as TranscodeJobProgress);
      await this.updateProgress(type, contentId, episodeId, 20);

      // Default qualities if not provided
      const targetQualities = qualities || ['1080p', '720p', '480p', '360p'];

      // TODO: Transcode to each quality
      for (let i = 0; i < targetQualities.length; i++) {
        const quality = targetQualities[i];
        const progressBase = 20 + (i * 60 / targetQualities.length);

        this.logger.log(`Transcoding to ${quality}...`);
        await job.updateProgress({
          stage: 'transcoding',
          progress: progressBase,
          currentQuality: quality,
        } as TranscodeJobProgress);
        await this.updateProgress(type, contentId, episodeId, progressBase);

        // TODO: Call FFmpeg or AWS MediaConvert to transcode
        // await this.transcodeToQuality(sourceFile, quality, outputBasePath);
      }

      // Update progress: uploading
      await job.updateProgress({ stage: 'uploading', progress: 85 } as TranscodeJobProgress);
      await this.updateProgress(type, contentId, episodeId, 85);

      // TODO: Upload HLS manifests and segments to S3
      // await this.uploadToS3(outputBasePath);

      // Update progress: complete
      await job.updateProgress({ stage: 'complete', progress: 100 } as TranscodeJobProgress);

      // Update entity with HLS URLs and mark as READY
      const hlsMasterUrl = `${outputBasePath}/master.m3u8`;
      const hlsBasePath = outputBasePath;
      const availableQualities = JSON.stringify(targetQualities);

      if (type === 'content') {
        await this.contentRepository.update(contentId, {
          processing_status: VideoProcessingStatus.READY,
          processing_progress: 100,
          processing_completed_at: new Date(),
          hls_master_url: hlsMasterUrl,
          hls_base_path: hlsBasePath,
          available_qualities: availableQualities,
        });
      } else {
        await this.episodeRepository.update(episodeId, {
          processing_status: VideoProcessingStatus.READY,
          processing_progress: 100,
          processing_completed_at: new Date(),
          hls_master_url: hlsMasterUrl,
          hls_base_path: hlsBasePath,
          available_qualities: availableQualities,
        });
      }

      // Log completion
      await this.systemLogRepository.save({
        entity_type: type,
        entity_id: contentId || episodeId,
        action: 'transcode_complete',
        meta: {
          job_id: job.id,
          qualities: targetQualities,
          hls_master_url: hlsMasterUrl,
        },
      });

      this.logger.log(`Transcode job ${job.id} completed successfully`);
    } catch (error) {
      this.logger.error(`Transcode job ${job.id} failed: ${error.message}`, error.stack);

      // Update entity with error
      if (type === 'content') {
        await this.contentRepository.update(contentId, {
          processing_status: VideoProcessingStatus.FAILED,
          processing_error: error.message,
        });
      } else {
        await this.episodeRepository.update(episodeId, {
          processing_status: VideoProcessingStatus.FAILED,
          processing_error: error.message,
        });
      }

      // Log failure
      await this.systemLogRepository.save({
        entity_type: type,
        entity_id: contentId || episodeId,
        action: 'transcode_failed',
        meta: {
          job_id: job.id,
          error: error.message,
        },
      });

      throw error;
    }
  }

  private async updateProgress(type: string, contentId?: string, episodeId?: string, progress?: number) {
    if (type === 'content' && contentId) {
      await this.contentRepository.update(contentId, {
        processing_progress: progress,
      });
    } else if (type === 'episode' && episodeId) {
      await this.episodeRepository.update(episodeId, {
        processing_progress: progress,
      });
    }
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string) {
    if (!this.transcodeQueue) {
      return null;
    }

    const job = await this.transcodeQueue.getJob(jobId);
    if (!job) {
      return null;
    }

    return {
      id: job.id,
      state: await job.getState(),
      progress: job.progress,
      data: job.data,
      attemptsMade: job.attemptsMade,
      finishedOn: job.finishedOn,
      processedOn: job.processedOn,
      failedReason: job.failedReason,
    };
  }

  /**
   * Get queue stats
   */
  async getQueueStats() {
    if (!this.transcodeQueue) {
      return null;
    }

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.transcodeQueue.getWaitingCount(),
      this.transcodeQueue.getActiveCount(),
      this.transcodeQueue.getCompletedCount(),
      this.transcodeQueue.getFailedCount(),
      this.transcodeQueue.getDelayedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      total: waiting + active + completed + failed + delayed,
    };
  }

  /**
   * Clean up old jobs
   */
  async cleanupJobs(grace: number = 24 * 3600 * 1000) {
    if (!this.transcodeQueue) {
      return 0;
    }

    const cleaned = await this.transcodeQueue.clean(grace, 100, 'completed');
    this.logger.log(`Cleaned up ${cleaned.length} old jobs`);
    return cleaned.length;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: string; queue?: any }> {
    try {
      if (!this.transcodeQueue) {
        return { status: 'disabled' };
      }

      const stats = await this.getQueueStats();

      return {
        status: 'healthy',
        queue: stats,
      };
    } catch (error) {
      this.logger.error(`Queue health check failed: ${error.message}`);
      return { status: 'unhealthy' };
    }
  }
}
