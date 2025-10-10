import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import { S3Client, PutObjectCommand, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import { EventEmitter } from 'events';

export interface DriveImportProgress {
  stage: 'validating' | 'downloading' | 'uploading' | 'completed' | 'failed';
  progress: number;
  message: string;
  fileSize?: number;
  downloaded?: number;
  uploaded?: number;
  s3Url?: string;
  error?: string;
}

@Injectable()
export class DriveToS3Service extends EventEmitter {
  private readonly logger = new Logger(DriveToS3Service.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly drive: any;

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
    this.bucketName = this.configService.get('AWS_S3_BUCKET') || 'cinevision-filmes';

    // Configurar Google Drive API
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: this.configService.get('GOOGLE_CLIENT_EMAIL'),
        private_key: this.configService.get('GOOGLE_PRIVATE_KEY')?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });

    this.drive = google.drive({ version: 'v3', auth });
  }

  /**
   * Extrai o file ID de um link do Google Drive
   */
  extractFileId(driveUrl: string): string {
    this.logger.log(`Extraindo file ID de: ${driveUrl}`);

    // Padrões de URL do Google Drive:
    // https://drive.google.com/file/d/FILE_ID/view
    // https://drive.google.com/open?id=FILE_ID
    // https://drive.google.com/uc?id=FILE_ID

    let fileId: string | null = null;

    // Tentar extrair via /file/d/
    const fileIdMatch = driveUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (fileIdMatch) {
      fileId = fileIdMatch[1];
    }

    // Tentar extrair via ?id=
    if (!fileId) {
      const idParamMatch = driveUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (idParamMatch) {
        fileId = idParamMatch[1];
      }
    }

    // Se ainda não encontrou, pode ser que seja apenas o ID
    if (!fileId && /^[a-zA-Z0-9_-]+$/.test(driveUrl)) {
      fileId = driveUrl;
    }

    if (!fileId) {
      throw new BadRequestException('URL do Google Drive inválida. Use um link compartilhável válido.');
    }

    this.logger.log(`File ID extraído: ${fileId}`);
    return fileId;
  }

  /**
   * Obtém informações do arquivo no Google Drive
   */
  async getFileMetadata(fileId: string) {
    try {
      const response = await this.drive.files.get({
        fileId,
        fields: 'id,name,mimeType,size,createdTime,modifiedTime',
      });

      return response.data;
    } catch (error) {
      this.logger.error(`Erro ao obter metadata do arquivo: ${error.message}`);
      throw new BadRequestException(
        'Não foi possível acessar o arquivo. Verifique se o link está compartilhado publicamente ou com a conta de serviço.'
      );
    }
  }

  /**
   * Faz o streaming direto do Google Drive para S3
   */
  async importFromDriveToS3(
    driveUrl: string,
    contentId: string,
    audioType: string = 'original',
    onProgress?: (progress: DriveImportProgress) => void
  ): Promise<{ s3Url: string; s3Key: string; fileSize: number }> {

    const emitProgress = (progress: DriveImportProgress) => {
      this.emit('progress', progress);
      if (onProgress) onProgress(progress);
    };

    try {
      // 1. Validar e extrair file ID
      emitProgress({
        stage: 'validating',
        progress: 5,
        message: 'Validando link do Google Drive...',
      });

      const fileId = this.extractFileId(driveUrl);

      // 2. Obter metadata do arquivo
      emitProgress({
        stage: 'validating',
        progress: 10,
        message: 'Obtendo informações do arquivo...',
      });

      const metadata = await this.getFileMetadata(fileId);
      const fileSize = parseInt(metadata.size);
      const fileName = metadata.name;

      this.logger.log(`Arquivo: ${fileName} (${fileSize} bytes)`);

      // 3. Validar tipo de arquivo
      if (!metadata.mimeType?.includes('video')) {
        throw new BadRequestException('O arquivo não é um vídeo válido.');
      }

      // 4. Gerar chave S3
      const sanitizedFilename = fileName
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9.-]/g, '');

      const s3Key = `movies/${contentId}/${audioType}/${Date.now()}-${sanitizedFilename}`;

      // 5. Decidir entre upload simples ou multipart
      const useMultipart = fileSize > 100 * 1024 * 1024; // > 100MB

      if (useMultipart) {
        return await this.streamDriveToS3Multipart(fileId, s3Key, fileSize, emitProgress);
      } else {
        return await this.streamDriveToS3Simple(fileId, s3Key, fileSize, emitProgress);
      }

    } catch (error) {
      this.logger.error(`Erro no import Drive → S3: ${error.message}`, error.stack);

      emitProgress({
        stage: 'failed',
        progress: 0,
        message: 'Falha no upload',
        error: error.message,
      });

      throw error;
    }
  }

  /**
   * Upload simples para arquivos < 100MB
   */
  private async streamDriveToS3Simple(
    fileId: string,
    s3Key: string,
    fileSize: number,
    emitProgress: (progress: DriveImportProgress) => void
  ): Promise<{ s3Url: string; s3Key: string; fileSize: number }> {

    emitProgress({
      stage: 'downloading',
      progress: 20,
      message: 'Baixando arquivo do Google Drive...',
      fileSize,
    });

    // Obter stream do Drive
    const response = await this.drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'stream' }
    );

    const driveStream = response.data as Readable;
    let downloadedBytes = 0;

    // Monitorar progresso do download
    driveStream.on('data', (chunk) => {
      downloadedBytes += chunk.length;
      const downloadProgress = 20 + Math.floor((downloadedBytes / fileSize) * 30);

      emitProgress({
        stage: 'downloading',
        progress: downloadProgress,
        message: 'Baixando do Google Drive...',
        fileSize,
        downloaded: downloadedBytes,
      });
    });

    // Buffer para acumular o stream
    const chunks: Buffer[] = [];

    await new Promise((resolve, reject) => {
      driveStream.on('data', (chunk) => chunks.push(chunk));
      driveStream.on('end', resolve);
      driveStream.on('error', reject);
    });

    const fileBuffer = Buffer.concat(chunks);

    emitProgress({
      stage: 'uploading',
      progress: 60,
      message: 'Enviando para AWS S3...',
      fileSize,
    });

    // Upload para S3
    await this.s3Client.send(new PutObjectCommand({
      Bucket: this.bucketName,
      Key: s3Key,
      Body: fileBuffer,
      ContentType: 'video/mp4',
    }));

    const s3Url = `https://${this.bucketName}.s3.${this.configService.get('AWS_REGION') || 'us-east-1'}.amazonaws.com/${s3Key}`;

    emitProgress({
      stage: 'completed',
      progress: 100,
      message: 'Upload concluído com sucesso!',
      fileSize,
      s3Url,
    });

    this.logger.log(`Upload concluído: ${s3Url}`);

    return { s3Url, s3Key, fileSize };
  }

  /**
   * Upload multipart para arquivos > 100MB
   */
  private async streamDriveToS3Multipart(
    fileId: string,
    s3Key: string,
    fileSize: number,
    emitProgress: (progress: DriveImportProgress) => void
  ): Promise<{ s3Url: string; s3Key: string; fileSize: number }> {

    const chunkSize = 10 * 1024 * 1024; // 10MB por parte
    const totalParts = Math.ceil(fileSize / chunkSize);

    this.logger.log(`Iniciando upload multipart: ${totalParts} partes`);

    emitProgress({
      stage: 'downloading',
      progress: 10,
      message: `Preparando upload multipart (${totalParts} partes)...`,
      fileSize,
    });

    // Iniciar multipart upload
    const multipartUpload = await this.s3Client.send(new CreateMultipartUploadCommand({
      Bucket: this.bucketName,
      Key: s3Key,
      ContentType: 'video/mp4',
    }));

    const uploadId = multipartUpload.UploadId!;
    const uploadedParts: Array<{ ETag: string; PartNumber: number }> = [];

    try {
      // Obter stream do Drive
      const response = await this.drive.files.get(
        { fileId, alt: 'media' },
        { responseType: 'stream' }
      );

      const driveStream = response.data as Readable;

      let partNumber = 1;
      let buffer: Buffer = Buffer.alloc(0);
      let totalUploaded = 0;

      for await (const chunk of driveStream) {
        buffer = Buffer.concat([buffer, chunk]);

        // Quando o buffer atingir o tamanho da parte (ou for a última parte)
        if (buffer.length >= chunkSize || totalUploaded + buffer.length >= fileSize) {
          const partData = buffer.slice(0, chunkSize);
          buffer = buffer.slice(chunkSize);

          emitProgress({
            stage: 'uploading',
            progress: 10 + Math.floor((partNumber / totalParts) * 85),
            message: `Enviando parte ${partNumber} de ${totalParts}...`,
            fileSize,
            uploaded: totalUploaded,
          });

          // Upload da parte
          const uploadPartResponse = await this.s3Client.send(new UploadPartCommand({
            Bucket: this.bucketName,
            Key: s3Key,
            PartNumber: partNumber,
            UploadId: uploadId,
            Body: partData,
          }));

          uploadedParts.push({
            ETag: uploadPartResponse.ETag!,
            PartNumber: partNumber,
          });

          totalUploaded += partData.length;
          partNumber++;
        }
      }

      // Upload do buffer restante (última parte)
      if (buffer.length > 0) {
        const uploadPartResponse = await this.s3Client.send(new UploadPartCommand({
          Bucket: this.bucketName,
          Key: s3Key,
          PartNumber: partNumber,
          UploadId: uploadId,
          Body: buffer,
        }));

        uploadedParts.push({
          ETag: uploadPartResponse.ETag!,
          PartNumber: partNumber,
        });
      }

      // Completar multipart upload
      emitProgress({
        stage: 'uploading',
        progress: 95,
        message: 'Finalizando upload...',
        fileSize,
      });

      await this.s3Client.send(new CompleteMultipartUploadCommand({
        Bucket: this.bucketName,
        Key: s3Key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: uploadedParts.sort((a, b) => a.PartNumber - b.PartNumber),
        },
      }));

      const s3Url = `https://${this.bucketName}.s3.${this.configService.get('AWS_REGION') || 'us-east-1'}.amazonaws.com/${s3Key}`;

      emitProgress({
        stage: 'completed',
        progress: 100,
        message: 'Upload concluído com sucesso!',
        fileSize,
        s3Url,
      });

      this.logger.log(`Upload multipart concluído: ${s3Url}`);

      return { s3Url, s3Key, fileSize };

    } catch (error) {
      this.logger.error(`Erro no upload multipart: ${error.message}`);

      // Abortar upload em caso de erro
      // await this.s3Client.send(new AbortMultipartUploadCommand({
      //   Bucket: this.bucketName,
      //   Key: s3Key,
      //   UploadId: uploadId,
      // }));

      throw error;
    }
  }
}
