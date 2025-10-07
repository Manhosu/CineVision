import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import { Content, VideoProcessingStatus } from '../../content/entities/content.entity';
import { VideoVariant } from '../../content/entities/video-variant.entity';

export interface VideoUploadOptions {
  contentId: string;
  file: Express.Multer.File;
  userId?: string;
}

export interface VideoUploadResult {
  contentId: string;
  originalPath: string;
  fileSize: number;
  uploadUrl?: string;
  processingJobId?: string;
}

export interface PresignedUploadUrl {
  uploadUrl: string;
  key: string;
  expiresIn: number;
}

@Injectable()
export class VideoIngestService {
  private readonly logger = new Logger(VideoIngestService.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;

  constructor(
    @InjectRepository(Content)
    private contentRepository: Repository<Content>,
    @InjectRepository(VideoVariant)
    private videoVariantRepository: Repository<VideoVariant>,
    private configService: ConfigService,
  ) {
    // Initialize S3 client
    this.s3Client = new S3Client({
      region: this.configService.get('AWS_REGION', 'us-east-1'),
      credentials: {
        accessKeyId: this.configService.get('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.get('AWS_SECRET_ACCESS_KEY'),
      },
    });

    this.bucketName = this.configService.get('S3_VIDEO_BUCKET');
    if (!this.bucketName) {
      throw new Error('S3_VIDEO_BUCKET environment variable is required');
    }
  }

  /**
   * Generate presigned URL for direct upload to S3
   */
  async generatePresignedUploadUrl(
    contentId: string,
    filename: string,
    contentType: string = 'video/mp4', // Supports 'video/mp4' or 'video/x-matroska'
    expiresIn: number = 3600, // 1 hour
  ): Promise<PresignedUploadUrl> {
    // Validate content exists
    const content = await this.contentRepository.findOne({
      where: { id: contentId },
    });

    if (!content) {
      throw new BadRequestException(`Content with ID ${contentId} not found`);
    }

    // Generate unique key for the file
    const fileExtension = path.extname(filename);
    const timestamp = Date.now();
    const randomId = crypto.randomBytes(8).toString('hex');
    const key = `videos/${contentId}/original/${timestamp}-${randomId}${fileExtension}`;

    // Create presigned URL
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: contentType,
      Metadata: {
        contentId,
        originalFilename: filename,
        uploadedAt: new Date().toISOString(),
      },
    });

    const uploadUrl = await getSignedUrl(this.s3Client, command, { expiresIn });

    this.logger.log(`Generated presigned upload URL for content ${contentId}: ${key}`);

    return {
      uploadUrl,
      key,
      expiresIn,
    };
  }

  /**
   * Process uploaded video file (direct upload)
   */
  async uploadVideoFile(options: VideoUploadOptions): Promise<VideoUploadResult> {
    const { contentId, file, userId } = options;

    // Validate content exists
    const content = await this.contentRepository.findOne({
      where: { id: contentId },
    });

    if (!content) {
      throw new BadRequestException(`Content with ID ${contentId} not found`);
    }

    // Validate file type
    if (!this.isValidVideoFile(file)) {
      throw new BadRequestException('Invalid video file format');
    }

    try {
      // Generate S3 key
      const fileExtension = path.extname(file.originalname);
      const timestamp = Date.now();
      const randomId = crypto.randomBytes(8).toString('hex');
      const key = `videos/${contentId}/original/${timestamp}-${randomId}${fileExtension}`;

      // Upload to S3
      const uploadCommand = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        Metadata: {
          contentId,
          originalFilename: file.originalname,
          uploadedBy: userId || 'system',
          uploadedAt: new Date().toISOString(),
        },
      });

      await this.s3Client.send(uploadCommand);

      // Update content with original file path
      const s3Path = `s3://${this.bucketName}/${key}`;
      await this.contentRepository.update(contentId, {
        original_file_path: s3Path,
        file_size_bytes: file.size,
        processing_status: VideoProcessingStatus.UPLOADING,
        processing_started_at: new Date(),
      });

      this.logger.log(`Video uploaded successfully for content ${contentId}: ${s3Path}`);

      // TODO: Push to transcoding queue
      const processingJobId = await this.queueTranscodingJob(contentId, s3Path);

