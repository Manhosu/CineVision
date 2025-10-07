import { Injectable, Logger, OnModuleDestroy, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { TranscodeService } from '../../content/services/transcode.service';

export interface TranscodingJobData {
  contentId?: string;
  episodeId?: string;
  type: 'content' | 'episode';
  sourceKey: string;
  outputBasePath: string;
  qualities?: string[];
  userId?: string;
}

export interface QueueJobOptions {
  priority?: number;
  delay?: number;
  attempts?: number;
  backoff?: {
    type: 'exponential' | 'fixed';
    delay: number;
  };
}

export interface JobProgress {
  jobId: string;
  contentId: string;
  progress: number;
  stage: string;
  eta?: number;
}

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private readonly redis: Redis;
  private readonly transcodingQueue: Queue<TranscodingJobData>;
  private readonly workers: Worker[] = [];
  private readonly redisEnabled: boolean;

  constructor(
    private configService: ConfigService,
    @Inject(forwardRef(() => TranscodeService))
    private transcodeService: TranscodeService,
  ) {
    this.redisEnabled = this.configService.get('REDIS_ENABLED', 'false') === 'true';
    
    if (this.redisEnabled) {
      // Redis connection
      this.redis = new Redis({
        host: this.configService.get('REDIS_HOST', 'localhost'),
        port: parseInt(this.configService.get('REDIS_PORT', '6379')),
        password: this.configService.get('REDIS_PASSWORD'),
        db: parseInt(this.configService.get('REDIS_DB', '0')),
        maxRetriesPerRequest: 3,
      });

      // Create transcoding queue
      this.transcodingQueue = new Queue<TranscodingJobData>('video-transcoding', {
        connection: this.redis,
        defaultJobOptions: {
          removeOnComplete: 50,
          removeOnFail: 100,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
        },
      });

      // Initialize worker to process transcoding jobs
      this.initializeWorker();

      this.logger.log('Queue service initialized with Redis connection');
    } else {
      this.logger.log('Queue service initialized without Redis (development mode)');
    }
  }

  /**
   * Add transcoding job to queue
   */
  async addTranscodingJob(
    data: TranscodingJobData,
    options: QueueJobOptions = {}
  ): Promise<Job<TranscodingJobData>> {
    if (!this.redisEnabled || !this.transcodingQueue) {
      this.logger.warn('Redis is disabled. Transcoding job will be processed immediately.');
      // Return a mock job for development
      return {
        id: `mock-${Date.now()}`,
        data,
        progress: 100,
        opts: options,
        remove: async () => {},
        retry: async () => {},
      } as any;
    }

    const jobOptions = {
      priority: options.priority || 10,
      delay: options.delay || 0,
      attempts: options.attempts || 3,
      backoff: options.backoff || {
        type: 'exponential' as const,
        delay: 5000,
      },
    };

    const job = await this.transcodingQueue.add(
      'transcode-video',
      data,
      jobOptions
    );

    const entityId = data.contentId || data.episodeId;
    this.logger.log(`Transcoding job added to queue: ${job.id} for ${data.type} ${entityId}`);

    return job;
  }

  /**
   * Get job by ID
   */
  async getJob(jobId: string): Promise<Job<TranscodingJobData> | undefined> {
    if (!this.redisEnabled || !this.transcodingQueue) {
      this.logger.warn('Redis is disabled. Cannot retrieve job.');
      return undefined;
    }
    return this.transcodingQueue.getJob(jobId);
  }

  /**
   * Get job progress
   */
  async getJobProgress(jobId: string): Promise<JobProgress | null> {
    if (!this.redisEnabled || !this.transcodingQueue) {
      this.logger.warn('Redis is disabled. Cannot retrieve job progress.');
      return null;
    }

    const job = await this.getJob(jobId);

    if (!job) {
      return null;
    }

    const progress = job.progress as any;

    return {
      jobId: job.id!,
      contentId: job.data.contentId || job.data.episodeId,
      progress: typeof progress === 'number' ? progress : progress?.percentage || 0,
      stage: progress?.stage || 'pending',
      eta: progress?.eta,
    };
  }

  /**
   * Get all jobs for content
   */
  async getJobsForContent(contentId: string): Promise<Job<TranscodingJobData>[]> {
    if (!this.redisEnabled || !this.transcodingQueue) {
      this.logger.warn('Redis is disabled. Cannot retrieve jobs for content.');
      return [];
    }

    const jobs = await this.transcodingQueue.getJobs(['waiting', 'active', 'completed', 'failed']);

    return jobs.filter(job => job.data.contentId === contentId || job.data.episodeId === contentId);
  }

  /**
   * Cancel job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    if (!this.redisEnabled || !this.transcodingQueue) {
      this.logger.warn('Redis is disabled. Cannot cancel job.');
      return false;
    }

    const job = await this.getJob(jobId);

    if (!job) {
      return false;
    }

    try {
      await job.remove();
      this.logger.log(`Job ${jobId} cancelled successfully`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to cancel job ${jobId}: ${error.message}`);
      return false;
    }
  }

  /**
   * Retry failed job
   */
  async retryJob(jobId: string): Promise<Job<TranscodingJobData> | null> {
    if (!this.redisEnabled || !this.transcodingQueue) {
      this.logger.warn('Redis is disabled. Cannot retry job.');
      return null;
    }

    const job = await this.getJob(jobId);

    if (!job) {
      return null;
    }

    try {
      await job.retry();
      this.logger.log(`Job ${jobId} queued for retry`);
      return job;
    } catch (error) {
      this.logger.error(`Failed to retry job ${jobId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    if (!this.redisEnabled || !this.transcodingQueue) {
      this.logger.warn('Redis is disabled. Returning empty queue stats.');
      return {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
      };
    }

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.transcodingQueue.getWaiting(),
      this.transcodingQueue.getActive(),
      this.transcodingQueue.getCompleted(),
      this.transcodingQueue.getFailed(),
      this.transcodingQueue.getDelayed(),
    ]);

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
    };
  }

  /**
   * Get recent jobs with pagination
   */
  async getRecentJobs(
    limit: number = 50,
    offset: number = 0
  ): Promise<{
    jobs: Array<{
      id: string;
      contentId: string;
      status: string;
      progress: number;
      createdAt: Date;
      processedAt?: Date;
      failedReason?: string;
    }>;
    total: number;
  }> {
    if (!this.redisEnabled || !this.transcodingQueue) {
      this.logger.warn('Redis is disabled. Cannot retrieve recent jobs.');
      return {
        jobs: [],
        total: 0,
      };
    }

    const jobs = await this.transcodingQueue.getJobs(
      ['waiting', 'active', 'completed', 'failed'],
      offset,
      offset + limit - 1
    );

    const jobData = await Promise.all(jobs.map(async job => ({
      id: job.id!,
      contentId: job.data.contentId || job.data.episodeId,
      status: await job.getState(),
      progress: typeof job.progress === 'number' ? job.progress : 0,
      createdAt: new Date(job.timestamp),
      processedAt: job.processedOn ? new Date(job.processedOn) : undefined,
      failedReason: job.failedReason,
    })));

    const stats = await this.getQueueStats();
    const total = stats.waiting + stats.active + stats.completed + stats.failed + stats.delayed;

    return {
      jobs: jobData,
      total,
    };
  }

  /**
   * Initialize worker to process transcoding jobs
   */
  private initializeWorker(): void {
    if (!this.redisEnabled || !this.redis) {
      return;
    }

    const worker = new Worker<TranscodingJobData>(
      'video-transcoding',
      async (job: Job<TranscodingJobData>) => {
        this.logger.log(`Processing transcode job ${job.id}`);
        return await this.transcodeService.processTranscodeJob(job);
      },
      {
        connection: this.redis,
        concurrency: parseInt(this.configService.get('TRANSCODE_CONCURRENCY', '2')),
        limiter: {
          max: 10,
          duration: 1000,
        },
      },
    );

    // Worker event listeners
    worker.on('completed', (job) => {
      this.logger.log(`Job ${job.id} completed successfully`);
    });

    worker.on('failed', (job, error) => {
      this.logger.error(`Job ${job?.id} failed: ${error.message}`);
    });

    worker.on('progress', (job, progress) => {
      const progressData = progress as any;
      this.logger.log(
        `Job ${job.id} progress: ${progressData.percentage}% - ${progressData.stage}`,
      );
    });

    worker.on('error', (error) => {
      this.logger.error(`Worker error: ${error.message}`);
    });

    this.workers.push(worker);
    this.logger.log('Transcode worker initialized');
  }

  /**
   * Clean old jobs
   */
  async cleanOldJobs(
    maxAge: number = 24 * 60 * 60 * 1000, // 24 hours
    maxCount: number = 100
  ): Promise<void> {
    if (!this.redisEnabled || !this.transcodingQueue) {
      this.logger.warn('Redis is disabled. Cannot clean old jobs.');
      return;
    }

    try {
      await this.transcodingQueue.clean(maxAge, maxCount, 'completed');
      await this.transcodingQueue.clean(maxAge, maxCount, 'failed');

      this.logger.log(`Cleaned old jobs older than ${maxAge}ms, keeping max ${maxCount} jobs`);
    } catch (error) {
      this.logger.error(`Failed to clean old jobs: ${error.message}`);
    }
  }

  /**
   * Pause queue
   */
  async pauseQueue(): Promise<void> {
    if (!this.redisEnabled || !this.transcodingQueue) {
      this.logger.warn('Redis is disabled. Cannot pause queue.');
      return;
    }
    await this.transcodingQueue.pause();
    this.logger.log('Transcoding queue paused');
  }

  /**
   * Resume queue
   */
  async resumeQueue(): Promise<void> {
    if (!this.redisEnabled || !this.transcodingQueue) {
      this.logger.warn('Redis is disabled. Cannot resume queue.');
      return;
    }
    await this.transcodingQueue.resume();
    this.logger.log('Transcoding queue resumed');
  }

  /**
   * Get queue health status
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'unhealthy';
    redisConnected: boolean;
    queueActive: boolean;
    activeJobs: number;
    failedJobs: number;
    timestamp: Date;
  }> {
    if (!this.redisEnabled) {
      return {
        status: 'healthy',
        redisConnected: false,
        queueActive: false,
        activeJobs: 0,
        failedJobs: 0,
        timestamp: new Date(),
      };
    }

    try {
      const stats = await this.getQueueStats();
      const redisConnected = this.redis.status === 'ready';
      const queueActive = !this.transcodingQueue.isPaused();

      return {
        status: redisConnected && queueActive ? 'healthy' : 'unhealthy',
        redisConnected,
        queueActive,
        activeJobs: stats.active,
        failedJobs: stats.failed,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Health check failed: ${error.message}`);
      return {
        status: 'unhealthy',
        redisConnected: false,
        queueActive: false,
        activeJobs: 0,
        failedJobs: 0,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Add event listeners for job monitoring
   */
  setupEventListeners(): void {
    // Event listeners temporarily disabled due to type compatibility issues
    // TODO: Fix event listener types for bullmq
    this.logger.log('Queue event listeners setup (temporarily disabled)');
  }

  /**
   * Cleanup on module destroy
   */
  async onModuleDestroy(): Promise<void> {
    this.logger.log('Shutting down queue service...');

    if (!this.redisEnabled) {
      this.logger.log('Queue service shutdown complete (Redis was disabled)');
      return;
    }

    try {
      // Close all workers
      await Promise.all(this.workers.map(worker => worker.close()));

      // Close queue
      if (this.transcodingQueue) {
        await this.transcodingQueue.close();
      }

      // Close Redis connection
      if (this.redis) {
        await this.redis.quit();
      }

      this.logger.log('Queue service shutdown complete');
    } catch (error) {
      this.logger.error(`Error during queue service shutdown: ${error.message}`);
    }
  }

  /**
   * Get the underlying queue instance for advanced operations
   */
  getQueue(): Queue<TranscodingJobData> | null {
    return this.redisEnabled ? this.transcodingQueue : null;
  }

  /**
   * Get Redis instance
   */
  getRedis(): Redis | null {
    return this.redisEnabled ? this.redis : null;
  }
}