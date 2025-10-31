import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as ffmpeg from 'fluent-ffmpeg';
import * as ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import * as fs from 'fs';
import * as path from 'path';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import { EventEmitter } from 'events';

// Configurar caminho do FFmpeg
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

export interface ConversionProgress {
  stage: 'downloading' | 'converting' | 'uploading' | 'completed' | 'failed';
  progress: number;
  message: string;
  currentTime?: string;
  totalDuration?: string;
  fps?: number;
  speed?: string;
  outputUrl?: string;
  error?: string;
}

export interface ConversionOptions {
  format: 'mp4' | 'hls';
  quality?: 'low' | 'medium' | 'high' | 'ultra';
  deleteOriginal?: boolean;
}

@Injectable()
export class VideoConversionService extends EventEmitter {
  private readonly logger = new Logger(VideoConversionService.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly tempDir: string;

  constructor(private configService: ConfigService) {
    super();

    // Configurar S3
    this.s3Client = new S3Client({
      region: this.configService.get('AWS_REGION') || 'us-east-1',
      credentials: {
        accessKeyId: this.configService.get('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.get('AWS_SECRET_ACCESS_KEY'),
      },
    });

    this.bucketName = this.configService.get('S3_VIDEO_BUCKET') || this.configService.get('AWS_S3_BUCKET') || 'cinevision-video';

    // Diretório temporário para conversões
    this.tempDir = path.join(process.cwd(), 'temp', 'conversions');

    // Criar diretório temp se não existir
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }

    this.logger.log('VideoConversionService initialized');
    this.logger.log(`FFmpeg path: ${ffmpegInstaller.path}`);
    this.logger.log(`Temp directory: ${this.tempDir}`);
  }

  /**
   * Verifica se o arquivo precisa de conversão
   */
  needsConversion(filename: string): boolean {
    const ext = path.extname(filename).toLowerCase();
    const incompatibleFormats = ['.mkv', '.avi', '.flv', '.wmv', '.mov', '.webm'];
    return incompatibleFormats.includes(ext);
  }

  /**
   * Detecta o formato do arquivo
   */
  getFileFormat(filename: string): string {
    return path.extname(filename).toLowerCase().replace('.', '');
  }

  /**
   * Converte vídeo de S3 para formato web-compatível
   */
  async convertVideo(
    s3Key: string,
    outputFormat: 'mp4' | 'hls' = 'mp4',
    onProgress?: (progress: ConversionProgress) => void
  ): Promise<{ outputUrl: string; outputKey: string }> {

    const emitProgress = (progress: ConversionProgress) => {
      this.emit('progress', progress);
      if (onProgress) onProgress(progress);
    };

    const jobId = Date.now().toString();
    const inputFilename = path.basename(s3Key);
    const inputPath = path.join(this.tempDir, `${jobId}-input-${inputFilename}`);
    const outputFilename = this.generateOutputFilename(inputFilename, outputFormat);
    const outputPath = path.join(this.tempDir, `${jobId}-output-${outputFilename}`);

    try {
      // 1. Download do S3
      emitProgress({
        stage: 'downloading',
        progress: 5,
        message: 'Baixando vídeo original do S3...',
      });

      await this.downloadFromS3(s3Key, inputPath, (downloadProgress) => {
        emitProgress({
          stage: 'downloading',
          progress: 5 + (downloadProgress * 0.15), // 5% a 20%
          message: `Baixando vídeo... ${downloadProgress.toFixed(0)}%`,
        });
      });

      this.logger.log(`Download concluído: ${inputPath}`);

      // 2. Obter informações do vídeo
      const videoInfo = await this.getVideoInfo(inputPath);
      this.logger.log(`Video info: ${JSON.stringify(videoInfo)}`);

      // 3. Conversão
      emitProgress({
        stage: 'converting',
        progress: 20,
        message: 'Iniciando conversão...',
      });

      if (outputFormat === 'mp4') {
        await this.convertToMP4(inputPath, outputPath, videoInfo, (convProgress) => {
          emitProgress({
            stage: 'converting',
            progress: 20 + (convProgress.percent * 0.6), // 20% a 80%
            message: `Convertendo para MP4... ${convProgress.percent.toFixed(0)}%`,
            currentTime: convProgress.currentTime,
            totalDuration: videoInfo.duration,
            fps: convProgress.fps,
            speed: convProgress.speed,
          });
        });
      } else {
        await this.convertToHLS(inputPath, outputPath, videoInfo, (convProgress) => {
          emitProgress({
            stage: 'converting',
            progress: 20 + (convProgress.percent * 0.6),
            message: `Convertendo para HLS... ${convProgress.percent.toFixed(0)}%`,
            currentTime: convProgress.currentTime,
            totalDuration: videoInfo.duration,
          });
        });
      }

      this.logger.log(`Conversão concluída: ${outputPath}`);

      // 4. Upload para S3
      emitProgress({
        stage: 'uploading',
        progress: 85,
        message: 'Enviando vídeo convertido para S3...',
      });

      const outputKey = this.generateS3Key(s3Key, outputFormat);
      await this.uploadToS3(outputPath, outputKey, (uploadProgress) => {
        emitProgress({
          stage: 'uploading',
          progress: 85 + (uploadProgress * 0.10), // 85% a 95%
          message: `Enviando para S3... ${uploadProgress.toFixed(0)}%`,
        });
      });

      const outputUrl = `https://${this.bucketName}.s3.${this.configService.get('AWS_REGION') || 'us-east-1'}.amazonaws.com/${outputKey}`;

      this.logger.log(`Upload concluído: ${outputUrl}`);

      // 5. Limpeza
      emitProgress({
        stage: 'uploading',
        progress: 95,
        message: 'Limpando arquivos temporários...',
      });

      await this.cleanup([inputPath, outputPath]);

      emitProgress({
        stage: 'completed',
        progress: 100,
        message: 'Conversão concluída com sucesso!',
        outputUrl,
      });

      return { outputUrl, outputKey };

    } catch (error) {
      this.logger.error(`Erro na conversão: ${error.message}`, error.stack);

      // Limpeza em caso de erro
      await this.cleanup([inputPath, outputPath]);

      emitProgress({
        stage: 'failed',
        progress: 0,
        message: 'Falha na conversão',
        error: error.message,
      });

      throw error;
    }
  }

  /**
   * Download do S3 para arquivo local
   */
  private async downloadFromS3(
    s3Key: string,
    localPath: string,
    onProgress?: (progress: number) => void
  ): Promise<void> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: s3Key,
    });

    const response = await this.s3Client.send(command);
    const stream = response.Body as Readable;
    const writeStream = fs.createWriteStream(localPath);

    const totalSize = response.ContentLength || 0;
    let downloadedSize = 0;

    stream.on('data', (chunk) => {
      downloadedSize += chunk.length;
      if (onProgress && totalSize > 0) {
        onProgress((downloadedSize / totalSize) * 100);
      }
    });

    return new Promise((resolve, reject) => {
      stream.pipe(writeStream);
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
      stream.on('error', reject);
    });
  }

  /**
   * Upload para S3
   */
  private async uploadToS3(
    localPath: string,
    s3Key: string,
    onProgress?: (progress: number) => void
  ): Promise<void> {
    const fileBuffer = fs.readFileSync(localPath);
    const stats = fs.statSync(localPath);

    // Para arquivos grandes, deveria usar multipart upload
    // Mas por simplicidade, vamos usar upload simples
    await this.s3Client.send(new PutObjectCommand({
      Bucket: this.bucketName,
      Key: s3Key,
      Body: fileBuffer,
      ContentType: 'video/mp4',
    }));

    if (onProgress) onProgress(100);
  }

  /**
   * Obter informações do vídeo
   */
  private async getVideoInfo(inputPath: string): Promise<any> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (err, metadata) => {
        if (err) {
          reject(err);
        } else {
          const videoStream = metadata.streams.find(s => s.codec_type === 'video');
          resolve({
            duration: metadata.format.duration,
            width: videoStream?.width,
            height: videoStream?.height,
            bitrate: metadata.format.bit_rate,
            codec: videoStream?.codec_name,
          });
        }
      });
    });
  }

  /**
   * Converter para MP4 (H.264 + AAC)
   */
  private async convertToMP4(
    inputPath: string,
    outputPath: string,
    videoInfo: any,
    onProgress?: (progress: { percent: number; currentTime: string; fps: number; speed: string }) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const command = ffmpeg(inputPath)
        .videoCodec('libx264')
        .audioCodec('aac')
        .outputOptions([
          '-preset fast',        // Conversão mais rápida
          '-crf 23',            // Qualidade (18-28, menor = melhor)
          '-movflags +faststart', // Otimizar para streaming
          '-pix_fmt yuv420p',   // Compatibilidade
          '-b:a 128k',          // Bitrate de áudio
        ])
        .output(outputPath);

      command.on('progress', (progress) => {
        if (onProgress) {
          onProgress({
            percent: progress.percent || 0,
            currentTime: progress.timemark,
            fps: progress.currentFps,
            speed: `${progress.currentKbps}kbps`,
          });
        }
      });

      command.on('end', () => {
        this.logger.log('Conversão MP4 concluída');
        resolve();
      });

      command.on('error', (err) => {
        this.logger.error(`Erro na conversão MP4: ${err.message}`);
        reject(err);
      });

      command.run();
    });
  }

  /**
   * Converter para HLS (streaming adaptativo)
   */
  private async convertToHLS(
    inputPath: string,
    outputPath: string,
    videoInfo: any,
    onProgress?: (progress: { percent: number; currentTime: string }) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const command = ffmpeg(inputPath)
        .outputOptions([
          '-codec: copy',       // Copiar codec (mais rápido)
          '-start_number 0',
          '-hls_time 10',       // Segmentos de 10 segundos
          '-hls_list_size 0',
          '-f hls',
        ])
        .output(outputPath);

      command.on('progress', (progress) => {
        if (onProgress) {
          onProgress({
            percent: progress.percent || 0,
            currentTime: progress.timemark,
          });
        }
      });

      command.on('end', () => {
        this.logger.log('Conversão HLS concluída');
        resolve();
      });

      command.on('error', (err) => {
        this.logger.error(`Erro na conversão HLS: ${err.message}`);
        reject(err);
      });

      command.run();
    });
  }

  /**
   * Gerar nome do arquivo de saída
   */
  private generateOutputFilename(inputFilename: string, format: string): string {
    const nameWithoutExt = path.parse(inputFilename).name;
    return format === 'hls' ? `${nameWithoutExt}.m3u8` : `${nameWithoutExt}.mp4`;
  }

  /**
   * Gerar chave S3 para o arquivo convertido
   */
  private generateS3Key(originalKey: string, format: string): string {
    // De: movies/content-id/raw/video.mkv
    // Para: movies/content-id/converted/video.mp4
    const parts = originalKey.split('/');
    const filename = parts[parts.length - 1];
    const nameWithoutExt = path.parse(filename).name;

    parts[parts.length - 2] = 'converted';
    parts[parts.length - 1] = format === 'hls' ? `${nameWithoutExt}.m3u8` : `${nameWithoutExt}.mp4`;

    return parts.join('/');
  }

  /**
   * Limpar arquivos temporários
   */
  private async cleanup(files: string[]): Promise<void> {
    for (const file of files) {
      try {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
          this.logger.log(`Arquivo removido: ${file}`);
        }
      } catch (error) {
        this.logger.warn(`Falha ao remover arquivo ${file}: ${error.message}`);
      }
    }
  }

  /**
   * Verificar se o FFmpeg está disponível
   */
  async checkFFmpegAvailability(): Promise<boolean> {
    try {
      return new Promise((resolve) => {
        ffmpeg.getAvailableFormats((err, formats) => {
          if (err) {
            this.logger.error('FFmpeg não está disponível', err);
            resolve(false);
          } else {
            this.logger.log('FFmpeg está disponível');
            resolve(true);
          }
        });
      });
    } catch (error) {
      this.logger.error('Erro ao verificar FFmpeg', error);
      return false;
    }
  }
}
