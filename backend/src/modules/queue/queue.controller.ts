import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBody } from '@nestjs/swagger';
import { QueueService, TranscodingJobData, QueueJobOptions } from './services/queue.service';

@ApiTags('queue')
@Controller('admin/queue')
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  @Post('transcode')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Add transcoding job to queue',
    description: 'Queues a video for transcoding with specified options'
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        contentId: { type: 'string', description: 'Content ID to transcode' },
        inputPath: { type: 'string', description: 'S3 path to input video file' },
        outputBasePath: { type: 'string', description: 'S3 base path for output files' },
        qualities: {
          type: 'array',
          items: { type: 'string' },
          description: 'Quality variants to generate',
          example: ['1080p', '720p', '480p', '360p']
        },
        priority: { type: 'number', description: 'Job priority (1-100, higher = more priority)' },
        userId: { type: 'string', description: 'User who initiated the job' }
      },
      required: ['contentId', 'inputPath']
    }
  })
  @ApiResponse({ status: 201, description: 'Job queued successfully' })
  @ApiResponse({ status: 400, description: 'Invalid job data' })
  async addTranscodingJob(
    @Body() jobData: TranscodingJobData & { options?: QueueJobOptions }
  ) {
    const { options, ...data } = jobData;

    if (!data.contentId || !data.sourceKey) {
      throw new BadRequestException('contentId and sourceKey are required');
    }

    const job = await this.queueService.addTranscodingJob(data, options);

    return {
      jobId: job.id,
      contentId: data.contentId,
      status: 'queued',
      queuedAt: new Date(),
      message: 'Transcoding job added to queue successfully',
    };
  }

  @Get('jobs')
  @ApiOperation({
    summary: 'Get recent jobs',
    description: 'Returns a paginated list of recent transcoding jobs'
  })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of jobs to return (default: 50)' })
  @ApiQuery({ name: 'offset', required: false, description: 'Number of jobs to skip (default: 0)' })
  @ApiResponse({ status: 200, description: 'Jobs retrieved successfully' })
  async getRecentJobs(
    @Query('limit') limit?: number,
    @Query('offset') offset?: number
  ) {
    const parsedLimit = limit ? Math.min(Math.max(parseInt(limit.toString()), 1), 100) : 50;
    const parsedOffset = offset ? Math.max(parseInt(offset.toString()), 0) : 0;

    return this.queueService.getRecentJobs(parsedLimit, parsedOffset);
  }

  @Get('job/:jobId')
  @ApiOperation({
    summary: 'Get job details',
    description: 'Returns detailed information about a specific job'
  })
  @ApiParam({ name: 'jobId', description: 'Job ID' })
  @ApiResponse({ status: 200, description: 'Job details retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  async getJob(@Param('jobId') jobId: string) {
    const job = await this.queueService.getJob(jobId);

    if (!job) {
      throw new BadRequestException(`Job ${jobId} not found`);
    }

    const state = await job.getState();
    const progress = await this.queueService.getJobProgress(jobId);

    return {
      id: job.id,
      contentId: job.data.contentId,
      status: state,
      progress: progress?.progress || 0,
      stage: progress?.stage || 'unknown',
      data: job.data,
      createdAt: new Date(job.timestamp),
      processedAt: job.processedOn ? new Date(job.processedOn) : null,
      completedAt: job.finishedOn ? new Date(job.finishedOn) : null,
      failedReason: job.failedReason,
      attempts: job.attemptsMade,
      maxAttempts: job.opts.attempts,
    };
  }

  @Get('job/:jobId/progress')
  @ApiOperation({
    summary: 'Get job progress',
    description: 'Returns current progress information for a job'
  })
  @ApiParam({ name: 'jobId', description: 'Job ID' })
  @ApiResponse({ status: 200, description: 'Job progress retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  async getJobProgress(@Param('jobId') jobId: string) {
    const progress = await this.queueService.getJobProgress(jobId);

    if (!progress) {
      throw new BadRequestException(`Job ${jobId} not found`);
    }

    return progress;
  }

  @Get('content/:contentId/jobs')
  @ApiOperation({
    summary: 'Get jobs for content',
    description: 'Returns all jobs associated with a specific content ID'
  })
  @ApiParam({ name: 'contentId', description: 'Content ID' })
  @ApiResponse({ status: 200, description: 'Content jobs retrieved successfully' })
  async getJobsForContent(@Param('contentId') contentId: string) {
    const jobs = await this.queueService.getJobsForContent(contentId);

    const jobDetails = await Promise.all(
      jobs.map(async (job) => {
        const state = await job.getState();
        const progress = await this.queueService.getJobProgress(job.id!);

        return {
          id: job.id,
          status: state,
          progress: progress?.progress || 0,
          stage: progress?.stage || 'unknown',
          createdAt: new Date(job.timestamp),
          processedAt: job.processedOn ? new Date(job.processedOn) : null,
          completedAt: job.finishedOn ? new Date(job.finishedOn) : null,
          failedReason: job.failedReason,
        };
      })
    );

    return {
      contentId,
      jobs: jobDetails,
      total: jobDetails.length,
    };
  }

  @Post('job/:jobId/retry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Retry failed job',
    description: 'Retries a failed transcoding job'
  })
  @ApiParam({ name: 'jobId', description: 'Job ID' })
  @ApiResponse({ status: 200, description: 'Job queued for retry' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  @ApiResponse({ status: 400, description: 'Job cannot be retried' })
  async retryJob(@Param('jobId') jobId: string) {
    const job = await this.queueService.retryJob(jobId);

    if (!job) {
      throw new BadRequestException(`Job ${jobId} not found or cannot be retried`);
    }

    return {
      jobId: job.id,
      contentId: job.data.contentId,
      status: 'queued',
      message: 'Job queued for retry',
    };
  }

  @Delete('job/:jobId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel job',
    description: 'Cancels a pending or active transcoding job'
  })
  @ApiParam({ name: 'jobId', description: 'Job ID' })
  @ApiResponse({ status: 200, description: 'Job cancelled successfully' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  async cancelJob(@Param('jobId') jobId: string) {
    const success = await this.queueService.cancelJob(jobId);

    if (!success) {
      throw new BadRequestException(`Job ${jobId} not found or cannot be cancelled`);
    }

    return {
      jobId,
      status: 'cancelled',
      message: 'Job cancelled successfully',
    };
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Get queue statistics',
    description: 'Returns current queue statistics and health information'
  })
  @ApiResponse({ status: 200, description: 'Queue statistics retrieved successfully' })
  async getQueueStats() {
    const [stats, health] = await Promise.all([
      this.queueService.getQueueStats(),
      this.queueService.getHealthStatus(),
    ]);

    return {
      ...stats,
      health,
      timestamp: new Date(),
    };
  }

  @Post('pause')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Pause queue',
    description: 'Pauses the transcoding queue (admin only)'
  })
  @ApiResponse({ status: 200, description: 'Queue paused successfully' })
  async pauseQueue() {
    await this.queueService.pauseQueue();

    return {
      status: 'paused',
      message: 'Transcoding queue paused successfully',
    };
  }

  @Post('resume')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resume queue',
    description: 'Resumes the transcoding queue (admin only)'
  })
  @ApiResponse({ status: 200, description: 'Queue resumed successfully' })
  async resumeQueue() {
    await this.queueService.resumeQueue();

    return {
      status: 'active',
      message: 'Transcoding queue resumed successfully',
    };
  }

  @Post('clean')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Clean old jobs',
    description: 'Removes old completed and failed jobs from the queue'
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        maxAge: { type: 'number', description: 'Maximum age in milliseconds (default: 24 hours)' },
        maxCount: { type: 'number', description: 'Maximum number of jobs to keep (default: 100)' }
      }
    },
    required: false
  })
  @ApiResponse({ status: 200, description: 'Old jobs cleaned successfully' })
  async cleanOldJobs(
    @Body() body: { maxAge?: number; maxCount?: number } = {}
  ) {
    const { maxAge, maxCount } = body;

    await this.queueService.cleanOldJobs(maxAge, maxCount);

    return {
      message: 'Old jobs cleaned successfully',
      maxAge: maxAge || 24 * 60 * 60 * 1000,
      maxCount: maxCount || 100,
    };
  }

  @Get('health')
  @ApiOperation({
    summary: 'Queue health check',
    description: 'Returns health status of the queue system'
  })
  @ApiResponse({ status: 200, description: 'Health status retrieved successfully' })
  async getHealthStatus() {
    return this.queueService.getHealthStatus();
  }
}