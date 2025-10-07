import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Content, VideoProcessingStatus } from '../entities/content.entity';
import { Episode } from '../entities/episode.entity';
import { SystemLog } from '../../logs/entities/system-log.entity';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import { spawn } from 'child_process';
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { Job } from 'bullmq';

export interface TranscodeJobData {
  contentId?: string;
  episodeId?: string;
  type: 'content' | 'episode';
  sourceKey: string;
  outputBasePath: string;
  qualities?: string[];
  userId?: string;
}

export interface TranscodeProgress {
  percentage: number;
  stage: string;
  currentQuality?: string;
  eta?: number;
  fps?: number;
  speed?: string;
}

export interface QualityProfile {
  name: string;
  resolution: string;
  videoBitrate: string;
  audioBitrate: string;
  maxrate: string;
  bufsize: string;
}

const QUALITY_PROFILES: Record<string, QualityProfile> = {
  '1080p': {
    name: '1080p',
    resolution: '1920x1080',
    videoBitrate: '5000k',
    audioBitrate: '192k',
    maxrate: '5350k',
    bufsize: '7500k',
  },
  '720p': {
    name: '720p',
    resolution: '1280x720',
    videoBitrate: '3000k',
    audioBitrate: '128k',
    maxrate: '3210k',
    bufsize: '4500k',
  },
  '480p': {
    name: '480p',
    resolution: '854x480',
    videoBitrate: '1500k',
    audioBitrate: '128k',
    maxrate: '1605k',
    bufsize: '2250k',
  },
  '360p': {
    name: '360p',
    resolution: '640x360',
    videoBitrate: '800k',
    audioBitrate: '96k',
    maxrate: '856k',
    bufsize: '1200k',
  },
};

@Injectable()
export class TranscodeService {
  private readonly logger = new Logger(TranscodeService.name);
  private readonly s3Client: S3Client;
  private readonly bucket: string;
  private readonly tempDir: string;

  constructor(
    @InjectRepository(Content)
    private contentRepository: Repository<Content>,
    @InjectRepository(Episode)
    private episodeRepository: Repository<Episode>,
    @InjectRepository(SystemLog)
    private systemLogRepository: Repository<SystemLog>,
    private configService: ConfigService,
  ) {
    this.bucket = this.configService.get('AWS_S3_BUCKET');
    this.tempDir = path.join(os.tmpdir(), 'cinevision-transcode');

    this.s3Client = new S3Client({
      region: this.configService.get('AWS_REGION'),
      credentials: {
        accessKeyId: this.configService.get('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.get('AWS_SECRET_ACCESS_KEY'),
      },
    });

    // Ensure temp directory exists
    this.ensureTempDir();
  }

  private async ensureTempDir(): Promise<void> {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
      this.logger.log(`Temp directory ensured: ${this.tempDir}`);
    } catch (error) {
      this.logger.error(`Failed to create temp directory: ${error.message}`);
    }
  }

