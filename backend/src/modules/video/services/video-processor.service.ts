import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import * as ffmpeg from 'fluent-ffmpeg';
import * as path from 'path';
import * as fs from 'fs/promises';
import { VideoTranscodingService } from './video-transcoding.service';

export interface VideoProcessorOptions {
  contentId: string;
  inputPath: string; // S3 path or local path
  languageId?: string;
  languageType?: 'dubbed' | 'subtitled' | 'original';
  autoConvertToHLS?: boolean; // Auto-convert files > 500MB to HLS
}

export interface ProcessingResult {
  success: boolean;
  contentId: string;
  originalFormat: string;
  finalFormat: string;
  hlsGenerated: boolean;
  hlsMasterUrl?: string;
  videoUrl?: string;
  fileSize: number;
  processingTime: number;
  error?: string;
}

@Injectable()
export class VideoProcessorService {
  private readonly logger = new Logger(VideoProcessorService.name);
  private readonly s3Client: S3Client;
  private readonly hlsBucket = 'cinevision-hls';
  private readonly videoBucket: string;
  private readonly workingDirectory: string;
  private readonly maxFileSizeForDirect = 500 * 1024 * 1024; // 500MB

  constructor(
    private configService: ConfigService,
    private transcodingService: VideoTranscodingService,
  ) {
    this.s3Client = new S3Client({
      region: this.configService.get('AWS_REGION', 'us-east-1'),
      credentials: {
        accessKeyId: this.configService.get('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.get('AWS_SECRET_ACCESS_KEY'),
      },
    });

    this.videoBucket = this.configService.get('S3_VIDEO_BUCKET', 'cinevision-filmes');
    this.workingDirectory = this.configService.get('TRANSCODING_WORK_DIR', 'C:/tmp/transcoding');

    // Setup FFmpeg path
    const ffmpegPath = this.configService.get('FFMPEG_PATH');
    const ffprobePath = this.configService.get('FFPROBE_PATH');

    if (ffmpegPath) {
      ffmpeg.setFfmpegPath(ffmpegPath);
    }
    if (ffprobePath) {
      ffmpeg.setFfprobePath(ffprobePath);
    }
  }

  /**
   * Main processing function - handles all video formats
   */
  async processVideo(options: VideoProcessorOptions): Promise<ProcessingResult> {
    const startTime = Date.now();
    const { contentId, inputPath, autoConvertToHLS = true } = options;

    this.logger.log(`Starting video processing for content ${contentId}`);
    this.logger.log(`Input path: ${inputPath}`);

    try {
      // Create working directory
      const jobWorkDir = path.join(this.workingDirectory, contentId);
      await fs.mkdir(jobWorkDir, { recursive: true });

      // Download or copy input file
      const localInputPath = await this.getLocalFile(inputPath, jobWorkDir);

      // Detect format and size
      const fileStats = await fs.stat(localInputPath);
      const fileSize = fileStats.size;
      const fileExtension = path.extname(localInputPath).toLowerCase();

      this.logger.log(`File size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);
      this.logger.log(`File format: ${fileExtension}`);

      let processedPath = localInputPath;
      let finalFormat = fileExtension.replace('.', '');
      let conversionType = 'none';

      // Step 1: Convert MKV to MP4 if needed
      if (fileExtension === '.mkv') {
        this.logger.log('MKV detected - converting to MP4');
        processedPath = await this.convertMKVToMP4(localInputPath, jobWorkDir);
        finalFormat = 'mp4';
        conversionType = 'mkv_to_mp4';
      }

      // Step 2: Check if HLS conversion is needed
      const shouldConvertToHLS = autoConvertToHLS && fileSize > this.maxFileSizeForDirect;

      if (shouldConvertToHLS) {
        this.logger.log(`File exceeds ${this.maxFileSizeForDirect / 1024 / 1024}MB - converting to HLS`);

        // Upload processed file to S3 for transcoding service
        const s3Path = await this.uploadToS3(processedPath, contentId);

        // Start HLS transcoding
        await this.transcodingService.startTranscodingJob({
          contentId,
          inputPath: s3Path,
          outputBasePath: `videos/${contentId}/hls`,
          qualities: undefined, // Use default qualities
        });

        const processingTime = Math.round((Date.now() - startTime) / 1000);

        // Cleanup
        await fs.rm(jobWorkDir, { recursive: true, force: true });

        return {
          success: true,
          contentId,
          originalFormat: fileExtension.replace('.', ''),
          finalFormat: 'hls',
          hlsGenerated: true,
          hlsMasterUrl: `s3://${this.hlsBucket}/videos/${contentId}/hls/master.m3u8`,
          fileSize,
          processingTime,
        };
      } else {
        // Upload directly as MP4
        this.logger.log('File size acceptable - uploading as direct MP4');

        const videoUrl = await this.uploadToS3(processedPath, contentId, true);
        const processingTime = Math.round((Date.now() - startTime) / 1000);

        // Cleanup
        await fs.rm(jobWorkDir, { recursive: true, force: true });

        return {
          success: true,
          contentId,
          originalFormat: fileExtension.replace('.', ''),
          finalFormat: 'mp4',
          hlsGenerated: false,
          videoUrl,
          fileSize,
          processingTime,
        };
      }

    } catch (error) {
      this.logger.error(`Video processing failed for ${contentId}:`, error);

      const processingTime = Math.round((Date.now() - startTime) / 1000);

      return {
        success: false,
        contentId,
        originalFormat: 'unknown',
        finalFormat: 'unknown',
        hlsGenerated: false,
        fileSize: 0,
        processingTime,
        error: error.message,
      };
    }
  }

