import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Content, VideoProcessingStatus, VideoQuality, ContentType, ContentStatus } from '../content/entities/content.entity';
import { VideoVariant } from '../content/entities/video-variant.entity';
import { VideoIngestService } from './services/video-ingest.service';
import { VideoTranscodingService } from './services/video-transcoding.service';
import { CDNService } from '../cdn/services/cdn.service';
import { QueueService } from '../queue/services/queue.service';
import { AppModule } from '../../app.module';

describe('Video Pipeline E2E', () => {
  let app: INestApplication;
  let contentRepository: Repository<Content>;
  let videoVariantRepository: Repository<VideoVariant>;
  let videoIngestService: VideoIngestService;
  let videoTranscodingService: VideoTranscodingService;
  let cdnService: CDNService;
  let queueService: QueueService;

  const mockContent = {
    id: 'test-content-id',
    title: 'Test Movie',
    type: ContentType.MOVIE,
    status: ContentStatus.PUBLISHED,
    price_cents: 1999,
    processing_status: VideoProcessingStatus.PENDING,
  };

  const mockVideoFile = {
    originalname: 'test-video.mp4',
    mimetype: 'video/mp4',
    size: 1024 * 1024 * 100, // 100MB
    buffer: Buffer.from('mock video data'),
  } as Express.Multer.File;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ConfigService)
      .useValue({
        get: jest.fn((key: string) => {
          const config = {
            AWS_REGION: 'us-east-1',
            AWS_ACCESS_KEY_ID: 'test-key',
            AWS_SECRET_ACCESS_KEY: 'test-secret',
            S3_VIDEO_BUCKET: 'test-video-bucket',
            CLOUDFRONT_DISTRIBUTION_DOMAIN: 'test.cloudfront.net',
            CLOUDFRONT_PRIVATE_KEY: 'test-private-key',
            CLOUDFRONT_KEY_PAIR_ID: 'test-key-pair-id',
            JWT_SECRET: 'test-jwt-secret',
            REDIS_HOST: 'localhost',
            REDIS_PORT: 6379,
          };
          return config[key];
        }),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    contentRepository = moduleFixture.get<Repository<Content>>(getRepositoryToken(Content));
    videoVariantRepository = moduleFixture.get<Repository<VideoVariant>>(getRepositoryToken(VideoVariant));
    videoIngestService = moduleFixture.get<VideoIngestService>(VideoIngestService);
    videoTranscodingService = moduleFixture.get<VideoTranscodingService>(VideoTranscodingService);
    cdnService = moduleFixture.get<CDNService>(CDNService);
    queueService = moduleFixture.get<QueueService>(QueueService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean up database
    await videoVariantRepository.delete({});
    await contentRepository.delete({});
  });

  describe('Video Upload Pipeline', () => {
    it('should complete full video upload and transcoding pipeline', async () => {
      // Step 1: Create content record
      const content = contentRepository.create(mockContent);
      await contentRepository.save(content);

      // Step 2: Generate presigned upload URL
      const presignedUrl = await videoIngestService.generatePresignedUploadUrl(
        content.id,
        mockVideoFile.originalname,
        mockVideoFile.mimetype
      );

      expect(presignedUrl).toBeDefined();
      expect(presignedUrl.uploadUrl).toContain('test-video-bucket');
      expect(presignedUrl.key).toContain(content.id);

      // Step 3: Simulate file upload completion
      const uploadResult = await videoIngestService.confirmUploadCompletion(
        content.id,
        presignedUrl.key
      );

      expect(uploadResult).toBeDefined();
      expect(uploadResult.contentId).toBe(content.id);
      expect(uploadResult.processingJobId).toBeDefined();

      // Verify content was updated
      const updatedContent = await contentRepository.findOne({ where: { id: content.id } });
      expect(updatedContent.processing_status).toBe(VideoProcessingStatus.UPLOADING);
      expect(updatedContent.original_file_path).toBeDefined();

      // Step 4: Verify transcoding job was queued
      const job = await queueService.getJob(uploadResult.processingJobId);
      expect(job).toBeDefined();
      expect(job.data.contentId).toBe(content.id);
    });

    it('should handle upload failure gracefully', async () => {
      const content = contentRepository.create(mockContent);
      await contentRepository.save(content);

      // Simulate upload failure
      await expect(
        videoIngestService.confirmUploadCompletion(content.id, 'non-existent-key')
      ).rejects.toThrow();

      // Verify content status was updated to failed
      const updatedContent = await contentRepository.findOne({ where: { id: content.id } });
      expect(updatedContent.processing_status).toBe(VideoProcessingStatus.FAILED);
    });
  });

  describe('Transcoding Service', () => {
    it('should create video variants for all supported qualities', async () => {
      const content = contentRepository.create({
        ...mockContent,
        processing_status: VideoProcessingStatus.PROCESSING,
        original_file_path: 's3://test-bucket/test-video.mp4',
      });
      await contentRepository.save(content);

      // Mock transcoding job (normally done by worker)
      const qualities = [VideoQuality.HD_1080, VideoQuality.HD_720, VideoQuality.SD_480];

      // Create video variants as transcoding service would
      const variants = qualities.map(quality =>
        videoVariantRepository.create({
          content_id: content.id,
          quality,
          status: VideoProcessingStatus.READY,
          bitrate_kbps: quality === VideoQuality.HD_1080 ? 5000 :
                       quality === VideoQuality.HD_720 ? 3000 : 1500,
          width: quality === VideoQuality.HD_1080 ? 1920 :
                 quality === VideoQuality.HD_720 ? 1280 : 854,
          height: quality === VideoQuality.HD_1080 ? 1080 :
                  quality === VideoQuality.HD_720 ? 720 : 480,
          playlist_url: `${quality}/playlist.m3u8`,
          processing_completed_at: new Date(),
        })
      );

      await videoVariantRepository.save(variants);

      // Update content as ready
      await contentRepository.update(content.id, {
        processing_status: VideoProcessingStatus.READY,
        processing_completed_at: new Date(),
        hls_master_url: `s3://test-bucket/videos/${content.id}/hls/master.m3u8`,
        hls_base_path: `videos/${content.id}/hls`,
        available_qualities: JSON.stringify(qualities),
      });

      // Verify variants were created
      const createdVariants = await videoVariantRepository.find({
        where: { content_id: content.id }
      });

      expect(createdVariants).toHaveLength(3);
      expect(createdVariants.every(v => v.status === VideoProcessingStatus.READY)).toBe(true);

      // Verify content was updated
      const updatedContent = await contentRepository.findOne({ where: { id: content.id } });
      expect(updatedContent.processing_status).toBe(VideoProcessingStatus.READY);
      expect(updatedContent.hls_master_url).toBeDefined();
      expect(updatedContent.available_qualities).toEqual(qualities);
    });

    it('should track transcoding progress correctly', async () => {
      const content = contentRepository.create({
        ...mockContent,
        processing_status: VideoProcessingStatus.PROCESSING,
      });
      await contentRepository.save(content);

      const progress = await videoTranscodingService.getTranscodingProgress(content.id);

      expect(progress).toBeDefined();
      expect(progress.contentId).toBe(content.id);
      expect(progress.stage).toBe('transcoding');
      expect(typeof progress.progress).toBe('number');
    });
  });

  describe('CDN Service', () => {
    it('should generate signed streaming URLs for ready content', async () => {
      // Setup ready content
      const content = contentRepository.create({
        ...mockContent,
        processing_status: VideoProcessingStatus.READY,
        hls_master_url: `s3://test-bucket/videos/${mockContent.id}/hls/master.m3u8`,
        hls_base_path: `videos/${mockContent.id}/hls`,
        available_qualities: JSON.stringify([VideoQuality.HD_1080, VideoQuality.HD_720]),
        price_cents: 0, // Free content for test
      });
      await contentRepository.save(content);

      const signedUrls = await cdnService.generateSignedStreamingUrl({
        contentId: content.id,
        expiresIn: 3600,
      });

      expect(signedUrls).toBeDefined();
      expect(signedUrls.streamUrl).toContain('test.cloudfront.net');
      expect(signedUrls.manifestUrl).toContain('master.m3u8');
      expect(signedUrls.qualities).toEqual([VideoQuality.HD_1080, VideoQuality.HD_720]);
      expect(signedUrls.accessToken).toBeDefined();
      expect(signedUrls.expiresAt).toBeInstanceOf(Date);
    });

    it('should reject access to paid content without authentication', async () => {
      const content = contentRepository.create({
        ...mockContent,
        processing_status: VideoProcessingStatus.READY,
        hls_master_url: `s3://test-bucket/videos/${mockContent.id}/hls/master.m3u8`,
        hls_base_path: `videos/${mockContent.id}/hls`,
        price_cents: 1999, // Paid content
      });
      await contentRepository.save(content);

      await expect(
        cdnService.generateSignedStreamingUrl({
          contentId: content.id,
          // No userId provided
        })
      ).rejects.toThrow('User authentication required for paid content');
    });

    it('should generate signed segment URLs', async () => {
      const content = contentRepository.create({
        ...mockContent,
        processing_status: VideoProcessingStatus.READY,
        hls_base_path: `videos/${mockContent.id}/hls`,
        price_cents: 0,
      });
      await contentRepository.save(content);

      const segmentUrl = await cdnService.generateSignedSegmentUrl(
        content.id,
        '720p/segment_001.ts'
      );

      expect(segmentUrl).toContain('test.cloudfront.net');
      expect(segmentUrl).toContain('720p/segment_001.ts');
    });
  });

  describe('Queue Management', () => {
    it('should queue transcoding jobs correctly', async () => {
      const jobData = {
        contentId: 'test-content',
        type: 'content' as const,
        sourceKey: 's3://test-bucket/input.mp4',
        outputBasePath: 's3://test-bucket/output/test-content',
        qualities: ['1080p', '720p'],
      };

      const job = await queueService.addTranscodingJob(jobData);

      expect(job).toBeDefined();
      expect(job.id).toBeDefined();
      expect(job.data.contentId).toBe(jobData.contentId);

      // Verify job can be retrieved
      const retrievedJob = await queueService.getJob(job.id);
      expect(retrievedJob).toBeDefined();
      expect(retrievedJob.data.contentId).toBe(jobData.contentId);
    });

    it('should track job progress', async () => {
      const jobData = {
        contentId: 'test-content',
        type: 'content' as const,
        sourceKey: 's3://test-bucket/input.mp4',
        outputBasePath: 's3://test-bucket/output/test-content',
      };

      const job = await queueService.addTranscodingJob(jobData);
      const progress = await queueService.getJobProgress(job.id);

      expect(progress).toBeDefined();
      expect(progress.jobId).toBe(job.id);
      expect(progress.contentId).toBe(jobData.contentId);
    });

    it('should provide queue statistics', async () => {
      // Add some test jobs
      await queueService.addTranscodingJob({
        contentId: 'test-1',
        type: 'content' as const,
        sourceKey: 's3://test-bucket/test1.mp4',
        outputBasePath: 's3://test-bucket/output/test1',
      });

      await queueService.addTranscodingJob({
        contentId: 'test-2',
        type: 'content' as const,
        sourceKey: 's3://test-bucket/test2.mp4',
        outputBasePath: 's3://test-bucket/output/test2',
      });

      const stats = await queueService.getQueueStats();

      expect(stats).toBeDefined();
      expect(typeof stats.waiting).toBe('number');
      expect(typeof stats.active).toBe('number');
      expect(typeof stats.completed).toBe('number');
      expect(typeof stats.failed).toBe('number');
    });
  });

  describe('Content Controller Streaming Endpoints', () => {
    it('should return streaming URLs for ready content', async () => {
      const content = contentRepository.create({
        ...mockContent,
        processing_status: VideoProcessingStatus.READY,
        hls_master_url: `s3://test-bucket/videos/${mockContent.id}/hls/master.m3u8`,
        hls_base_path: `videos/${mockContent.id}/hls`,
        available_qualities: JSON.stringify([VideoQuality.HD_720, VideoQuality.SD_480]),
        price_cents: 0,
      });
      await contentRepository.save(content);

      const response = await request(app.getHttpServer())
        .get(`/content/${content.id}/stream`)
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.streamUrl).toBeDefined();
      expect(response.body.manifestUrl).toBeDefined();
      expect(response.body.qualities).toEqual([VideoQuality.HD_720, VideoQuality.SD_480]);
      expect(response.body.accessToken).toBeDefined();
    });

    it('should return processing status', async () => {
      const content = contentRepository.create({
        ...mockContent,
        processing_status: VideoProcessingStatus.PROCESSING,
        processing_progress: 45,
      });
      await contentRepository.save(content);

      const response = await request(app.getHttpServer())
        .get(`/content/${content.id}/processing-status`)
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.content.processingStatus).toBe('processing');
      expect(response.body.content.processingProgress).toBe(45);
    });

    it('should handle non-existent content', async () => {
      await request(app.getHttpServer())
        .get('/content/non-existent-id/stream')
        .expect(400);
    });
  });

  describe('Error Handling', () => {
    it('should handle S3 connection errors gracefully', async () => {
      // Mock S3 service to throw error
      jest.spyOn(videoIngestService, 'generatePresignedUploadUrl')
        .mockRejectedValue(new Error('S3 connection failed'));

      await expect(
        videoIngestService.generatePresignedUploadUrl('test-id', 'test.mp4')
      ).rejects.toThrow('S3 connection failed');
    });

    it('should handle queue connection errors', async () => {
      // Mock queue service to throw error
      jest.spyOn(queueService, 'addTranscodingJob')
        .mockRejectedValue(new Error('Redis connection failed'));

      await expect(
        queueService.addTranscodingJob({
          contentId: 'test',
          type: 'content' as const,
          sourceKey: 's3://bucket/file.mp4',
          outputBasePath: 's3://bucket/output/test',
        })
      ).rejects.toThrow('Redis connection failed');
    });
  });

  describe('Health Checks', () => {
    it('should report CDN service health', async () => {
      const health = await cdnService.healthCheck();

      expect(health).toBeDefined();
      expect(health.status).toBeDefined();
      expect(health.distribution).toBe('test.cloudfront.net');
      expect(health.timestamp).toBeInstanceOf(Date);
    });

    it('should report queue service health', async () => {
      const health = await queueService.getHealthStatus();

      expect(health).toBeDefined();
      expect(health.status).toBeDefined();
      expect(typeof health.redisConnected).toBe('boolean');
      expect(typeof health.queueActive).toBe('boolean');
      expect(health.timestamp).toBeInstanceOf(Date);
    });
  });
});