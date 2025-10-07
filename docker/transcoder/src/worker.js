const { Worker } = require('bullmq');
const Redis = require('ioredis');
const pino = require('pino');
const TranscodingService = require('./services/transcoding');
const S3Service = require('./services/s3');
const DatabaseService = require('./services/database');

// Environment configuration
const config = {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB) || 0,
  },
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    bucket: process.env.S3_VIDEO_BUCKET,
  },
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  },
  transcoding: {
    workDir: process.env.TRANSCODING_WORK_DIR || '/tmp/transcoding',
    concurrency: parseInt(process.env.WORKER_CONCURRENCY) || 2,
    ffmpegThreads: parseInt(process.env.FFMPEG_THREADS) || 0,
    segmentDuration: parseInt(process.env.SEGMENT_DURATION) || 6,
  },
};

// Logger setup
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname',
    },
  } : undefined,
});

// Services
const redis = new Redis(config.redis);
const s3Service = new S3Service(config.aws, logger);
const databaseService = new DatabaseService(config.database, logger);
const transcodingService = new TranscodingService(config.transcoding, logger, s3Service);

// Quality presets for transcoding
const QUALITY_PRESETS = {
  '1080p': {
    width: 1920,
    height: 1080,
    bitrate: 5000,
    audioBitrate: 192,
    crf: 23,
    preset: 'medium',
  },
  '720p': {
    width: 1280,
    height: 720,
    bitrate: 3000,
    audioBitrate: 128,
    crf: 24,
    preset: 'medium',
  },
  '480p': {
    width: 854,
    height: 480,
    bitrate: 1500,
    audioBitrate: 128,
    crf: 26,
    preset: 'medium',
  },
  '360p': {
    width: 640,
    height: 360,
    bitrate: 800,
    audioBitrate: 96,
    crf: 28,
    preset: 'fast',
  },
};

// Worker job processor
async function processTranscodingJob(job) {
  const { contentId, inputPath, outputBasePath, qualities = ['1080p', '720p', '480p', '360p'] } = job.data;

  logger.info({ contentId, inputPath }, 'Starting transcoding job');

  try {
    // Update job status
    await job.updateProgress(0);
    await databaseService.updateContentStatus(contentId, 'processing', 0);

    // Download input file
    logger.info({ contentId }, 'Downloading input file from S3');
    const localInputPath = await s3Service.downloadFile(inputPath, contentId);
    await job.updateProgress(10);

    // Analyze input video
    logger.info({ contentId }, 'Analyzing input video');
    const videoInfo = await transcodingService.analyzeVideo(localInputPath);
    logger.info({ contentId, videoInfo }, 'Video analysis complete');

    // Filter qualities based on input resolution
    const validQualities = qualities.filter(quality => {
      const preset = QUALITY_PRESETS[quality];
      return preset && preset.height <= videoInfo.height;
    });

    logger.info({ contentId, validQualities }, 'Starting transcoding for qualities');

    // Create video variant records
    await databaseService.createVideoVariants(contentId, validQualities, QUALITY_PRESETS);

    // Transcode each quality
    let completedQualities = 0;
    for (const quality of validQualities) {
      logger.info({ contentId, quality }, 'Starting quality transcoding');

      await databaseService.updateVariantStatus(contentId, quality, 'processing');

      // Progress calculation: 10-80% for transcoding, 20% for upload
      const baseProgress = 10 + (completedQualities / validQualities.length) * 70;

      try {
        const outputDir = await transcodingService.transcodeQuality(
          localInputPath,
          quality,
          QUALITY_PRESETS[quality],
          contentId,
          (progress) => {
            const totalProgress = baseProgress + (progress / validQualities.length) * 70;
            job.updateProgress(Math.round(totalProgress));
            databaseService.updateVariantProgress(contentId, quality, progress);
          }
        );

        // Upload HLS files for this quality
        logger.info({ contentId, quality }, 'Uploading HLS files');
        const hlsUrls = await s3Service.uploadHLSFiles(outputDir, outputBasePath, quality);

        await databaseService.updateVariantComplete(contentId, quality, hlsUrls);
        completedQualities++;

      } catch (error) {
        logger.error({ contentId, quality, error }, 'Quality transcoding failed');
        await databaseService.updateVariantStatus(contentId, quality, 'failed', error.message);
      }
    }

    // Generate and upload master playlist
    logger.info({ contentId }, 'Generating master playlist');
    const masterPlaylistPath = await transcodingService.generateMasterPlaylist(
      contentId,
      validQualities,
      QUALITY_PRESETS
    );

    const masterUrl = await s3Service.uploadMasterPlaylist(masterPlaylistPath, outputBasePath);
    await job.updateProgress(95);

    // Update content as ready
    await databaseService.updateContentComplete(contentId, masterUrl, outputBasePath, validQualities);

    // Cleanup local files
    await transcodingService.cleanup(contentId);

    await job.updateProgress(100);
    logger.info({ contentId }, 'Transcoding job completed successfully');

    return {
      contentId,
      masterUrl,
      qualities: validQualities,
      message: 'Transcoding completed successfully',
    };

  } catch (error) {
    logger.error({ contentId, error }, 'Transcoding job failed');

    await databaseService.updateContentStatus(contentId, 'failed', null, error.message);
    await transcodingService.cleanup(contentId);

    throw error;
  }
}

// Create worker
const worker = new Worker('video-transcoding', processTranscodingJob, {
  connection: redis,
  concurrency: config.transcoding.concurrency,
  removeOnComplete: 50, // Keep 50 completed jobs
  removeOnFail: 100,    // Keep 100 failed jobs for debugging
});

// Worker event handlers
worker.on('completed', (job) => {
  logger.info({ jobId: job.id, contentId: job.data.contentId }, 'Job completed successfully');
});

worker.on('failed', (job, err) => {
  logger.error({
    jobId: job?.id,
    contentId: job?.data?.contentId,
    error: err.message
  }, 'Job failed');
});

worker.on('progress', (job, progress) => {
  logger.debug({ jobId: job.id, contentId: job.data.contentId, progress }, 'Job progress updated');
});

worker.on('stalled', (jobId) => {
  logger.warn({ jobId }, 'Job stalled');
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  await worker.close();
  await redis.quit();
  await databaseService.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully');
  await worker.close();
  await redis.quit();
  await databaseService.close();
  process.exit(0);
});

// Error handling
process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason }, 'Unhandled rejection at promise', promise);
});

process.on('uncaughtException', (error) => {
  logger.fatal({ error }, 'Uncaught exception');
  process.exit(1);
});

logger.info({ config: { ...config, aws: { ...config.aws, secretAccessKey: '[REDACTED]' } } }, 'Transcoding worker started');

module.exports = worker;