  /**
   * Main transcoding job processor
   */
  async processTranscodeJob(
    job: Job<TranscodeJobData>,
  ): Promise<{ success: boolean; hlsMasterUrl?: string; error?: string }> {
    const { contentId, episodeId, type, sourceKey, outputBasePath, qualities, userId } = job.data;
    const entityId = contentId || episodeId;

    this.logger.log(`Starting transcode job ${job.id} for ${type} ${entityId}`);

    const workDir = path.join(this.tempDir, `job-${job.id}`);
    let localSourcePath: string;
    let totalQualities = qualities || ['1080p', '720p', '480p', '360p'];

    try {
      // Stage 1: Setup work directory
      await job.updateProgress({ percentage: 0, stage: 'setup' } as TranscodeProgress);
      await fs.mkdir(workDir, { recursive: true });

      // Stage 2: Download source from S3
      await job.updateProgress({ percentage: 5, stage: 'downloading' } as TranscodeProgress);
      this.logger.log(`Downloading source file from S3: ${sourceKey}`);
      localSourcePath = await this.downloadFromS3(sourceKey, workDir);

      // Stage 3: Validate source file
      await job.updateProgress({ percentage: 10, stage: 'validating' } as TranscodeProgress);
      const sourceInfo = await this.getVideoInfo(localSourcePath);
      this.logger.log(`Source video info: ${JSON.stringify(sourceInfo)}`);

      // Filter qualities based on source resolution
      totalQualities = this.filterQualitiesBySourceResolution(totalQualities, sourceInfo.height);

      // Update entity status
      await this.updateEntityStatus(type, entityId, VideoProcessingStatus.PROCESSING, {
        processing_started_at: new Date(),
      });

      // Stage 4: Transcode to HLS
      const hlsDir = path.join(workDir, 'hls');
      await fs.mkdir(hlsDir, { recursive: true });

      const hlsFiles: string[] = [];
      let currentProgress = 15;

      for (let i = 0; i < totalQualities.length; i++) {
        const quality = totalQualities[i];
        const profile = QUALITY_PROFILES[quality];
        const progressStart = currentProgress;
        const progressEnd = currentProgress + Math.floor(70 / totalQualities.length);

        await job.updateProgress({
          percentage: progressStart,
          stage: 'transcoding',
          currentQuality: quality,
        } as TranscodeProgress);

        this.logger.log(`Transcoding to ${quality}...`);

        const hlsFile = await this.transcodeToHLS(
          localSourcePath,
          hlsDir,
          profile,
          (progress) => {
            const jobProgress = progressStart + Math.floor((progressEnd - progressStart) * progress);
            job.updateProgress({
              percentage: jobProgress,
              stage: 'transcoding',
              currentQuality: quality,
            } as TranscodeProgress);
          },
        );

        hlsFiles.push(hlsFile);
        currentProgress = progressEnd;
      }

      // Stage 5: Create master playlist
      await job.updateProgress({ percentage: 85, stage: 'creating_master_playlist' } as TranscodeProgress);
      const masterPlaylistPath = await this.createMasterPlaylist(hlsDir, totalQualities);

      // Stage 6: Upload to S3
      await job.updateProgress({ percentage: 90, stage: 'uploading' } as TranscodeProgress);
      this.logger.log('Uploading HLS files to S3...');

      const s3BasePath = outputBasePath || `content/${entityId}/hls`;
      await this.uploadDirectoryToS3(hlsDir, s3BasePath);

      const hlsMasterUrl = `https://${this.bucket}.s3.amazonaws.com/${s3BasePath}/master.m3u8`;

      // Stage 7: Update entity with HLS URL
      await job.updateProgress({ percentage: 95, stage: 'finalizing' } as TranscodeProgress);
      await this.updateEntityStatus(type, entityId, VideoProcessingStatus.READY, {
        hls_master_url: hlsMasterUrl,
        available_qualities: JSON.stringify(totalQualities),
        processing_completed_at: new Date(),
        processing_progress: 100,
      });

      // Log completion
      await this.systemLogRepository.save({
        entity_type: type,
        entity_id: entityId,
        action: 'transcode_complete',
        user_id: userId,
        meta: {
          job_id: job.id,
          qualities: totalQualities,
          hls_master_url: hlsMasterUrl,
        },
      });

      // Cleanup
      await job.updateProgress({ percentage: 100, stage: 'completed' } as TranscodeProgress);
      await this.cleanup(workDir);

      this.logger.log(`Transcode job ${job.id} completed successfully`);

      return { success: true, hlsMasterUrl };
    } catch (error) {
      this.logger.error(`Transcode job ${job.id} failed: ${error.message}`, error.stack);

      // Update entity with error
      await this.updateEntityStatus(type, entityId, VideoProcessingStatus.FAILED, {
        processing_error: error.message,
      });

      // Log failure
      await this.systemLogRepository.save({
        entity_type: type,
        entity_id: entityId,
        action: 'transcode_failed',
        user_id: userId,
        meta: {
          job_id: job.id,
          error: error.message,
        },
      });

      // Cleanup
      await this.cleanup(workDir);

      return { success: false, error: error.message };
    }
  }

  /**
   * Download file from S3 to local filesystem
   */
  private async downloadFromS3(key: string, destDir: string): Promise<string> {
    const localPath = path.join(destDir, 'source' + path.extname(key));

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const response = await this.s3Client.send(command);

    if (!response.Body) {
      throw new Error('Empty response from S3');
    }

    // Write stream to file
    const fileStream = require('fs').createWriteStream(localPath);
    const bodyStream = response.Body as any;

    return new Promise((resolve, reject) => {
      bodyStream.pipe(fileStream);
      bodyStream.on('error', reject);
      fileStream.on('finish', () => resolve(localPath));
      fileStream.on('error', reject);
    });
  }

  /**
   * Get video information using ffprobe
   */
  private async getVideoInfo(filePath: string): Promise<{
    duration: number;
    width: number;
    height: number;
    bitrate: number;
  }> {
    return new Promise((resolve, reject) => {
      const ffprobe = spawn('ffprobe', [
        '-v',
        'error',
        '-select_streams',
        'v:0',
        '-show_entries',
        'stream=width,height,bit_rate,duration',
        '-show_entries',
        'format=duration,bit_rate',
        '-of',
        'json',
        filePath,
      ]);

      let stdout = '';
      let stderr = '';

      ffprobe.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      ffprobe.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ffprobe.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`ffprobe failed: ${stderr}`));
          return;
        }

