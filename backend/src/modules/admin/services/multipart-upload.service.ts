import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  ListPartsCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface InitMultipartUploadDto {
  filename: string;
  contentType: string;
  size: number;
  contentId?: string;
  episodeId?: string;
  audioType?: 'dublado' | 'legendado' | 'original';
}

export interface CompleteMultipartUploadDto {
  uploadId: string;
  key: string;
  parts: Array<{ PartNumber: number; ETag: string }>;
  contentId?: string;
  episodeId?: string;
}

export interface UploadRecord {
  id: string;
  key: string;
  upload_id: string;
  content_id?: string;
  filename: string;
  size: number;
  status: 'draft' | 'uploading' | 'processing' | 'ready' | 'failed';
  parts_count: number;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class MultipartUploadService {
  private readonly logger = new Logger(MultipartUploadService.name);
  private readonly s3Client: S3Client;
  private readonly supabase: SupabaseClient;
  private readonly videoBucket: string;
  private readonly region: string;
  private readonly partSize = 50 * 1024 * 1024; // 50MB per part
  private readonly maxFileSize = 10 * 1024 * 1024 * 1024; // 10GB max

  constructor(private readonly configService: ConfigService) {
    this.region = this.configService.get<string>('AWS_REGION', 'us-east-2');
    this.videoBucket = this.configService.get<string>(
      'S3_RAW_BUCKET',
      'cinevision-raw',
    );

    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY'),
      },
    });

    this.supabase = createClient(
      this.configService.get<string>('SUPABASE_URL'),
      this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY'),
    );

    this.logger.log(`Multipart Upload Service initialized`);
    this.logger.log(`S3 Bucket: ${this.videoBucket}`);
    this.logger.log(`Region: ${this.region}`);
  }

  /**
   * Initialize multipart upload and return presigned URLs for each part
   */
  async initMultipartUpload(dto: InitMultipartUploadDto) {
    const { filename, contentType, size, contentId, episodeId, audioType } = dto;

    // Validate file size
    if (size > this.maxFileSize) {
      throw new BadRequestException(
        `File size exceeds maximum allowed size of ${this.maxFileSize / 1024 / 1024 / 1024}GB`,
      );
    }

    // Validate content type
    const allowedTypes = ['video/mp4', 'video/x-matroska', 'video/quicktime'];
    if (!allowedTypes.includes(contentType)) {
      throw new BadRequestException(
        `Invalid content type. Allowed types: ${allowedTypes.join(', ')}`,
      );
    }

    // Generate unique key
    const timestamp = Date.now();
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    let key: string;

    if (episodeId) {
      // For episodes: raw/episodes/{episodeId}/{timestamp}-{filename}
      key = `raw/episodes/${episodeId}/${timestamp}-${sanitizedFilename}`;
    } else if (contentId) {
      // For movies: raw/{contentId}/{audioType}/{timestamp}-{filename}
      key = `raw/${contentId}/${audioType || 'original'}/${timestamp}-${sanitizedFilename}`;
    } else {
      // For temp uploads
      key = `raw/temp/${timestamp}-${sanitizedFilename}`;
    }

    this.logger.log(`Initiating multipart upload: ${key}`);

    // Create multipart upload in S3
    const createCommand = new CreateMultipartUploadCommand({
      Bucket: this.videoBucket,
      Key: key,
      ContentType: contentType,
      Metadata: {
        originalFilename: filename,
        contentId: contentId || '',
        episodeId: episodeId || '',
        audioType: audioType || 'original',
      },
    });

    const { UploadId } = await this.s3Client.send(createCommand);

    if (!UploadId) {
      throw new BadRequestException('Failed to create multipart upload');
    }

    // Calculate number of parts
    const partsCount = Math.ceil(size / this.partSize);

    this.logger.log(`Upload ID: ${UploadId}, Parts: ${partsCount}`);

    // Generate presigned URLs for each part
    const presignedUrls = [];
    for (let partNumber = 1; partNumber <= partsCount; partNumber++) {
      const uploadPartCommand = new UploadPartCommand({
        Bucket: this.videoBucket,
        Key: key,
        UploadId,
        PartNumber: partNumber,
      });

      const url = await getSignedUrl(this.s3Client, uploadPartCommand, {
        expiresIn: 3600, // 1 hour
      });

      presignedUrls.push({
        partNumber,
        url,
      });
    }

    // Create record in database
    const uploadData: any = {
      key,
      upload_id: UploadId,
      filename,
      size,
      status: 'uploading',
      parts_count: partsCount,
      audio_type: audioType || 'original', // Save audio type for content_languages creation
    };

    if (contentId) {
      uploadData.content_id = contentId;
    }

    if (episodeId) {
      uploadData.episode_id = episodeId;
    }

    const { data: uploadRecord, error } = await this.supabase
      .from('video_uploads')
      .insert(uploadData)
      .select()
      .single();

    if (error) {
      this.logger.error(`Failed to create upload record: ${error.message}`);
      // Try to abort the S3 upload
      await this.abortMultipartUpload(UploadId, key);
      throw new BadRequestException('Failed to create upload record');
    }

    return {
      uploadId: UploadId,
      key,
      partSize: this.partSize,
      partsCount,
      presignedUrls,
      recordId: uploadRecord.id,
    };
  }

  /**
   * Complete multipart upload
   */
  async completeMultipartUpload(dto: CompleteMultipartUploadDto) {
    const { uploadId, key, parts, contentId, episodeId } = dto;

    this.logger.log(`Completing multipart upload: ${key}`);

    // Validate all parts are provided
    const { data: uploadRecord } = await this.supabase
      .from('video_uploads')
      .select('*')
      .eq('upload_id', uploadId)
      .single();

    if (!uploadRecord) {
      throw new BadRequestException('Upload record not found');
    }

    if (parts.length !== uploadRecord.parts_count) {
      throw new BadRequestException(
        `Expected ${uploadRecord.parts_count} parts, received ${parts.length}`,
      );
    }

    // Complete S3 multipart upload
    const completeCommand = new CompleteMultipartUploadCommand({
      Bucket: this.videoBucket,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts.map((part) => ({
          PartNumber: part.PartNumber,
          ETag: part.ETag,
        })),
      },
    });

    try {
      const result = await this.s3Client.send(completeCommand);
      this.logger.log(`Upload completed: ${result.Location}`);

      // Update database record - mark as ready since no video processing is needed
      await this.supabase
        .from('video_uploads')
        .update({
          status: 'ready',
          updated_at: new Date().toISOString(),
        })
        .eq('upload_id', uploadId);

      // Create/Update content_languages record for movies
      let languageId: string | undefined;
      if (contentId && uploadRecord.audio_type) {
        // Map audio_type to language_type
        const languageTypeMap: Record<string, string> = {
          'dublado': 'DUBLADO',
          'legendado': 'LEGENDADO',
          'original': 'ORIGINAL',
        };

        const languageType = languageTypeMap[uploadRecord.audio_type] || 'ORIGINAL';

        // Check if content_language already exists for this content + language_type
        const { data: existingLanguage } = await this.supabase
          .from('content_languages')
          .select('id')
          .eq('content_id', contentId)
          .eq('language_type', languageType)
          .single();

        if (existingLanguage) {
          // Update existing language
          languageId = existingLanguage.id;
          await this.supabase
            .from('content_languages')
            .update({
              video_url: key,
              is_default: languageType === 'DUBLADO', // Dublado is default
              updated_at: new Date().toISOString(),
            })
            .eq('id', languageId);

          this.logger.log(`Updated content_language ${languageId} for content ${contentId}`);
        } else {
          // Create new content_language
          const { data: newLanguage, error: languageError } = await this.supabase
            .from('content_languages')
            .insert({
              content_id: contentId,
              language_type: languageType,
              video_url: key,
              is_default: languageType === 'DUBLADO', // Dublado is default
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .select('id')
            .single();

          if (languageError) {
            this.logger.error(`Failed to create content_language: ${languageError.message}`);
          } else {
            languageId = newLanguage.id;
            this.logger.log(`Created content_language ${languageId} for content ${contentId} (${languageType})`);
          }
        }

        // Update content status
        await this.supabase
          .from('content')
          .update({
            processing_status: 'ready',
            updated_at: new Date().toISOString(),
          })
          .eq('id', contentId);
      }

      // Update episode record if episodeId provided
      if (episodeId) {
        await this.supabase
          .from('episodes')
          .update({
            storage_path: key,
            file_storage_key: key,
            file_size_bytes: uploadRecord.size,
            processing_status: 'ready',
            updated_at: new Date().toISOString(),
          })
          .eq('id', episodeId);
      }

      // TODO: Enqueue transcode job here
      // await this.queueService.addTranscodeJob({ key, contentId, episodeId });

      return {
        success: true,
        location: result.Location,
        key,
        status: 'ready', // Changed from 'processing' since we don't transcode anymore
        languageId, // Return languageId for frontend to know which content_language was created
      };
    } catch (error) {
      this.logger.error(`Failed to complete upload: ${error.message}`);
      await this.supabase
        .from('video_uploads')
        .update({ status: 'failed' })
        .eq('upload_id', uploadId);
      throw new BadRequestException('Failed to complete upload');
    }
  }

  /**
   * Abort multipart upload
   */
  async abortMultipartUpload(uploadId: string, key: string) {
    this.logger.log(`Aborting multipart upload: ${key}`);

    const abortCommand = new AbortMultipartUploadCommand({
      Bucket: this.videoBucket,
      Key: key,
      UploadId: uploadId,
    });

    try {
      await this.s3Client.send(abortCommand);

      // Update database record
      await this.supabase
        .from('video_uploads')
        .update({ status: 'failed' })
        .eq('upload_id', uploadId);

      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to abort upload: ${error.message}`);
      throw new BadRequestException('Failed to abort upload');
    }
  }

  /**
   * Get upload status
   */
  async getUploadStatus(uploadId: string) {
    const { data: uploadRecord, error } = await this.supabase
      .from('video_uploads')
      .select('*')
      .eq('upload_id', uploadId)
      .single();

    if (error || !uploadRecord) {
      throw new BadRequestException('Upload record not found');
    }

    // Get uploaded parts from S3
    const listPartsCommand = new ListPartsCommand({
      Bucket: this.videoBucket,
      Key: uploadRecord.key,
      UploadId: uploadId,
    });

    try {
      const { Parts } = await this.s3Client.send(listPartsCommand);
      const uploadedParts = Parts ? Parts.length : 0;

      return {
        ...uploadRecord,
        uploadedParts,
        totalParts: uploadRecord.parts_count,
        progress: (uploadedParts / uploadRecord.parts_count) * 100,
      };
    } catch (error) {
      // If listing parts fails, just return DB record
      return {
        ...uploadRecord,
        uploadedParts: 0,
        totalParts: uploadRecord.parts_count,
        progress: 0,
      };
    }
  }

  /**
   * Generate presigned URL for video playback
   * This URL allows direct video streaming without CORS issues
   */
  async generatePresignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.videoBucket,
        Key: key,
      });

      const url = await getSignedUrl(this.s3Client, command, {
        expiresIn, // URL válida por 1 hora por padrão
      });

      this.logger.log(`Generated presigned URL for key: ${key}`);
      return url;
    } catch (error) {
      this.logger.error(`Failed to generate presigned URL for key ${key}:`, error);
      throw new BadRequestException('Failed to generate video URL');
    }
  }
}
