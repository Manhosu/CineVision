const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs').promises;
const path = require('path');

class TranscodingService {
  constructor(config, logger, s3Service) {
    this.config = config;
    this.logger = logger;
    this.s3Service = s3Service;
    this.workDir = config.workDir;

    // Set FFmpeg thread count
    if (config.ffmpegThreads > 0) {
      ffmpeg.setFfmpegPath('ffmpeg');
      ffmpeg.setFfprobePath('ffprobe');
    }
  }

  /**
   * Analyze input video file
   */
  async analyzeVideo(inputPath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (err, metadata) => {
        if (err) {
          reject(new Error(`Video analysis failed: ${err.message}`));
          return;
        }

        const videoStream = metadata.streams.find(s => s.codec_type === 'video');
        const audioStream = metadata.streams.find(s => s.codec_type === 'audio');

        if (!videoStream) {
          reject(new Error('No video stream found'));
          return;
        }

        resolve({
          duration: metadata.format.duration,
          fileSize: metadata.format.size,
          bitrate: metadata.format.bit_rate,
          width: videoStream.width,
          height: videoStream.height,
          codec: videoStream.codec_name,
          frameRate: eval(videoStream.r_frame_rate || '0'),
          videoBitrate: videoStream.bit_rate,
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
   * Transcode video to specific quality
   */
  async transcodeQuality(inputPath, quality, preset, contentId, progressCallback) {
    const outputDir = path.join(this.workDir, contentId, quality);
    await fs.mkdir(outputDir, { recursive: true });

    const playlistPath = path.join(outputDir, 'playlist.m3u8');
    const segmentPattern = path.join(outputDir, 'segment_%03d.ts');

    this.logger.info({
      quality,
      preset,
      outputDir,
      inputPath
    }, 'Starting FFmpeg transcoding');

    return new Promise((resolve, reject) => {
      const command = ffmpeg(inputPath)
        .videoCodec('libx264')
        .audioCodec('aac')
        .size(`${preset.width}x${preset.height}`)
        .videoBitrate(preset.bitrate)
        .audioBitrate(preset.audioBitrate)
        .addOptions([
          '-crf', preset.crf.toString(),
          '-preset', preset.preset,
          '-g', '48', // GOP size (keyframe interval)
          '-keyint_min', '48',
          '-sc_threshold', '0',
          '-force_key_frames', 'expr:gte(t,n_forced*2)',
          '-hls_time', this.config.segmentDuration.toString(),
          '-hls_playlist_type', 'vod',
          '-hls_segment_filename', segmentPattern,
          '-hls_base_url', `${quality}/`,
          '-f', 'hls',
        ]);

      // Add threading if configured
      if (this.config.ffmpegThreads > 0) {
        command.addOptions(['-threads', this.config.ffmpegThreads.toString()]);
      }

      // Progress tracking
      command.on('progress', (progress) => {
        const percent = Math.round(progress.percent || 0);
        if (progressCallback) {
          progressCallback(percent);
        }
        this.logger.debug({ quality, contentId, percent }, 'Transcoding progress');
      });

      // Success handler
      command.on('end', () => {
        this.logger.info({ quality, contentId }, 'Transcoding completed');
        resolve(outputDir);
      });

      // Error handler
      command.on('error', (err) => {
        this.logger.error({ quality, contentId, error: err.message }, 'Transcoding failed');
        reject(new Error(`FFmpeg transcoding failed: ${err.message}`));
      });

      // Start transcoding
      command.save(playlistPath);
    });
  }

  /**
   * Generate master playlist for all qualities
   */
  async generateMasterPlaylist(contentId, qualities, presets) {
    const playlistPath = path.join(this.workDir, contentId, 'master.m3u8');

    let content = '#EXTM3U\n#EXT-X-VERSION:3\n\n';

    // Sort qualities by bitrate (highest first)
    const sortedQualities = qualities.sort((a, b) => presets[b].bitrate - presets[a].bitrate);

    for (const quality of sortedQualities) {
      const preset = presets[quality];
      const bandwidth = preset.bitrate * 1000; // Convert to bits per second

      content += `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${preset.width}x${preset.height},CODECS=\"avc1.640028,mp4a.40.2\"\n`;
      content += `${quality}/playlist.m3u8\n\n`;
    }

    await fs.writeFile(playlistPath, content);

    this.logger.info({ contentId, qualities: sortedQualities }, 'Master playlist generated');
    return playlistPath;
  }

  /**
   * Get transcoding statistics
   */
  async getStats(contentId) {
    const workDirPath = path.join(this.workDir, contentId);

    try {
      const stats = await fs.stat(workDirPath);
      const files = await fs.readdir(workDirPath, { recursive: true });

      return {
        contentId,
        workDir: workDirPath,
        created: stats.birthtime,
        modified: stats.mtime,
        totalFiles: files.length,
        files: files.filter(f => f.endsWith('.m3u8') || f.endsWith('.ts')),
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Cleanup temporary files for content
   */
  async cleanup(contentId) {
    const workDirPath = path.join(this.workDir, contentId);

    try {
      await fs.rm(workDirPath, { recursive: true, force: true });
      this.logger.info({ contentId }, 'Cleanup completed');
    } catch (error) {
      this.logger.warn({ contentId, error: error.message }, 'Cleanup failed');
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    return new Promise((resolve) => {
      // Test FFmpeg availability
      ffmpeg.ffprobe('-version', (err, data) => {
        if (err) {
          resolve({
            status: 'unhealthy',
            error: err.message,
            timestamp: new Date(),
          });
        } else {
          resolve({
            status: 'healthy',
            ffmpegVersion: data,
            workDir: this.workDir,
            timestamp: new Date(),
          });
        }
      });
    });
  }

  /**
   * Get processing capacity info
   */
  getCapacityInfo() {
    return {
      maxConcurrency: this.config.concurrency,
      ffmpegThreads: this.config.ffmpegThreads,
      segmentDuration: this.config.segmentDuration,
      workDir: this.workDir,
    };
  }
}

module.exports = TranscodingService;