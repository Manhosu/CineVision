import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { VideoIngestService } from './video-ingest.service';
import { Content, VideoProcessingStatus } from '../../content/entities/content.entity';
import { VideoVariant } from '../../content/entities/video-variant.entity';

describe('VideoIngestService', () => {
  let service: VideoIngestService;
  let contentRepository: jest.Mocked<Repository<Content>>;
  let videoVariantRepository: jest.Mocked<Repository<VideoVariant>>;
  let configService: jest.Mocked<ConfigService>;

  const mockContent = {
    id: 'test-content-id',
    title: 'Test Movie',
    processing_status: VideoProcessingStatus.PENDING,
  };

  const mockVideoFile = {
    originalname: 'test-video.mp4',
    mimetype: 'video/mp4',
    size: 1024 * 1024 * 100, // 100MB
    buffer: Buffer.from('mock video data'),
  } as Express.Multer.File;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VideoIngestService,
        {
          provide: getRepositoryToken(Content),
          useValue: {
            findOne: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(VideoVariant),
          useValue: {
            find: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config = {
                AWS_REGION: 'us-east-1',
                AWS_ACCESS_KEY_ID: 'test-access-key',
                AWS_SECRET_ACCESS_KEY: 'test-secret-key',
                S3_VIDEO_BUCKET: 'test-video-bucket',
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<VideoIngestService>(VideoIngestService);
    contentRepository = module.get(getRepositoryToken(Content));
    videoVariantRepository = module.get(getRepositoryToken(VideoVariant));
    configService = module.get(ConfigService);
  });

  describe('generatePresignedUploadUrl', () => {
    it('should generate presigned URL for valid content', async () => {
      contentRepository.findOne.mockResolvedValue(mockContent as Content);

      const result = await service.generatePresignedUploadUrl(
        mockContent.id,
        'test-video.mp4',
        'video/mp4',
        3600
      );

      expect(result).toBeDefined();
      expect(result.uploadUrl).toBeDefined();
      expect(result.key).toContain(mockContent.id);
      expect(result.key).toContain('original');
      expect(result.expiresIn).toBe(3600);
      expect(contentRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockContent.id },
      });
    });

    it('should throw error for non-existent content', async () => {
      contentRepository.findOne.mockResolvedValue(null);

      await expect(
        service.generatePresignedUploadUrl('non-existent-id', 'test.mp4')
      ).rejects.toThrow(BadRequestException);
    });

    it('should generate unique keys for multiple uploads', async () => {
      contentRepository.findOne.mockResolvedValue(mockContent as Content);

      const result1 = await service.generatePresignedUploadUrl(
        mockContent.id,
        'test1.mp4'
      );
      const result2 = await service.generatePresignedUploadUrl(
        mockContent.id,
        'test2.mp4'
      );

      expect(result1.key).not.toBe(result2.key);
      expect(result1.key).toContain(mockContent.id);
      expect(result2.key).toContain(mockContent.id);
    });
  });

  describe('uploadVideoFile', () => {
    it('should upload valid video file', async () => {
      contentRepository.findOne.mockResolvedValue(mockContent as Content);
      contentRepository.update.mockResolvedValue(undefined);

      // Mock S3 upload success
      jest.spyOn(service as any, 'queueTranscodingJob')
        .mockResolvedValue('job-id-123');

      const result = await service.uploadVideoFile({
        contentId: mockContent.id,
        file: mockVideoFile,
        userId: 'test-user',
      });

      expect(result).toBeDefined();
      expect(result.contentId).toBe(mockContent.id);
      expect(result.fileSize).toBe(mockVideoFile.size);
      expect(result.processingJobId).toBe('job-id-123');
      expect(result.originalPath).toContain('s3://');

      expect(contentRepository.update).toHaveBeenCalledWith(
        mockContent.id,
        expect.objectContaining({
          processing_status: VideoProcessingStatus.UPLOADING,
          file_size_bytes: mockVideoFile.size,
        })
      );
    });

    it('should reject invalid video file formats', async () => {
      contentRepository.findOne.mockResolvedValue(mockContent as Content);

      const invalidFile = {
        ...mockVideoFile,
        originalname: 'document.pdf',
        mimetype: 'application/pdf',
      };

      await expect(
        service.uploadVideoFile({
          contentId: mockContent.id,
          file: invalidFile,
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle upload errors gracefully', async () => {
      contentRepository.findOne.mockResolvedValue(mockContent as Content);
      contentRepository.update.mockResolvedValue(undefined);

      // Mock S3 upload failure
      jest.spyOn(service as any, 's3Client', 'get')
        .mockImplementation(() => ({
          send: jest.fn().mockRejectedValue(new Error('S3 upload failed')),
        }));

      await expect(
        service.uploadVideoFile({
          contentId: mockContent.id,
          file: mockVideoFile,
        })
      ).rejects.toThrow('S3 upload failed');

      // Verify error status was set
      expect(contentRepository.update).toHaveBeenCalledWith(
        mockContent.id,
        expect.objectContaining({
          processing_status: VideoProcessingStatus.FAILED,
        })
      );
    });
  });

  describe('confirmUploadCompletion', () => {
    it('should confirm successful upload', async () => {
      contentRepository.update.mockResolvedValue(undefined);

      // Mock S3 head object success
      jest.spyOn(service as any, 's3Client', 'get')
        .mockImplementation(() => ({
          send: jest.fn().mockResolvedValue({
            ContentLength: 1024000,
          }),
        }));

      jest.spyOn(service as any, 'queueTranscodingJob')
        .mockResolvedValue('job-id-456');

      const result = await service.confirmUploadCompletion(
        mockContent.id,
        'test-s3-key'
      );

      expect(result).toBeDefined();
      expect(result.contentId).toBe(mockContent.id);
      expect(result.fileSize).toBe(1024000);
      expect(result.processingJobId).toBe('job-id-456');

      expect(contentRepository.update).toHaveBeenCalledWith(
        mockContent.id,
        expect.objectContaining({
          processing_status: VideoProcessingStatus.UPLOADING,
          file_size_bytes: 1024000,
        })
      );
    });

    it('should handle non-existent S3 files', async () => {
      contentRepository.update.mockResolvedValue(undefined);

      // Mock S3 head object failure (file not found)
      jest.spyOn(service as any, 's3Client', 'get')
        .mockImplementation(() => ({
          send: jest.fn().mockRejectedValue(new Error('File not found')),
        }));

      await expect(
        service.confirmUploadCompletion(mockContent.id, 'non-existent-key')
      ).rejects.toThrow('File not found');

      expect(contentRepository.update).toHaveBeenCalledWith(
        mockContent.id,
        expect.objectContaining({
          processing_status: VideoProcessingStatus.FAILED,
        })
      );
    });
  });

  describe('getUploadStatus', () => {
    it('should return upload status for content', async () => {
      const mockContentWithStatus = {
        ...mockContent,
        processing_status: VideoProcessingStatus.PROCESSING,
        processing_progress: 75,
        file_size_bytes: 1024000,
        original_file_path: 's3://bucket/video.mp4',
      };

      const mockVariants = [
        {
          id: 'variant-1',
          quality: '1080p',
          status: VideoProcessingStatus.READY,
          processing_progress: 100,
          bitrate_kbps: 5000,
          width: 1920,
          height: 1080,
        },
        {
          id: 'variant-2',
          quality: '720p',
          status: VideoProcessingStatus.PROCESSING,
          processing_progress: 45,
          bitrate_kbps: 3000,
          width: 1280,
          height: 720,
        },
      ];

      contentRepository.findOne.mockResolvedValue(mockContentWithStatus as Content);
      videoVariantRepository.find.mockResolvedValue(mockVariants as VideoVariant[]);

      const result = await service.getUploadStatus(mockContent.id);

      expect(result).toBeDefined();
      expect(result.content.id).toBe(mockContent.id);
      expect(result.content.processingStatus).toBe(VideoProcessingStatus.PROCESSING);
      expect(result.content.processingProgress).toBe(75);
      expect(result.variants).toHaveLength(2);
      expect(result.variants[0].quality).toBe('1080p');
      expect(result.variants[0].resolution).toBe('1920x1080');
    });

    it('should throw error for non-existent content', async () => {
      contentRepository.findOne.mockResolvedValue(null);

      await expect(
        service.getUploadStatus('non-existent-id')
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('cleanupFailedUpload', () => {
    it('should cleanup failed upload', async () => {
      contentRepository.update.mockResolvedValue(undefined);

      await service.cleanupFailedUpload(mockContent.id, 'test-s3-key');

      expect(contentRepository.update).toHaveBeenCalledWith(
        mockContent.id,
        expect.objectContaining({
          original_file_path: null,
          file_size_bytes: null,
          processing_status: VideoProcessingStatus.PENDING,
          processing_progress: null,
          processing_started_at: null,
          processing_error: null,
        })
      );
    });

    it('should handle cleanup errors gracefully', async () => {
      contentRepository.update.mockRejectedValue(new Error('Database error'));

      await expect(
        service.cleanupFailedUpload(mockContent.id)
      ).rejects.toThrow('Database error');
    });
  });

  describe('isValidVideoFile', () => {
    it('should accept valid video file formats', () => {
      const validFiles = [
        { originalname: 'test.mp4', mimetype: 'video/mp4' },
        { originalname: 'test.avi', mimetype: 'video/avi' },
        { originalname: 'test.mov', mimetype: 'video/mov' },
        { originalname: 'test.mkv', mimetype: 'video/mkv' },
        { originalname: 'test.webm', mimetype: 'video/webm' },
      ];

      validFiles.forEach(file => {
        const result = (service as any).isValidVideoFile(file);
        expect(result).toBe(true);
      });
    });

    it('should reject invalid file formats', () => {
      const invalidFiles = [
        { originalname: 'document.pdf', mimetype: 'application/pdf' },
        { originalname: 'image.jpg', mimetype: 'image/jpeg' },
        { originalname: 'audio.mp3', mimetype: 'audio/mpeg' },
        { originalname: 'video.txt', mimetype: 'text/plain' },
      ];

      invalidFiles.forEach(file => {
        const result = (service as any).isValidVideoFile(file);
        expect(result).toBe(false);
      });
    });

    it('should handle files with mixed case extensions', () => {
      const files = [
        { originalname: 'test.MP4', mimetype: 'video/mp4' },
        { originalname: 'test.AVI', mimetype: 'video/avi' },
      ];

      files.forEach(file => {
        const result = (service as any).isValidVideoFile(file);
        expect(result).toBe(true);
      });
    });
  });
});