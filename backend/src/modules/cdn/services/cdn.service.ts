import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront';
import { getSignedUrl } from '@aws-sdk/cloudfront-signer';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import { Content } from '../../content/entities/content.entity';
import { Purchase, PurchaseStatus } from '../../purchases/entities/purchase.entity';

export interface SignedUrlOptions {
  contentId: string;
  userId?: string;
  quality?: string;
  expiresIn?: number; // seconds
  allowDownload?: boolean;
}

export interface SignedUrlResponse {
  streamUrl: string;
  manifestUrl: string;
  expiresAt: Date;
  accessToken: string;
  qualities: string[];
}

export interface CDNMetrics {
  contentId: string;
  totalRequests: number;
  bandwidth: number;
  cacheHitRate: number;
  uniqueViewers: number;
  geographicDistribution: Record<string, number>;
}

@Injectable()
export class CDNService {
  private readonly logger = new Logger(CDNService.name);
  private readonly cloudFrontClient: CloudFrontClient;
  private readonly distributionDomain: string;
  private readonly distributionId: string;
  private readonly privateKey: string;
  private readonly keyPairId: string;
  private readonly jwtSecret: string;

  constructor(
    @InjectRepository(Content)
    private contentRepository: Repository<Content>,
    @InjectRepository(Purchase)
    private purchaseRepository: Repository<Purchase>,
    private configService: ConfigService,
  ) {
    // Only initialize CloudFront in production
    const nodeEnv = this.configService.get('NODE_ENV', 'development');
    
    if (nodeEnv === 'production') {
      this.cloudFrontClient = new CloudFrontClient({
        region: this.configService.get('AWS_REGION', 'us-east-1'),
        credentials: {
          accessKeyId: this.configService.get('AWS_ACCESS_KEY_ID'),
          secretAccessKey: this.configService.get('AWS_SECRET_ACCESS_KEY'),
        },
      });

      this.distributionDomain = this.configService.get('CLOUDFRONT_DISTRIBUTION_DOMAIN');
      this.distributionId = this.configService.get('CLOUDFRONT_DISTRIBUTION_ID');
      this.privateKey = this.configService.get('CLOUDFRONT_PRIVATE_KEY');
      this.keyPairId = this.configService.get('CLOUDFRONT_KEY_PAIR_ID');

      if (!this.distributionDomain || !this.privateKey || !this.keyPairId) {
        throw new Error('CloudFront configuration is incomplete. Check environment variables.');
      }
    } else {
      // Development mode - use mock values
      this.distributionDomain = 'localhost:3001';
      this.distributionId = 'dev-distribution';
      this.privateKey = 'dev-key';
      this.keyPairId = 'dev-key-pair';
      this.logger.warn('Running in development mode - CloudFront disabled');
    }

    this.jwtSecret = this.configService.get('JWT_SECRET');
  }

  /**
   * Generate signed URLs for content streaming
   */
  async generateSignedStreamingUrl(options: SignedUrlOptions): Promise<SignedUrlResponse> {
    const { contentId, userId, quality, expiresIn = 43200, allowDownload = false } = options; // 12 hours default

    // Verify content exists and user has access
    await this.verifyContentAccess(contentId, userId);

    // Get content details
    const content = await this.contentRepository.findOne({
      where: { id: contentId },
      select: [
        'id',
        'title',
        'hls_master_url',
        'hls_base_path',
        'available_qualities',
        'processing_status',
      ],
    });

    if (!content) {
      throw new BadRequestException(`Content ${contentId} not found`);
    }

    if (!content.hls_master_url || !content.hls_base_path) {
      throw new BadRequestException(`Content ${contentId} is not ready for streaming`);
    }

    // Calculate expiration time
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    // Generate access token
    const accessToken = this.generateAccessToken({
      contentId,
      userId,
      allowDownload,
      expiresAt: expiresAt.getTime(),
    });

    // Generate signed URLs
    const baseUrl = `https://${this.distributionDomain}`;
    const hlsPath = content.hls_base_path;

    // Master playlist URL
    const manifestUrl = this.createSignedUrl(
      `${baseUrl}/${hlsPath}/master.m3u8`,
      expiresAt
    );

    // If specific quality requested, generate that playlist URL
    let streamUrl = manifestUrl;
    if (quality && content.available_qualities?.includes(quality as any)) {
      streamUrl = this.createSignedUrl(
        `${baseUrl}/${hlsPath}/${quality}/playlist.m3u8`,
        expiresAt
      );
    }

    this.logger.log(`Generated signed streaming URLs for content ${contentId}, user ${userId || 'guest'}`);

    return {
      streamUrl,
      manifestUrl,
      expiresAt,
      accessToken,
      qualities: content.available_qualities ? JSON.parse(content.available_qualities) : [],
    };
  }

  /**
   * Generate signed URL for specific HLS segment or playlist
   */
  async generateSignedSegmentUrl(
    contentId: string,
    segmentPath: string,
    userId?: string,
    expiresIn: number = 3600 // 1 hour default for segments
  ): Promise<string> {
    // Verify access
    await this.verifyContentAccess(contentId, userId);

    // Get content HLS base path
    const content = await this.contentRepository.findOne({
      where: { id: contentId },
      select: ['hls_base_path'],
    });

    if (!content?.hls_base_path) {
      throw new BadRequestException(`Content ${contentId} HLS path not found`);
    }

    const expiresAt = new Date(Date.now() + expiresIn * 1000);
    const baseUrl = `https://${this.distributionDomain}`;
    const fullPath = `${baseUrl}/${content.hls_base_path}/${segmentPath}`;

    return this.createSignedUrl(fullPath, expiresAt);
  }