        try {
          const info = JSON.parse(stdout);
          const stream = info.streams[0];
          const format = info.format;

          resolve({
            duration: parseFloat(format.duration || stream.duration || 0),
            width: parseInt(stream.width || 0),
            height: parseInt(stream.height || 0),
            bitrate: parseInt(format.bit_rate || stream.bit_rate || 0),
          });
        } catch (error) {
          reject(new Error(`Failed to parse ffprobe output: ${error.message}`));
        }
      });
    });
  }

  /**
   * Filter qualities based on source resolution
   */
  private filterQualitiesBySourceResolution(qualities: string[], sourceHeight: number): string[] {
    const heightMap: Record<string, number> = {
      '1080p': 1080,
      '720p': 720,
      '480p': 480,
      '360p': 360,
    };

    return qualities.filter((quality) => {
      const qualityHeight = heightMap[quality];
      return qualityHeight && qualityHeight <= sourceHeight;
    });
  }

  /**
   * Transcode video to HLS using FFmpeg
   */
  private async transcodeToHLS(
    inputPath: string,
    outputDir: string,
    profile: QualityProfile,
    onProgress?: (progress: number) => void,
  ): Promise<string> {
    const outputPlaylist = path.join(outputDir, `${profile.name}.m3u8`);
    const outputSegmentPattern = path.join(outputDir, `${profile.name}_%03d.ts`);

    // Get video duration for progress calculation
    const videoInfo = await this.getVideoInfo(inputPath);
    const totalDuration = videoInfo.duration;

    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-i',
        inputPath,
        '-vf',
        `scale=${profile.resolution}:force_original_aspect_ratio=decrease,pad=${profile.resolution}:(ow-iw)/2:(oh-ih)/2`,
        '-c:v',
        'libx264',
        '-b:v',
        profile.videoBitrate,
        '-maxrate',
        profile.maxrate,
        '-bufsize',
        profile.bufsize,
        '-preset',
        'medium',
        '-profile:v',
        'main',
        '-level',
        '4.0',
        '-c:a',
        'aac',
        '-b:a',
        profile.audioBitrate,
        '-ar',
        '48000',
        '-ac',
        '2',
        '-f',
        'hls',
        '-hls_time',
        '6',
        '-hls_playlist_type',
        'vod',
        '-hls_segment_filename',
        outputSegmentPattern,
        outputPlaylist,
      ]);

      let stderr = '';

      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();

        // Parse progress from FFmpeg output
        if (onProgress && totalDuration > 0) {
          const timeMatch = stderr.match(/time=(\d{2}):(\d{2}):(\d{2})\.\d+/);
          if (timeMatch) {
            const hours = parseInt(timeMatch[1]);
            const minutes = parseInt(timeMatch[2]);
            const seconds = parseInt(timeMatch[3]);
            const currentTime = hours * 3600 + minutes * 60 + seconds;
            const progress = Math.min(currentTime / totalDuration, 1);
            onProgress(progress);
          }
        }
      });

      ffmpeg.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`FFmpeg failed: ${stderr}`));
          return;
        }

        resolve(outputPlaylist);
      });

      ffmpeg.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Create HLS master playlist
   */
  private async createMasterPlaylist(hlsDir: string, qualities: string[]): Promise<string> {
    const masterPlaylistPath = path.join(hlsDir, 'master.m3u8');

    let content = '#EXTM3U\n';
    content += '#EXT-X-VERSION:3\n\n';

    for (const quality of qualities) {
      const profile = QUALITY_PROFILES[quality];
      const [width, height] = profile.resolution.split('x');
      const bandwidth = parseInt(profile.videoBitrate) * 1000 + parseInt(profile.audioBitrate) * 1000;

      content += `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${width}x${height},NAME="${quality}"\n`;
      content += `${quality}.m3u8\n\n`;
    }

    await fs.writeFile(masterPlaylistPath, content, 'utf-8');

    return masterPlaylistPath;
  }

  /**
   * Upload directory to S3
   */
  private async uploadDirectoryToS3(localDir: string, s3BasePath: string): Promise<void> {
    const files = await fs.readdir(localDir);

    await Promise.all(
      files.map(async (file) => {
        const localPath = path.join(localDir, file);
        const s3Key = `${s3BasePath}/${file}`;

        const stats = await fs.stat(localPath);
        if (stats.isFile()) {
          const fileContent = await fs.readFile(localPath);

          const contentType = file.endsWith('.m3u8')
            ? 'application/vnd.apple.mpegurl'
            : file.endsWith('.ts')
              ? 'video/MP2T'
              : 'application/octet-stream';

          const command = new PutObjectCommand({
            Bucket: this.bucket,
            Key: s3Key,
            Body: fileContent,
            ContentType: contentType,
            CacheControl: 'max-age=31536000', // 1 year for segments
          });

          await this.s3Client.send(command);
          this.logger.log(`Uploaded ${s3Key} to S3`);
        }
      }),
    );
  }

  /**
   * Update content or episode status
   */
  private async updateEntityStatus(
    type: 'content' | 'episode',
    entityId: string,
    status: VideoProcessingStatus,
    additionalFields: Partial<Content | Episode> = {},
  ): Promise<void> {
    if (type === 'content') {
      await this.contentRepository.update(entityId, {
        processing_status: status,
        ...additionalFields,
      });
    } else {
      await this.episodeRepository.update(entityId, {
        processing_status: status,
        ...additionalFields,
      });
    }
  }

  /**
   * Cleanup temporary files
   */
  private async cleanup(workDir: string): Promise<void> {
    try {
      await fs.rm(workDir, { recursive: true, force: true });
      this.logger.log(`Cleaned up work directory: ${workDir}`);
    } catch (error) {
      this.logger.error(`Failed to cleanup work directory: ${error.message}`);
    }
  }
}
