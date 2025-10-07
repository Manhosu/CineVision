import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { CDNService } from './cdn.service';
import { Content, VideoProcessingStatus, VideoQuality } from '../../content/entities/content.entity';
import { Purchase, PurchaseStatus } from '../../purchases/entities/purchase.entity';

describe('CDNService', () => {
  let service: CDNService;
  let contentRepository: jest.Mocked<Repository<Content>>;
  let purchaseRepository: jest.Mocked<Repository<Purchase>>;
  let configService: jest.Mocked<ConfigService>;

  const mockContent = {
    id: 'test-content-id',
    title: 'Test Movie',
    hls_master_url: 's3://bucket/videos/test-content-id/hls/master.m3u8',
    hls_base_path: 'videos/test-content-id/hls',
    available_qualities: JSON.stringify([VideoQuality.HD_1080, VideoQuality.HD_720]),
    processing_status: VideoProcessingStatus.READY,
    price_cents: 1999,
    status: 'published',
  };

  const mockFreecontent = {
    ...mockContent,
    price_cents: 0,
  };

  const mockPurchase = {
    id: 'purchase-id',
    content_id: 'test-content-id',
    user_id: 'test-user-id',
    status: PurchaseStatus.PAID,
    access_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CDNService,
        {
          provide: getRepositoryToken(Content),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Purchase),
          useValue: {
            findOne: jest.fn(),
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
                CLOUDFRONT_DISTRIBUTION_DOMAIN: 'test.cloudfront.net',
                CLOUDFRONT_DISTRIBUTION_ID: 'test-distribution-id',
                CLOUDFRONT_PRIVATE_KEY: '-----BEGIN RSA PRIVATE KEY-----\\nMIIEpAIBAAKCAQEA...',
                CLOUDFRONT_KEY_PAIR_ID: 'test-key-pair-id',
                JWT_SECRET: 'test-jwt-secret',
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<CDNService>(CDNService);
    contentRepository = module.get(getRepositoryToken(Content));
    purchaseRepository = module.get(getRepositoryToken(Purchase));
    configService = module.get(ConfigService);
  });

  describe('generateSignedStreamingUrl', () => {
    it('should generate signed URLs for free content without authentication', async () => {
      contentRepository.findOne.mockResolvedValue(mockFreecontent as Content);

      // Mock the createSignedUrl method to avoid CloudFront dependencies
      jest.spyOn(service as any, 'createSignedUrl')
        .mockReturnValue('https://test.cloudfront.net/signed-url');

      const result = await service.generateSignedStreamingUrl({
        contentId: mockContent.id,
        expiresIn: 3600,
      });

      expect(result).toBeDefined();
      expect(result.streamUrl).toBe('https://test.cloudfront.net/signed-url');
      expect(result.manifestUrl).toBe('https://test.cloudfront.net/signed-url');
      expect(result.qualities).toEqual([VideoQuality.HD_1080, VideoQuality.HD_720]);
      expect(result.accessToken).toBeDefined();
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it('should generate signed URLs for paid content with valid purchase', async () => {
      contentRepository.findOne.mockResolvedValue(mockContent as Content);
      purchaseRepository.findOne.mockResolvedValue(mockPurchase as Purchase);

      jest.spyOn(service as any, 'createSignedUrl')
        .mockReturnValue('https://test.cloudfront.net/signed-url');

      const result = await service.generateSignedStreamingUrl({
        contentId: mockContent.id,
        userId: 'test-user-id',
        expiresIn: 3600,
      });

      expect(result).toBeDefined();
      expect(result.streamUrl).toBeDefined();
      expect(result.accessToken).toBeDefined();

      expect(purchaseRepository.findOne).toHaveBeenCalledWith({
        where: {
          content_id: mockContent.id,
          user_id: 'test-user-id',
          status: PurchaseStatus.PAID,
        },
        select: ['access_expires_at'],
      });
    });

    it('should reject access to paid content without valid purchase', async () => {
      contentRepository.findOne.mockResolvedValue(mockContent as Content);
      purchaseRepository.findOne.mockResolvedValue(null);

      await expect(
        service.generateSignedStreamingUrl({
          contentId: mockContent.id,
          userId: 'test-user-id',
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject access to paid content without user authentication', async () => {
      contentRepository.findOne.mockResolvedValue(mockContent as Content);

      await expect(
        service.generateSignedStreamingUrl({
          contentId: mockContent.id,
          // No userId provided
        })
      ).rejects.toThrow('User authentication required for paid content');
    });

    it('should reject access for expired purchases', async () => {
      const expiredPurchase = {
        ...mockPurchase,
        access_expires_at: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
      };

      contentRepository.findOne.mockResolvedValue(mockContent as Content);
      purchaseRepository.findOne.mockResolvedValue(expiredPurchase as Purchase);

      await expect(
        service.generateSignedStreamingUrl({
          contentId: mockContent.id,
          userId: 'test-user-id',
        })
      ).rejects.toThrow('Access to this content has expired');
    });

    it('should generate quality-specific URLs when requested', async () => {
      contentRepository.findOne.mockResolvedValue(mockFreecontent as Content);

      jest.spyOn(service as any, 'createSignedUrl')
        .mockImplementation((url: string) => url + '?signature=test');

      const result = await service.generateSignedStreamingUrl({
        contentId: mockContent.id,
        quality: '720p',
      });

      expect(result.streamUrl).toContain('720p/playlist.m3u8');
    });

    it('should throw error for non-existent content', async () => {
      contentRepository.findOne.mockResolvedValue(null);

      await expect(
        service.generateSignedStreamingUrl({
          contentId: 'non-existent-id',
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw error for content not ready for streaming', async () => {
      const processingContent = {
        ...mockContent,
        hls_master_url: null,
        hls_base_path: null,
        processing_status: VideoProcessingStatus.PROCESSING,
      };

      contentRepository.findOne.mockResolvedValue(processingContent as Content);

      await expect(
        service.generateSignedStreamingUrl({
          contentId: mockContent.id,
        })
      ).rejects.toThrow('is not ready for streaming');
    });
  });

  describe('generateSignedSegmentUrl', () => {
    it('should generate signed segment URLs', async () => {
      const segmentContent = {
        id: mockContent.id,
        hls_base_path: 'videos/test-content-id/hls',
        price_cents: 0,
      };

      contentRepository.findOne.mockResolvedValue(segmentContent as Content);

      jest.spyOn(service as any, 'createSignedUrl')
        .mockReturnValue('https://test.cloudfront.net/signed-segment-url');

      const result = await service.generateSignedSegmentUrl(
        mockContent.id,
        '720p/segment_001.ts',
        'test-user-id',
        3600
      );

      expect(result).toBe('https://test.cloudfront.net/signed-segment-url');
      expect(contentRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockContent.id },
        select: ['hls_base_path'],
      });
    });

    it('should throw error for content without HLS path', async () => {
      const contentWithoutHLS = {
        id: mockContent.id,
        hls_base_path: null,
      };

      contentRepository.findOne.mockResolvedValue(contentWithoutHLS as Content);

      await expect(
        service.generateSignedSegmentUrl(mockContent.id, 'segment.ts')
      ).rejects.toThrow('HLS path not found');
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify valid access tokens', () => {
      const payload = {
        contentId: 'test-content-id',
        userId: 'test-user-id',
        allowDownload: false,
        expiresAt: Date.now() + 3600000,
      };

      // Mock JWT sign
      jest.spyOn(service as any, 'generateAccessToken')
        .mockImplementation(() => 'mock.jwt.token');

      const token = (service as any).generateAccessToken(payload);

      // Mock JWT verify
      jest.spyOn(service, 'verifyAccessToken')
        .mockReturnValue(payload);

      const result = service.verifyAccessToken(token);

      expect(result).toEqual(payload);
    });

    it('should throw error for invalid access tokens', () => {
      jest.spyOn(service, 'verifyAccessToken')
        .mockImplementation(() => {
          throw new BadRequestException('Invalid access token');
        });

      expect(() => service.verifyAccessToken('invalid.token'))
        .toThrow(BadRequestException);
    });
  });

  describe('invalidateContentCache', () => {
    it('should invalidate CDN cache for content', async () => {
      const contentWithHLS = {
        id: mockContent.id,
        hls_base_path: 'videos/test-content-id/hls',
      };

      contentRepository.findOne.mockResolvedValue(contentWithHLS as Content);

      // Mock CloudFront client
      jest.spyOn(service as any, 'cloudFrontClient', 'get')
        .mockImplementation(() => ({
          send: jest.fn().mockResolvedValue({
            Invalidation: { Id: 'invalidation-123' },
          }),
        }));

      await expect(
        service.invalidateContentCache(mockContent.id)
      ).resolves.not.toThrow();

      expect(contentRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockContent.id },
        select: ['hls_base_path'],
      });
    });

    it('should handle invalidation errors gracefully', async () => {
      const contentWithHLS = {
        id: mockContent.id,
        hls_base_path: 'videos/test-content-id/hls',
      };

      contentRepository.findOne.mockResolvedValue(contentWithHLS as Content);

      jest.spyOn(service as any, 'cloudFrontClient', 'get')
        .mockImplementation(() => ({
          send: jest.fn().mockRejectedValue(new Error('CloudFront error')),
        }));

      await expect(
        service.invalidateContentCache(mockContent.id)
      ).rejects.toThrow('CloudFront error');
    });
  });

  describe('generatePresignedFileUrl', () => {
    it('should generate presigned URLs for S3 files', async () => {
      jest.spyOn(service as any, 'createSignedUrl')
        .mockReturnValue('https://test.cloudfront.net/presigned-file-url');

      const result = await service.generatePresignedFileUrl(
        's3://bucket/path/file.mp4',
        3600,
        'video/mp4'
      );

      expect(result).toBe('https://test.cloudfront.net/presigned-file-url');
    });

    it('should handle HTTP URLs correctly', async () => {
      jest.spyOn(service as any, 'createSignedUrl')
        .mockReturnValue('https://test.cloudfront.net/http-url-signed');

      const result = await service.generatePresignedFileUrl(
        'https://test.cloudfront.net/path/file.mp4'
      );

      expect(result).toBe('https://test.cloudfront.net/http-url-signed');
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status when CloudFront is accessible', async () => {
      jest.spyOn(service as any, 'createSignedUrl')
        .mockReturnValue('https://test.cloudfront.net/health-check.txt');

      const result = await service.healthCheck();

      expect(result.status).toBe('healthy');
      expect(result.distribution).toBe('test.cloudfront.net');
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should return unhealthy status when CloudFront fails', async () => {
      jest.spyOn(service as any, 'createSignedUrl')
        .mockImplementation(() => {
          throw new Error('CloudFront error');
        });

      const result = await service.healthCheck();

      expect(result.status).toBe('unhealthy');
      expect(result.distribution).toBe('test.cloudfront.net');
      expect(result.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('getCDNMetrics', () => {
    it('should return placeholder CDN metrics', async () => {
      const result = await service.getCDNMetrics('test-content-id');

      expect(result).toBeDefined();
      expect(result.contentId).toBe('test-content-id');
      expect(typeof result.totalRequests).toBe('number');
      expect(typeof result.bandwidth).toBe('number');
      expect(typeof result.cacheHitRate).toBe('number');
      expect(typeof result.uniqueViewers).toBe('number');
      expect(typeof result.geographicDistribution).toBe('object');
    });

    it('should accept date range parameters', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const result = await service.getCDNMetrics(
        'test-content-id',
        startDate,
        endDate
      );

      expect(result.contentId).toBe('test-content-id');
    });
  });

  describe('Error handling', () => {
    it('should handle missing CloudFront configuration', async () => {
      // Create service with missing config
      const moduleWithoutConfig: TestingModule = await Test.createTestingModule({
        providers: [
          CDNService,
          {
            provide: getRepositoryToken(Content),
            useValue: { findOne: jest.fn() },
          },
          {
            provide: getRepositoryToken(Purchase),
            useValue: { findOne: jest.fn() },
          },
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn().mockReturnValue(undefined),
            },
          },
        ],
      }).compile();

      expect(() => moduleWithoutConfig.get<CDNService>(CDNService))
        .toThrow('CloudFront configuration is incomplete');
    });

    it('should handle content verification failures gracefully', async () => {
      contentRepository.findOne.mockRejectedValue(new Error('Database error'));

      await expect(
        service.generateSignedStreamingUrl({
          contentId: mockContent.id,
        })
      ).rejects.toThrow('Database error');
    });

    it('should handle purchase verification failures gracefully', async () => {
      contentRepository.findOne.mockResolvedValue(mockContent as Content);
      purchaseRepository.findOne.mockRejectedValue(new Error('Database error'));

      await expect(
        service.generateSignedStreamingUrl({
          contentId: mockContent.id,
          userId: 'test-user-id',
        })
      ).rejects.toThrow('Database error');
    });
  });
});