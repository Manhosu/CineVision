import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import * as ffmpeg from 'fluent-ffmpeg';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import { Content, VideoProcessingStatus, VideoQuality } from '../../content/entities/content.entity';
import { VideoVariant } from '../../content/entities/video-variant.entity';

export interface TranscodingJobOptions {
  contentId: string;
  inputPath: string;
  outputBasePath?: string;
  qualities?: VideoQuality[];
  priority?: number;
}

export interface TranscodingProgress {
  contentId: string;
  currentQuality?: VideoQuality;
  progress: number;
  stage: 'analyzing' | 'transcoding' | 'uploading' | 'generating_manifest';
  estimatedTimeRemaining?: number;
}

export interface QualitySettings {
  quality: VideoQuality;
  width: number;
  height: number;
  bitrate: number;
  audioBitrate: number;
  crf: number;
  preset: string;
}

@Injectable()
export class VideoTranscodingService {
  private readonly logger = new Logger(VideoTranscodingService.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly workingDirectory: string;

  private readonly qualitySettings: Map<VideoQuality, QualitySettings> = new Map([
    [VideoQuality.HD_1080, {
      quality: VideoQuality.HD_1080,
      width: 1920,
      height: 1080,
      bitrate: 5000,
      audioBitrate: 192,
      crf: 23,
      preset: 'medium',
    }],
    [VideoQuality.HD_720, {
      quality: VideoQuality.HD_720,
      width: 1280,
      height: 720,
      bitrate: 3000,
      audioBitrate: 128,
      crf: 24,
      preset: 'medium',
    }],
    [VideoQuality.SD_480, {
      quality: VideoQuality.SD_480,
      width: 854,
      height: 480,
      bitrate: 1500,
      audioBitrate: 128,
      crf: 26,
      preset: 'medium',
    }],
    [VideoQuality.SD_360, {
      quality: VideoQuality.SD_360,
      width: 640,
      height: 360,
      bitrate: 800,
      audioBitrate: 96,
      crf: 28,
      preset: 'fast',
    }],
  ]);

  constructor(
    @InjectRepository(Content)
    private contentRepository: Repository<Content>,
    @InjectRepository(VideoVariant)
    private videoVariantRepository: Repository<VideoVariant>,
    private configService: ConfigService,
  ) {
    this.s3Client = new S3Client({
      region: this.configService.get('AWS_REGION', 'us-east-1'),
      credentials: {
        accessKeyId: this.configService.get('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.get('AWS_SECRET_ACCESS_KEY'),
      },
    });

    this.bucketName = this.configService.get('S3_VIDEO_BUCKET');
    this.workingDirectory = this.configService.get('TRANSCODING_WORK_DIR', '/tmp/transcoding');

    // Setup FFmpeg path if specified
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
   * Start transcoding job for content
   */
  async startTranscodingJob(options: TranscodingJobOptions): Promise<void> {
    const { contentId, inputPath, outputBasePath, qualities, priority = 1 } = options;

    this.logger.log(`Starting transcoding job for content ${contentId}`);

    try {
      // Update content status
      await this.contentRepository.update(contentId, {
        processing_status: VideoProcessingStatus.PROCESSING,
        processing_progress: 0,
      });

      // Default qualities if not specified
      const targetQualities = qualities || [
        VideoQuality.HD_1080,
        VideoQuality.HD_720,
        VideoQuality.SD_480,
        VideoQuality.SD_360,
      ];

      // Create video variant records
      await this.createVideoVariants(contentId, targetQualities);

      // Create working directory
      const jobWorkDir = path.join(this.workingDirectory, contentId);
      await fs.mkdir(jobWorkDir, { recursive: true });

      // Download input file from S3
      const inputFilePath = await this.downloadInputFile(inputPath, jobWorkDir);

      // Analyze input video
      const videoInfo = await this.analyzeVideoFile(inputFilePath);
      this.logger.log(`Video analysis complete for ${contentId}:`, videoInfo);

      // Filter qualities based on input resolution
      const validQualities = this.filterQualitiesByInput(targetQualities, videoInfo);

      // Transcode each quality
      for (const quality of validQualities) {
        await this.transcodeQuality(contentId, inputFilePath, quality, jobWorkDir);
      }

      // Generate master playlist
      const masterPlaylistPath = await this.generateMasterPlaylist(contentId, validQualities, jobWorkDir);

      // Upload HLS files to S3
      const hlsBasePath = outputBasePath || `videos/${contentId}/hls`;
      await this.uploadHLSFiles(contentId, jobWorkDir, hlsBasePath);

      // Update content with HLS URLs
      const masterUrl = `s3://${this.bucketName}/${hlsBasePath}/master.m3u8`;
      await this.contentRepository.update(contentId, {
        processing_status: VideoProcessingStatus.READY,
        processing_progress: 100,
        processing_completed_at: new Date(),
        hls_master_url: masterUrl,
        hls_base_path: hlsBasePath,
        available_qualities: JSON.stringify(validQualities),
      });

      // Cleanup working directory
      await fs.rm(jobWorkDir, { recursive: true, force: true });

      this.logger.log(`Transcoding job completed successfully for content ${contentId}`);

    } catch (error) {
      this.logger.error(`Transcoding job failed for content ${contentId}:`, error);

      // Update content with error status
      await this.contentRepository.update(contentId, {
        processing_status: VideoProcessingStatus.FAILED,
        processing_error: error.message,
      });

      // Update all variants as failed
      await this.videoVariantRepository.update(
        { content_id: contentId },
        {
          status: VideoProcessingStatus.FAILED,
          processing_error: error.message,
        }
      );

      throw error;
    }
  }

  /**
   * Create video variant records for tracking
   */
  private async createVideoVariants(contentId: string, qualities: VideoQuality[]): Promise<void> {
    const variants = qualities.map(quality => {
      const settings = this.qualitySettings.get(quality);
      return this.videoVariantRepository.create({
        content_id: contentId,
        quality,
        status: VideoProcessingStatus.PENDING,
        bitrate_kbps: settings?.bitrate,
        width: settings?.width,
        height: settings?.height,
        target_duration: 6.0,
      });
    });

    await this.videoVariantRepository.save(variants);
  }

  /**
   * Download input file from S3
   */
  private async downloadInputFile(s3Path: string, workDir: string): Promise<string> {
    const s3Key = s3Path.replace(`s3://${this.bucketName}/`, '');
    const filename = path.basename(s3Key);
    const localPath = path.join(workDir, `input_${filename}`);

    this.logger.log(`Downloading input file from S3: ${s3Key}`);

    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: s3Key,
    });

    const response = await this.s3Client.send(command);
    const fileStream = response.Body as NodeJS.ReadableStream;

    const buffer = await this.streamToBuffer(fileStream);
    await fs.writeFile(localPath, buffer);

    return localPath;
  }

  /**
   * Analyze input video file
   */
  private async analyzeVideoFile(filePath: string): Promise<any> {
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
          video: {
            width: videoStream?.width,
            height: videoStream?.height,
            codec: videoStream?.codec_name,
            frameRate: eval(videoStream?.r_frame_rate || '0'),
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
   * Filter qualities based on input video resolution
   */
  private filterQualitiesByInput(qualities: VideoQuality[], videoInfo: any): VideoQuality[] {
    const inputHeight = videoInfo.video?.height || 720;

    return qualities.filter(quality => {
      const settings = this.qualitySettings.get(quality);
      return settings && settings.height <= inputHeight;
    });
  }

  /**
   * Transcode specific quality variant
   */
  private async transcodeQuality(
    contentId: string,
    inputPath: string,
    quality: VideoQuality,
    workDir: string
  ): Promise<void> {
    const settings = this.qualitySettings.get(quality);
    if (!settings) {
      throw new Error(`No settings found for quality ${quality}`);
    }

    this.logger.log(`Starting transcoding for quality ${quality}`);

    // Update variant status
    await this.videoVariantRepository.update(
      { content_id: contentId, quality },
      {
        status: VideoProcessingStatus.PROCESSING,
        processing_started_at: new Date(),
      }
    );

    const outputDir = path.join(workDir, quality);
    await fs.mkdir(outputDir, { recursive: true });

    const playlistPath = path.join(outputDir, 'playlist.m3u8');

    return new Promise((resolve, reject) => {
      const command = ffmpeg(inputPath)
        .videoCodec('libx264')
        .audioCodec('aac')
        .size(`${settings.width}x${settings.height}`)
        .videoBitrate(settings.bitrate)
        .audioBitrate(settings.audioBitrate)
        .addOptions([
          '-crf', settings.crf.toString(),
          '-preset', settings.preset,
          '-g', '48', // GOP size
          '-keyint_min', '48',
          '-sc_threshold', '0',
          '-hls_time', '6',
          '-hls_playlist_type', 'vod',
          '-hls_segment_filename', path.join(outputDir, 'segment_%03d.ts'),
          '-hls_base_url', `${quality}/`,
          '-f', 'hls',
        ]);

      // Progress tracking
      command.on('progress', async (progress) => {
        const percent = Math.round(progress.percent || 0);
        await this.videoVariantRepository.update(
          { content_id: contentId, quality },
          { processing_progress: percent }
        );
      });

      command.on('end', async () => {
        this.logger.log(`Transcoding completed for quality ${quality}`);

        await this.videoVariantRepository.update(
          { content_id: contentId, quality },
          {
            status: VideoProcessingStatus.READY,
            processing_completed_at: new Date(),
            processing_progress: 100,
            playlist_url: `${quality}/playlist.m3u8`,
            segments_path: `${quality}/`,
          }
        );

        resolve();
      });

      command.on('error', async (err) => {
        this.logger.error(`Transcoding failed for quality ${quality}:`, err);

        await this.videoVariantRepository.update(
          { content_id: contentId, quality },
          {
            status: VideoProcessingStatus.FAILED,
            processing_error: err.message,
          }
        );

        reject(err);
      });

      command.save(playlistPath);
    });
  }

  /**
   * Generate master playlist
   */
  private async generateMasterPlaylist(
    contentId: string,
    qualities: VideoQuality[],
    workDir: string
  ): Promise<string> {
    const masterPlaylistPath = path.join(workDir, 'master.m3u8');

    let masterContent = '#EXTM3U\n#EXT-X-VERSION:3\n\n';

    for (const quality of qualities) {
      const settings = this.qualitySettings.get(quality);
      if (!settings) continue;

      masterContent += `#EXT-X-STREAM-INF:BANDWIDTH=${settings.bitrate * 1000},RESOLUTION=${settings.width}x${settings.height}\n`;
      masterContent += `${quality}/playlist.m3u8\n\n`;
    }

    await fs.writeFile(masterPlaylistPath, masterContent);

    this.logger.log(`Master playlist generated for content ${contentId}`);
    return masterPlaylistPath;
  }

  /**
   * Upload HLS files to S3
   */
  private async uploadHLSFiles(contentId: string, workDir: string, s3BasePath: string): Promise<void> {
    this.logger.log(`Uploading HLS files for content ${contentId} to S3: ${s3BasePath}`);

    // Upload master playlist
    const masterPlaylistPath = path.join(workDir, 'master.m3u8');
    const masterContent = await fs.readFile(masterPlaylistPath);

    await this.s3Client.send(new PutObjectCommand({
      Bucket: this.bucketName,
      Key: `${s3BasePath}/master.m3u8`,
      Body: masterContent,
      ContentType: 'application/vnd.apple.mpegurl',
      CacheControl: 'max-age=3600',
    }));

    // Upload quality variants
    const qualityDirs = await fs.readdir(workDir, { withFileTypes: true });

    for (const dir of qualityDirs) {
      if (!dir.isDirectory()) continue;

      const qualityPath = path.join(workDir, dir.name);
      const files = await fs.readdir(qualityPath);

      for (const file of files) {
        const filePath = path.join(qualityPath, file);
        const fileContent = await fs.readFile(filePath);

        const contentType = file.endsWith('.m3u8')
          ? 'application/vnd.apple.mpegurl'
          : 'video/MP2T';

        await this.s3Client.send(new PutObjectCommand({
          Bucket: this.bucketName,
          Key: `${s3BasePath}/${dir.name}/${file}`,
          Body: fileContent,
          ContentType: contentType,
          CacheControl: file.endsWith('.ts') ? 'max-age=31536000' : 'max-age=3600', // Long cache for segments
        }));
      }
    }

    this.logger.log(`HLS files uploaded successfully for content ${contentId}`);
  }

  /**
   * Get transcoding progress
   */
  async getTranscodingProgress(contentId: string): Promise<TranscodingProgress> {
    const content = await this.contentRepository.findOne({
      where: { id: contentId },
      select: ['processing_status', 'processing_progress'],
    });

    const variants = await this.videoVariantRepository.find({
      where: { content_id: contentId },
      select: ['quality', 'status', 'processing_progress'],
    });

    const currentVariant = variants.find(v => v.status === VideoProcessingStatus.PROCESSING);

    return {
      contentId,
      currentQuality: currentVariant?.quality,
      progress: content?.processing_progress || 0,
      stage: this.getProcessingStage(content?.processing_status),
    };
  }

  private getProcessingStage(status?: VideoProcessingStatus): TranscodingProgress['stage'] {
    switch (status) {
      case VideoProcessingStatus.UPLOADING:
        return 'uploading';
      case VideoProcessingStatus.PROCESSING:
        return 'transcoding';
      default:
        return 'analyzing';
    }
  }

  /**
   * Utility function to convert stream to buffer
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