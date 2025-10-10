import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Job, QueueOptions } from 'bull';
import * as Bull from 'bull';
import { VideoConversionService, ConversionProgress } from './video-conversion.service';
import { ContentLanguageService } from '../../content/services/content-language.service';

export interface ConversionJob {
  id: string;
  contentId: string;
  contentLanguageId: string;
  originalS3Key: string;
  originalUrl: string;
  format: 'mp4' | 'hls';
  audioType: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  message?: string;
  error?: string;
  outputUrl?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

@Injectable()
export class VideoQueueService implements OnModuleInit {
  private readonly logger = new Logger(VideoQueueService.name);
  private conversionQueue: Queue<ConversionJob>;
  private readonly jobStore = new Map<string, ConversionJob>();

  constructor(
    private configService: ConfigService,
    private videoConversionService: VideoConversionService,
    private contentLanguageService: ContentLanguageService,
  ) {}

  async onModuleInit() {
    await this.initializeQueue();
  }

  private async initializeQueue() {
    const redisEnabled = this.configService.get('REDIS_ENABLED') === 'true';

    if (!redisEnabled) {
      this.logger.warn('Redis está desabilitado. Conversões serão processadas sincronamente.');
      return;
    }

    const queueOptions: QueueOptions = {
      redis: {
        host: this.configService.get('REDIS_HOST') || 'localhost',
        port: parseInt(this.configService.get('REDIS_PORT') || '6379'),
        password: this.configService.get('REDIS_PASSWORD'),
        db: parseInt(this.configService.get('REDIS_DB') || '0'),
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    };

    this.conversionQueue = new Bull('video-conversion', queueOptions);

    // Processar jobs
    this.conversionQueue.process(async (job: Job<ConversionJob>) => {
      return await this.processConversionJob(job);
    });

    // Event listeners
    this.conversionQueue.on('completed', (job, result) => {
      this.logger.log(`Job ${job.id} concluído`);
    });

    this.conversionQueue.on('failed', (job, err) => {
      this.logger.error(`Job ${job.id} falhou: ${err.message}`);
    });

    this.conversionQueue.on('progress', (job, progress) => {
      this.logger.log(`Job ${job.id} progresso: ${progress}%`);
    });

    this.logger.log('Video conversion queue initialized');
  }

  /**
   * Adicionar job de conversão à fila
   */
  async addConversionJob(jobData: Omit<ConversionJob, 'id' | 'status' | 'progress' | 'createdAt'>): Promise<string> {
    const jobId = `conversion-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const job: ConversionJob = {
      ...jobData,
      id: jobId,
      status: 'pending',
      progress: 0,
      createdAt: new Date(),
    };

    // Salvar no store local
    this.jobStore.set(jobId, job);

    const redisEnabled = this.configService.get('REDIS_ENABLED') === 'true';

    if (redisEnabled && this.conversionQueue) {
      // Adicionar à fila do Bull
      await this.conversionQueue.add(job, {
        jobId,
      });

      this.logger.log(`Job ${jobId} adicionado à fila`);
    } else {
      // Processar imediatamente se Redis estiver desabilitado
      this.logger.log(`Processando job ${jobId} imediatamente (Redis desabilitado)`);
      this.processConversionJobSync(job).catch((error) => {
        this.logger.error(`Erro ao processar job ${jobId}:`, error);
      });
    }

    return jobId;
  }

  /**
   * Processar job de conversão
   */
  private async processConversionJob(job: Job<ConversionJob>): Promise<any> {
    const jobData = job.data;
    this.logger.log(`Processando job ${jobData.id}`);

    try {
      // Atualizar status
      this.updateJobStatus(jobData.id, {
        status: 'processing',
        startedAt: new Date(),
      });

      // Callback de progresso
      const onProgress = (progress: ConversionProgress) => {
        this.updateJobStatus(jobData.id, {
          progress: progress.progress,
          message: progress.message,
        });

        job.progress(progress.progress);
      };

      // Executar conversão
      const result = await this.videoConversionService.convertVideo(
        jobData.originalS3Key,
        jobData.format,
        onProgress
      );

      // Atualizar content_language com novo URL
      await this.contentLanguageService.update(jobData.contentLanguageId, {
        video_url: result.outputUrl,
        video_storage_key: result.outputKey,
        status: 'ready',
      });

      // Atualizar status do job
      this.updateJobStatus(jobData.id, {
        status: 'completed',
        progress: 100,
        outputUrl: result.outputUrl,
        completedAt: new Date(),
        message: 'Conversão concluída com sucesso!',
      });

      return result;

    } catch (error) {
      this.logger.error(`Erro no job ${jobData.id}:`, error);

      this.updateJobStatus(jobData.id, {
        status: 'failed',
        error: error.message,
        completedAt: new Date(),
      });

      throw error;
    }
  }

  /**
   * Processar job sincronamente (sem Redis)
   */
  private async processConversionJobSync(jobData: ConversionJob): Promise<void> {
    try {
      this.updateJobStatus(jobData.id, {
        status: 'processing',
        startedAt: new Date(),
      });

      const onProgress = (progress: ConversionProgress) => {
        this.updateJobStatus(jobData.id, {
          progress: progress.progress,
          message: progress.message,
        });
      };

      const result = await this.videoConversionService.convertVideo(
        jobData.originalS3Key,
        jobData.format,
        onProgress
      );

      await this.contentLanguageService.update(jobData.contentLanguageId, {
        video_url: result.outputUrl,
        video_storage_key: result.outputKey,
        status: 'ready',
      });

      this.updateJobStatus(jobData.id, {
        status: 'completed',
        progress: 100,
        outputUrl: result.outputUrl,
        completedAt: new Date(),
        message: 'Conversão concluída com sucesso!',
      });

    } catch (error) {
      this.logger.error(`Erro no job ${jobData.id}:`, error);

      this.updateJobStatus(jobData.id, {
        status: 'failed',
        error: error.message,
        completedAt: new Date(),
      });
    }
  }

  /**
   * Atualizar status do job
   */
  private updateJobStatus(jobId: string, updates: Partial<ConversionJob>) {
    const job = this.jobStore.get(jobId);
    if (job) {
      Object.assign(job, updates);
      this.jobStore.set(jobId, job);
    }
  }

  /**
   * Obter status do job
   */
  getJobStatus(jobId: string): ConversionJob | undefined {
    return this.jobStore.get(jobId);
  }

  /**
   * Listar todos os jobs
   */
  listJobs(): ConversionJob[] {
    return Array.from(this.jobStore.values());
  }

  /**
   * Limpar jobs antigos (concluídos há mais de 24h)
   */
  async cleanupOldJobs(): Promise<number> {
    const now = new Date().getTime();
    const maxAge = 24 * 60 * 60 * 1000; // 24 horas
    let cleaned = 0;

    for (const [jobId, job] of this.jobStore.entries()) {
      if (job.completedAt) {
        const age = now - job.completedAt.getTime();
        if (age > maxAge) {
          this.jobStore.delete(jobId);
          cleaned++;
        }
      }
    }

    this.logger.log(`Limpeza: ${cleaned} jobs antigos removidos`);
    return cleaned;
  }

  /**
   * Obter estatísticas da fila
   */
  async getQueueStats() {
    const jobs = this.listJobs();

    return {
      total: jobs.length,
      pending: jobs.filter(j => j.status === 'pending').length,
      processing: jobs.filter(j => j.status === 'processing').length,
      completed: jobs.filter(j => j.status === 'completed').length,
      failed: jobs.filter(j => j.status === 'failed').length,
    };
  }
}
