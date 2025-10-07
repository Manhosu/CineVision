import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as crypto from 'crypto';
import * as path from 'path';

export interface ImageUploadOptions {
  file: Express.Multer.File;
  contentId?: string;
  imageType: 'poster' | 'cover' | 'backdrop';
}

export interface ImageUploadResult {
  key: string;
  url: string;
  publicUrl: string;
  fileSize: number;
}

export interface PresignedImageUploadUrl {
  uploadUrl: string;
  key: string;
  publicUrl: string;
  expiresIn: number;
}

@Injectable()
export class ImageUploadService {
  private readonly logger = new Logger(ImageUploadService.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly region: string;

  constructor(private configService: ConfigService) {
    // Initialize S3 client
    this.s3Client = new S3Client({
      region: this.configService.get('AWS_REGION', 'us-east-1'),
      credentials: {
        accessKeyId: this.configService.get('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.get('AWS_SECRET_ACCESS_KEY'),
      },
    });

    this.bucketName = this.configService.get('S3_COVERS_BUCKET') || 'cinevision-capas';
    this.region = this.configService.get('AWS_REGION', 'us-east-1');

    if (!this.bucketName) {
      throw new Error('S3_COVERS_BUCKET environment variable is required');
    }
  }

  /**
   * Upload image file directly to S3
   */
  async uploadImage(options: ImageUploadOptions): Promise<ImageUploadResult> {
    const { file, contentId, imageType } = options;

    // Validate file type
    if (!this.isValidImageFile(file)) {
      throw new BadRequestException('Invalid image file format. Only JPEG, PNG, WebP are allowed.');
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException('Image file size must be less than 10MB');
    }

    try {
      // Generate S3 key
      const key = this.generateImageKey(file.originalname, imageType, contentId);

      // Upload to S3
      const uploadCommand = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        CacheControl: 'max-age=31536000', // 1 year cache
        Metadata: {
          originalFilename: file.originalname,
          imageType,
          contentId: contentId || 'unknown',
          uploadedAt: new Date().toISOString(),
        },
      });

      await this.s3Client.send(uploadCommand);

      // Generate URLs
      const publicUrl = `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`;
      const signedUrl = await this.getSignedImageUrl(key);

      this.logger.log(`Image uploaded successfully: ${key}`);

      return {
        key,
        url: signedUrl,
        publicUrl,
        fileSize: file.size,
      };
    } catch (error) {
      this.logger.error(`Failed to upload image: ${error.message}`);
      throw new BadRequestException(`Failed to upload image: ${error.message}`);
    }
  }

  /**
   * Generate presigned URL for direct image upload
   */
  async generatePresignedImageUploadUrl(
    fileName: string,
    contentType: string,
    imageType: 'poster' | 'cover' | 'backdrop',
    contentId?: string
  ): Promise<PresignedImageUploadUrl> {
    // Validate content type
    if (!this.isValidImageContentType(contentType)) {
      throw new BadRequestException('Invalid image content type. Only JPEG, PNG, WebP are allowed.');
    }

    try {
      const key = this.generateImageKey(fileName, imageType, contentId);

      const putObjectCommand = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        ContentType: contentType,
        CacheControl: 'max-age=31536000',
        Metadata: {
          originalFilename: fileName,
          imageType,
          contentId: contentId || 'unknown',
        },
      });

      const uploadUrl = await getSignedUrl(this.s3Client, putObjectCommand, {
        expiresIn: 3600, // 1 hour
      });

      const publicUrl = `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`;

      this.logger.log(`Generated presigned URL for image upload: ${fileName}`);

      return {
        uploadUrl,
        key,
        publicUrl,
        expiresIn: 3600,
      };
    } catch (error) {
      this.logger.error(`Failed to generate presigned URL: ${error.message}`);
      throw new BadRequestException(`Failed to generate presigned URL: ${error.message}`);
    }
  }

  /**
   * Get signed URL for accessing an image
   */
  async getSignedImageUrl(key: string, expiresIn: number = 3600): Promise<string> {
    try {
      const getObjectCommand = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const signedUrl = await getSignedUrl(this.s3Client, getObjectCommand, {
        expiresIn,
      });

      return signedUrl;
    } catch (error) {
      this.logger.error(`Failed to generate signed URL for ${key}: ${error.message}`);
      throw new BadRequestException(`Failed to generate signed URL: ${error.message}`);
    }
  }

  /**
   * Get public URL for an image (for public buckets)
   */
  getPublicImageUrl(key: string): string {
    return `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`;
  }

  /**
   * Generate S3 key for image
   */
  private generateImageKey(fileName: string, imageType: string, contentId?: string): string {
    const fileExtension = path.extname(fileName);
    const timestamp = Date.now();
    const randomId = crypto.randomBytes(8).toString('hex');
    
    if (contentId) {
      return `images/${imageType}/${contentId}/${timestamp}-${randomId}${fileExtension}`;
    } else {
      return `images/${imageType}/${timestamp}-${randomId}${fileExtension}`;
    }
  }

  /**
   * Validate image file
   */
  private isValidImageFile(file: Express.Multer.File): boolean {
    const allowedMimeTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
    ];

    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
    const fileExtension = path.extname(file.originalname).toLowerCase();

    return (
      allowedMimeTypes.includes(file.mimetype) &&
      allowedExtensions.includes(fileExtension)
    );
  }

  /**
   * Validate image content type
   */
  private isValidImageContentType(contentType: string): boolean {
    const allowedContentTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
    ];

    return allowedContentTypes.includes(contentType);
  }
}