  /**
   * Convert MKV to MP4
   */
  private async convertMKVToMP4(inputPath: string, workDir: string): Promise<string> {
    const outputPath = path.join(workDir, 'converted.mp4');

    this.logger.log(`Converting MKV to MP4: ${inputPath} -> ${outputPath}`);

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .videoCodec('libx264')
        .audioCodec('aac')
        .addOptions([
          '-crf', '23',
          '-preset', 'medium',
          '-movflags', '+faststart', // Enable streaming
        ])
        .on('progress', (progress) => {
          this.logger.log(`MKV conversion progress: ${Math.round(progress.percent || 0)}%`);
        })
        .on('end', () => {
          this.logger.log('MKV to MP4 conversion completed');
          resolve(outputPath);
        })
        .on('error', (err) => {
          this.logger.error('MKV to MP4 conversion failed:', err);
          reject(err);
        })
        .save(outputPath);
    });
  }

  /**
   * Get local file (download from S3 if needed)
   */
  private async getLocalFile(inputPath: string, workDir: string): Promise<string> {
    if (inputPath.startsWith('s3://') || inputPath.startsWith('https://')) {
      return this.downloadFromS3(inputPath, workDir);
    }

    // Assume it's a local path
    return inputPath;
  }

  /**
   * Download file from S3
   */
  private async downloadFromS3(s3Path: string, workDir: string): Promise<string> {
    let s3Key: string;
    let bucket: string;

    if (s3Path.startsWith('s3://')) {
      const parts = s3Path.replace('s3://', '').split('/');
      bucket = parts[0];
      s3Key = parts.slice(1).join('/');
    } else {
      // Extract from HTTPS URL
      const url = new URL(s3Path);
      bucket = url.hostname.split('.')[0];
      s3Key = url.pathname.substring(1);
    }

    const filename = path.basename(s3Key);
    const localPath = path.join(workDir, `input_${filename}`);

    this.logger.log(`Downloading from S3: ${bucket}/${s3Key}`);

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: s3Key,
    });

    const response = await this.s3Client.send(command);
    const buffer = await this.streamToBuffer(response.Body as NodeJS.ReadableStream);
    await fs.writeFile(localPath, buffer);

    return localPath;
  }

  /**
   * Upload file to S3
   */
  private async uploadToS3(
    filePath: string,
    contentId: string,
    toVideoBucket = false
  ): Promise<string> {
    const filename = path.basename(filePath);
    const fileContent = await fs.readFile(filePath);

    const bucket = toVideoBucket ? this.videoBucket : this.hlsBucket;
    const key = `videos/${contentId}/${filename}`;

    this.logger.log(`Uploading to S3: ${bucket}/${key}`);

    await this.s3Client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: fileContent,
      ContentType: 'video/mp4',
    }));

    return `s3://${bucket}/${key}`;
  }

  /**
   * Analyze video file metadata
   */
  async analyzeVideo(filePath: string): Promise<any> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          reject(err);
          return;
        }

        const videoStream = metadata.streams.find(s => s.codec_type === 'video');
        const audioStream = metadata.streams.find(s => s.codec_type === 'audio');

        resolve({
          duration: metadata.format.duration,
          fileSize: metadata.format.size,
          bitrate: metadata.format.bit_rate,
          format: metadata.format.format_name,
          video: {
            width: videoStream?.width,
            height: videoStream?.height,
            codec: videoStream?.codec_name,
            frameRate: videoStream?.r_frame_rate,
            bitrate: videoStream?.bit_rate,
          },
          audio: {
            codec: audioStream?.codec_name,
            bitrate: audioStream?.bit_rate,
            channels: audioStream?.channels,
            sampleRate: audioStream?.sample_rate,
          },
        });
      });
    });
  }

  /**
   * Convert stream to buffer
   */
  private async streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
    const chunks: Buffer[] = [];

    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }
}