      return {
        contentId,
        originalPath: s3Path,
        fileSize: file.size,
        processingJobId,
      };
    } catch (error) {
      this.logger.error(`Failed to upload video for content ${contentId}:`, error);

      // Update content with error status
      await this.contentRepository.update(contentId, {
        processing_status: VideoProcessingStatus.FAILED,
        processing_error: error.message,
      });

      throw error;
    }
  }

  /**
   * Confirm upload completion after presigned URL upload
   */
  async confirmUploadCompletion(contentId: string, s3Key: string): Promise<VideoUploadResult> {
    try {
      // Verify file exists in S3
      const headCommand = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
      });

      const headResult = await this.s3Client.send(headCommand);
      const fileSize = headResult.ContentLength || 0;

      // Update content record
      const s3Path = `s3://${this.bucketName}/${s3Key}`;
      await this.contentRepository.update(contentId, {
        original_file_path: s3Path,
        file_size_bytes: fileSize,
        processing_status: VideoProcessingStatus.UPLOADING,
        processing_started_at: new Date(),
      });

      this.logger.log(`Upload confirmed for content ${contentId}: ${s3Path}`);

      // Queue transcoding job
      const processingJobId = await this.queueTranscodingJob(contentId, s3Path);

      return {
        contentId,
        originalPath: s3Path,
        fileSize,
        processingJobId,
      };
    } catch (error) {
      this.logger.error(`Failed to confirm upload for content ${contentId}:`, error);

      await this.contentRepository.update(contentId, {
        processing_status: VideoProcessingStatus.FAILED,
        processing_error: `Upload confirmation failed: ${error.message}`,
      });

      throw error;
    }
  }

  /**
   * Get upload status for content
   */
  async getUploadStatus(contentId: string) {
    const content = await this.contentRepository.findOne({
      where: { id: contentId },
      select: [
        'id',
        'title',
        'original_file_path',
        'file_size_bytes',
        'processing_status',
        'processing_progress',
        'processing_started_at',
        'processing_completed_at',
        'processing_error',
      ],
    });

    if (!content) {
      throw new BadRequestException(`Content with ID ${contentId} not found`);
    }

    // Get video variants
    const variants = await this.videoVariantRepository.find({
      where: { content_id: contentId },
      select: [
        'id',
        'quality',
        'status',
        'processing_progress',
        'bitrate_kbps',
        'width',
        'height',
      ],
    });

    return {
      content: {
        id: content.id,
        title: content.title,
        originalFilePath: content.original_file_path,
        fileSizeBytes: content.file_size_bytes,
        processingStatus: content.processing_status,
        processingProgress: content.processing_progress,
        processingStartedAt: content.processing_started_at,
        processingCompletedAt: content.processing_completed_at,
        processingError: content.processing_error,
      },
      variants: variants.map(variant => ({
        id: variant.id,
        quality: variant.quality,
        status: variant.status,
        processingProgress: variant.processing_progress,
        bitrate: variant.bitrate_kbps,
        resolution: `${variant.width}x${variant.height}`,
      })),
    };
  }

  /**
   * Validate video file format
   */
  private isValidVideoFile(file: Express.Multer.File): boolean {
    const allowedMimeTypes = [
      'video/mp4',
      'video/x-matroska', // MKV format
      'video/avi',
      'video/mov',
      'video/mkv',
      'video/webm',
      'video/quicktime',
    ];

    const allowedExtensions = ['.mp4', '.mkv', '.avi', '.mov', '.webm'];
    const fileExtension = path.extname(file.originalname).toLowerCase();

    return (
      allowedMimeTypes.includes(file.mimetype) &&
      allowedExtensions.includes(fileExtension)
    );
  }

  /**
   * Queue transcoding job (placeholder for queue implementation)
   */
  private async queueTranscodingJob(contentId: string, s3Path: string): Promise<string> {
    // TODO: Implement with Redis queue or AWS SQS
    const jobId = `transcode_${contentId}_${Date.now()}`;

    this.logger.log(`Queuing transcoding job ${jobId} for content ${contentId}`);

    // For now, just log the job details
    const jobData = {
      jobId,
      contentId,
      inputPath: s3Path,
      outputPath: `videos/${contentId}/hls/`,
      priority: 1,
      createdAt: new Date(),
    };

    this.logger.debug(`Transcoding job data:`, jobData);

    return jobId;
  }

  /**
   * Clean up failed uploads
   */
  async cleanupFailedUpload(contentId: string, s3Key?: string): Promise<void> {
    try {
      // Delete from S3 if key provided
      if (s3Key) {
        // TODO: Implement S3 cleanup
        this.logger.log(`Cleaning up S3 object: ${s3Key}`);
      }

      // Reset content processing status
      await this.contentRepository.update(contentId, {
        original_file_path: null,
        file_size_bytes: null,
        processing_status: VideoProcessingStatus.PENDING,
        processing_progress: null,
        processing_started_at: null,
        processing_error: null,
      });

      this.logger.log(`Cleaned up failed upload for content ${contentId}`);
    } catch (error) {
      this.logger.error(`Failed to cleanup failed upload for content ${contentId}:`, error);
      throw error;
    }
  }
}