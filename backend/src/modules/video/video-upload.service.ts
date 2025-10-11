import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand, PutObjectCommand, ListMultipartUploadsCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getSignedUrl as getCloudFrontSignedUrl } from 'aws-cloudfront-sign';
import * as fs from 'fs';
import * as path from 'path';

export interface MultipartUploadResponse {
  uploadId: string;
  key: string;
  presignedUrls: string[];
}

export interface CompleteUploadRequest {
  uploadId: string;
  key: string;
  parts: Array<{
    ETag: string;
    PartNumber: number;
  }>;
}

@Injectable()
export class VideoUploadService {
  private readonly logger = new Logger(VideoUploadService.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly cloudFrontDomain: string;
  private readonly cloudFrontKeyPairId: string;
  private readonly privateKeyPath: string;

  constructor(private configService: ConfigService) {
    this.s3Client = new S3Client({
      region: this.configService.get('AWS_REGION', 'us-east-1'),
      credentials: {
        accessKeyId: this.configService.get('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.get('AWS_SECRET_ACCESS_KEY'),
      },
    });

    this.bucketName = this.configService.get('S3_VIDEO_BUCKET');
    this.cloudFrontDomain = this.configService.get('CLOUDFRONT_DOMAIN_NAME');
    this.cloudFrontKeyPairId = this.configService.get('CLOUDFRONT_KEY_PAIR_ID');
    this.privateKeyPath = this.configService.get('CLOUDFRONT_PRIVATE_KEY_PATH');
  }

  /**
   * Initiate multipart upload for large video files
   */
  async initiateMultipartUpload(
    fileName: string,
    contentType: string,
    fileSize: number,
    chunkSize: number = 10 * 1024 * 1024, // 10MB chunks
  ): Promise<MultipartUploadResponse> {
    try {
      // If fileName already starts with 'videos/', use it as-is (it's actually a full storage key)
      // Otherwise, treat it as a simple filename and add the videos prefix
      const key = fileName.startsWith('videos/')
        ? fileName
        : `videos/${Date.now()}-${fileName}`;
      
      // Create multipart upload
      const createCommand = new CreateMultipartUploadCommand({
        Bucket: this.bucketName,
        Key: key,
        ContentType: contentType,
        Metadata: {
          originalName: fileName,
          uploadedAt: new Date().toISOString(),
        },
      });

      const response = await this.s3Client.send(createCommand);
      const uploadId = response.UploadId;

      // Calculate number of parts
      const numParts = Math.ceil(fileSize / chunkSize);
      
      // Generate presigned URLs for each part
      const presignedUrls: string[] = [];
      
      for (let partNumber = 1; partNumber <= numParts; partNumber++) {
        const uploadPartCommand = new UploadPartCommand({
        Bucket: this.bucketName,
        Key: key,
        PartNumber: partNumber,
        UploadId: uploadId,
      });

        const presignedUrl = await getSignedUrl(this.s3Client, uploadPartCommand, {
          expiresIn: 3600, // 1 hour
        });

        presignedUrls.push(presignedUrl);
      }

      this.logger.log(`Initiated multipart upload for ${fileName} with ${numParts} parts`);

      return {
        uploadId,
        key,
        presignedUrls,
      };
    } catch (error) {
      this.logger.error(`Failed to initiate multipart upload: ${error.message}`);
      throw error;
    }
  }

  /**
   * Complete multipart upload
   */
  async completeMultipartUpload(request: CompleteUploadRequest): Promise<string> {
    try {
      const completeCommand = new CompleteMultipartUploadCommand({
        Bucket: this.bucketName,
        Key: request.key,
        UploadId: request.uploadId,
        MultipartUpload: {
          Parts: request.parts,
        },
      });

      const response = await this.s3Client.send(completeCommand);
      
      this.logger.log(`Completed multipart upload for ${request.key}`);
      
      return response.Location;
    } catch (error) {
      this.logger.error(`Failed to complete multipart upload: ${error.message}`);
      throw error;
    }
  }

  /**
   * Abort multipart upload
   */
  async abortMultipartUpload(uploadId: string, key: string): Promise<void> {
    try {
      const abortCommand = new AbortMultipartUploadCommand({
        Bucket: this.bucketName,
        Key: key,
        UploadId: uploadId,
      });

      await this.s3Client.send(abortCommand);
      
      this.logger.log(`Aborted multipart upload for ${key}`);
    } catch (error) {
      this.logger.error(`Failed to abort multipart upload: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate CloudFront signed URL for video streaming
   */
  async generateSignedUrl(videoKey: string, expiresInMinutes: number = 60): Promise<string> {
    try {
      if (!this.cloudFrontDomain || !this.cloudFrontKeyPairId || !this.privateKeyPath) {
        throw new Error('CloudFront configuration is incomplete');
      }

      // Read private key
      const privateKeyPath = path.resolve(this.privateKeyPath);
      const privateKey = fs.readFileSync(privateKeyPath, 'utf8');

      // Generate signed URL
      const url = `https://${this.cloudFrontDomain}/${videoKey}`;
      const expires = Math.floor(Date.now() / 1000) + (expiresInMinutes * 60);

      const signedUrl = getCloudFrontSignedUrl(url, {
        keypairId: this.cloudFrontKeyPairId,
        privateKeyString: privateKey,
        expireTime: expires,
      });

      this.logger.log(`Generated signed URL for ${videoKey}, expires in ${expiresInMinutes} minutes`);

      return signedUrl;
    } catch (error) {
      this.logger.error(`Failed to generate signed URL: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate presigned URL for direct S3 upload (for smaller files)
   */
  async generatePresignedUploadUrl(fileName: string, contentType: string): Promise<string> {
    try {
      const key = `videos/${Date.now()}-${fileName}`;

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        ContentType: contentType,
      });

      const presignedUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn: 3600, // 1 hour
      });

      this.logger.log(`Generated presigned upload URL for ${fileName}`);

      return presignedUrl;
    } catch (error) {
      this.logger.error(`Failed to generate presigned upload URL: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate presigned URL for uploading a specific part of a multipart upload
   */
  async generatePresignedPartUploadUrl(
    key: string,
    uploadId: string,
    partNumber: number,
    expiresIn: number = 3600,
  ): Promise<string> {
    try {
      const uploadPartCommand = new UploadPartCommand({
        Bucket: this.bucketName,
        Key: key,
        PartNumber: partNumber,
        UploadId: uploadId,
      });

      const presignedUrl = await getSignedUrl(this.s3Client, uploadPartCommand, {
        expiresIn,
      });

      this.logger.log(`Generated presigned URL for part ${partNumber} of upload ${uploadId}`);

      return presignedUrl;
    } catch (error) {
      this.logger.error(`Failed to generate presigned part upload URL: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get video metadata and streaming URL
   */
  async getVideoStreamingInfo(videoKey: string): Promise<{
    streamingUrl: string;
    metadata: any;
  }> {
    try {
      // Generate signed streaming URL
      const streamingUrl = await this.generateSignedUrl(videoKey, 120); // 2 hours

      // In a real implementation, you might want to get metadata from S3
      const metadata = {
        key: videoKey,
        bucket: this.bucketName,
        generatedAt: new Date().toISOString(),
      };

      return {
        streamingUrl,
        metadata,
      };
    } catch (error) {
      this.logger.error(`Failed to get video streaming info: ${error.message}`);
      throw error;
    }
  }

  /**
   * Cleanup incomplete multipart uploads older than specified hours
   */
  async cleanupIncompleteUploads(olderThanHours: number = 24): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setHours(cutoffDate.getHours() - olderThanHours);

      const listCommand = new ListMultipartUploadsCommand({
        Bucket: this.bucketName,
        MaxUploads: 1000,
      });

      const response = await this.s3Client.send(listCommand);
      
      if (!response.Uploads || response.Uploads.length === 0) {
        this.logger.log('No incomplete uploads found for cleanup');
        return 0;
      }

      const uploadsToAbort = response.Uploads.filter(upload => 
        upload.Initiated && upload.Initiated < cutoffDate
      );

      this.logger.log(`Found ${uploadsToAbort.length} incomplete uploads to cleanup`);

      let cleanedCount = 0;
      for (const upload of uploadsToAbort) {
        try {
          await this.abortMultipartUpload(upload.UploadId!, upload.Key!);
          this.logger.log(`Aborted incomplete upload: ${upload.Key} (${upload.UploadId})`);
          cleanedCount++;
        } catch (error) {
          this.logger.error(`Failed to abort upload ${upload.UploadId}: ${error.message}`);
        }
      }

      this.logger.log(`Cleanup completed. Aborted ${cleanedCount} incomplete uploads`);
      return cleanedCount;
    } catch (error) {
      this.logger.error(`Failed to cleanup incomplete uploads: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get upload statistics
   */
  async getUploadStatistics(): Promise<{
    totalUploads: number;
    incompleteUploads: number;
    totalSize: number;
  }> {
    try {
      const listCommand = new ListMultipartUploadsCommand({
        Bucket: this.bucketName,
        MaxUploads: 1000,
      });

      const response = await this.s3Client.send(listCommand);
      
      if (!response.Uploads || response.Uploads.length === 0) {
        return {
          totalUploads: 0,
          incompleteUploads: 0,
          totalSize: 0,
        };
      }

      const uploads = response.Uploads;
      // Note: S3 doesn't provide size info for incomplete uploads, so we estimate
      const estimatedTotalSize = uploads.length * 100 * 1024 * 1024; // Estimate 100MB per upload

      return {
        totalUploads: uploads.length, // For incomplete uploads, total = incomplete
        incompleteUploads: uploads.length,
        totalSize: estimatedTotalSize,
      };
    } catch (error) {
      this.logger.error(`Failed to get upload statistics: ${error.message}`);
      throw error;
    }
  }

  /**
   * Validate file type and size
   */
  validateUploadFile(fileName: string, fileSize: number, contentType: string): { valid: boolean; error?: string } {
    // Allowed video formats
    const allowedTypes = [
      'video/mp4',
      'video/mpeg',
      'video/quicktime',
      'video/x-msvideo', // AVI
      'video/x-ms-wmv',  // WMV
      'video/webm',
      'video/x-matroska' // MKV
    ];

    // Check file type
    if (!allowedTypes.includes(contentType)) {
      return {
        valid: false,
        error: `Unsupported file type: ${contentType}. Allowed types: ${allowedTypes.join(', ')}`
      };
    }

    // Check file size (max 5GB)
    const maxSize = 5 * 1024 * 1024 * 1024; // 5GB
    if (fileSize > maxSize) {
      return {
        valid: false,
        error: `File size too large: ${fileSize} bytes. Maximum allowed: ${maxSize} bytes (5GB)`
      };
    }

    // Check file extension
    const allowedExtensions = ['.mp4', '.mpeg', '.mov', '.avi', '.wmv', '.webm', '.mkv'];
    const fileExtension = path.extname(fileName).toLowerCase();
    
    if (!allowedExtensions.includes(fileExtension)) {
      return {
        valid: false,
        error: `Unsupported file extension: ${fileExtension}. Allowed extensions: ${allowedExtensions.join(', ')}`
      };
    }

    return { valid: true };
  }
}