  /**
   * Verify user has access to content
   */
  private async verifyContentAccess(contentId: string, userId?: string): Promise<void> {
    const content = await this.contentRepository.findOne({
      where: { id: contentId },
      select: ['id', 'price_cents', 'status'],
    });

    if (!content) {
      throw new BadRequestException(`Content ${contentId} not found`);
    }

    // If content is free, allow access
    if (content.price_cents === 0) {
      return;
    }

    // If no user provided, deny access to paid content
    if (!userId) {
      throw new BadRequestException('User authentication required for paid content');
    }

    // Check if user has valid purchase
    const purchase = await this.purchaseRepository.findOne({
      where: {
        content_id: contentId,
        user_id: userId,
        status: PurchaseStatus.PAID,
      },
      select: ['access_expires_at'],
    });

    if (!purchase) {
      throw new BadRequestException('User does not have access to this content');
    }

    // Check if access has expired
    if (purchase.access_expires_at && purchase.access_expires_at < new Date()) {
      throw new BadRequestException('Access to this content has expired');
    }
  }

  /**
   * Create CloudFront signed URL
   */
  private createSignedUrl(url: string, expiresAt: Date): string {
    try {
      return getSignedUrl({
        url,
        keyPairId: this.keyPairId,
        privateKey: this.privateKey,
        dateLessThan: expiresAt.toISOString(),
      });
    } catch (error) {
      this.logger.error(`Failed to create signed URL: ${error.message}`);
      throw new Error('Failed to generate signed URL');
    }
  }

  /**
   * Generate access token for additional verification
   */
  private generateAccessToken(payload: {
    contentId: string;
    userId?: string;
    allowDownload: boolean;
    expiresAt: number;
  }): string {
    return jwt.sign(payload, this.jwtSecret, {
      issuer: 'cine-vision',
      audience: 'streaming-client',
    });
  }

  /**
   * Verify access token
   */
  verifyAccessToken(token: string): any {
    try {
      return jwt.verify(token, this.jwtSecret, {
        issuer: 'cine-vision',
        audience: 'streaming-client',
      });
    } catch (error) {
      throw new BadRequestException('Invalid access token');
    }
  }

  /**
   * Invalidate CDN cache for content
   */
  async invalidateContentCache(contentId: string, paths?: string[]): Promise<void> {
    if (!this.distributionId) {
      this.logger.warn('CloudFront distribution ID not configured, skipping cache invalidation');
      return;
    }

    try {
      const content = await this.contentRepository.findOne({
        where: { id: contentId },
        select: ['hls_base_path'],
      });

      if (!content?.hls_base_path) {
        throw new BadRequestException(`Content ${contentId} HLS path not found`);
      }

      // Default paths to invalidate
      const invalidationPaths = paths || [
        `/${content.hls_base_path}/master.m3u8`,
        `/${content.hls_base_path}/*`, // All HLS files
      ];

      const command = new CreateInvalidationCommand({
        DistributionId: this.distributionId,
        InvalidationBatch: {
          Paths: {
            Quantity: invalidationPaths.length,
            Items: invalidationPaths,
          },
          CallerReference: `invalidation-${contentId}-${Date.now()}`,
        },
      });

      const result = await this.cloudFrontClient.send(command);

      this.logger.log(`CDN cache invalidation created for content ${contentId}: ${result.Invalidation?.Id}`);
    } catch (error) {
      this.logger.error(`Failed to invalidate CDN cache for content ${contentId}:`, error);
      throw error;
    }
  }

  /**
   * Generate presigned URL for direct file access (admin/debugging)
   */
  async generatePresignedFileUrl(
    s3Path: string,
    expiresIn: number = 3600,
    contentType?: string
  ): Promise<string> {
    // This is for direct S3 access, not CDN
    // Useful for admin interfaces or debugging
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    // Convert S3 path to HTTP URL if needed
    const httpUrl = s3Path.startsWith('s3://')
      ? s3Path.replace(`s3://${this.configService.get('S3_VIDEO_BUCKET')}/`, `https://${this.distributionDomain}/`)
      : s3Path;

    return this.createSignedUrl(httpUrl, expiresAt);
  }

  /**
   * Get CDN analytics and metrics (placeholder)
   */
  async getCDNMetrics(contentId: string, startDate?: Date, endDate?: Date): Promise<CDNMetrics> {
    // This would integrate with CloudFront analytics API
    // For now, return placeholder data

    this.logger.log(`Fetching CDN metrics for content ${contentId}`);

    return {
      contentId,
      totalRequests: 0,
      bandwidth: 0,
      cacheHitRate: 0,
      uniqueViewers: 0,
      geographicDistribution: {},
    };
  }

  /**
   * Configure custom caching rules for content type
   */
  async configureCacheRules(contentType: 'manifest' | 'segment', maxAge: number): Promise<void> {
    // This would configure CloudFront behaviors
    // Manifests (.m3u8): short cache time (e.g., 30 seconds)
    // Segments (.ts): long cache time (e.g., 1 year)

    this.logger.log(`Configuring cache rules for ${contentType}: max-age=${maxAge}`);

    // Implementation would use CloudFront API to update cache behaviors
    // For now, just log the configuration
  }

  /**
   * Health check for CDN service
   */
  async healthCheck(): Promise<{ status: string; distribution: string; timestamp: Date }> {
    try {
      // Test by creating a signed URL for a test path
      const testUrl = `https://${this.distributionDomain}/health-check.txt`;
      const expiresAt = new Date(Date.now() + 300 * 1000); // 5 minutes

      this.createSignedUrl(testUrl, expiresAt);

      return {
        status: 'healthy',
        distribution: this.distributionDomain,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`CDN health check failed: ${error.message}`);
      return {
        status: 'unhealthy',
        distribution: this.distributionDomain,
        timestamp: new Date(),
      };
    }
  }
}