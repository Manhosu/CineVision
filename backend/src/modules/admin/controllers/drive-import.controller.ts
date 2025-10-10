import {
  Controller,
  Post,
  Body,
  UseGuards,
  BadRequestException,
  Logger,
  Sse,
  MessageEvent,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../users/entities/user.entity';
import { DriveToS3Service, DriveImportProgress } from '../services/drive-to-s3.service';
import { ContentLanguageService } from '../../content/services/content-language.service';
import { Observable } from 'rxjs';

export class ImportFromDriveDto {
  drive_url: string;
  content_id: string;
  audio_type: string; // 'dublado', 'legendado', 'original'
  language?: string; // Default: 'pt-BR'
  quality?: string;   // Default: '1080p'
}

@ApiTags('Admin / Drive Import')
@Controller('admin/drive-import')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class DriveImportController {
  private readonly logger = new Logger(DriveImportController.name);

  // Armazenamento em memória para progresso dos uploads
  private uploadProgress = new Map<string, DriveImportProgress>();

  constructor(
    private readonly driveToS3Service: DriveToS3Service,
    private readonly contentLanguageService: ContentLanguageService,
  ) {}

  @Post('import')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Importar vídeo do Google Drive para S3',
    description: 'Faz streaming direto do Google Drive para AWS S3 e salva no banco de dados',
  })
  @ApiResponse({ status: 200, description: 'Import iniciado com sucesso' })
  @ApiResponse({ status: 400, description: 'URL do Drive inválida' })
  async importVideo(@Body() importDto: ImportFromDriveDto) {
    this.logger.log(`Iniciando import do Drive para content_id: ${importDto.content_id}`);

    const {
      drive_url,
      content_id,
      audio_type,
      language = 'pt-BR',
      quality = '1080p',
    } = importDto;

    if (!drive_url || !drive_url.includes('drive.google.com')) {
      throw new BadRequestException('URL do Google Drive inválida');
    }

    if (!content_id) {
      throw new BadRequestException('content_id é obrigatório');
    }

    if (!['dublado', 'legendado', 'original'].includes(audio_type)) {
      throw new BadRequestException('audio_type deve ser: dublado, legendado ou original');
    }

    try {
      // Gerar ID único para este upload
      const uploadId = `${content_id}-${audio_type}-${Date.now()}`;

      // Inicializar progresso
      this.uploadProgress.set(uploadId, {
        stage: 'validating',
        progress: 0,
        message: 'Iniciando...',
      });

      // Callback para atualizar progresso
      const onProgress = (progress: DriveImportProgress) => {
        this.uploadProgress.set(uploadId, progress);
        this.logger.log(`[${uploadId}] ${progress.stage} - ${progress.progress}%: ${progress.message}`);
      };

      // Iniciar import em background
      this.driveToS3Service
        .importFromDriveToS3(drive_url, content_id, audio_type, onProgress)
        .then(async (result) => {
          // Salvar no banco de dados
          try {
            // Verificar se já existe language para este content
            const existingLanguages = await this.contentLanguageService.findByContentId(content_id);

            const existingLanguage = existingLanguages.find(
              (lang) => lang.audio_type === audio_type && lang.language === language
            );

            if (existingLanguage) {
              // Atualizar existente
              await this.contentLanguageService.update(existingLanguage.id, {
                video_url: result.s3Url,
                video_storage_key: result.s3Key,
                file_size_bytes: result.fileSize,
                quality,
                status: 'ready',
              });

              this.logger.log(`Language atualizado: ${existingLanguage.id}`);
            } else {
              // Criar novo
              await this.contentLanguageService.create({
                content_id,
                language_type: audio_type as any,
                language_code: language as any,
                language_name: this.getLanguageName(language),
                video_url: result.s3Url,
                video_storage_key: result.s3Key,
                file_size_bytes: result.fileSize,
                audio_type,
                language,
                is_primary: audio_type === 'dublado',
                quality,
                status: 'ready',
              } as any);

              this.logger.log(`Novo language criado para content_id: ${content_id}`);
            }

            onProgress({
              stage: 'completed',
              progress: 100,
              message: 'Import concluído e salvo no banco de dados!',
              s3Url: result.s3Url,
              fileSize: result.fileSize,
            });

          } catch (dbError) {
            this.logger.error(`Erro ao salvar no banco: ${dbError.message}`);

            onProgress({
              stage: 'failed',
              progress: 100,
              message: 'Upload concluído, mas falha ao salvar no banco',
              error: dbError.message,
              s3Url: result.s3Url,
            });
          }
        })
        .catch((error) => {
          this.logger.error(`Erro no import: ${error.message}`, error.stack);

          onProgress({
            stage: 'failed',
            progress: 0,
            message: 'Falha no import',
            error: error.message,
          });
        });

      return {
        success: true,
        uploadId,
        message: 'Import iniciado. Use /admin/drive-import/progress/:uploadId para acompanhar.',
      };

    } catch (error) {
      this.logger.error(`Erro ao iniciar import: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Post('progress/:uploadId')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Consultar progresso do import' })
  async getProgress(@Param('uploadId') uploadId: string) {
    const progress = this.uploadProgress.get(uploadId);

    if (!progress) {
      throw new BadRequestException('Upload ID não encontrado');
    }

    return progress;
  }

  @Sse('progress/:uploadId/stream')
  @ApiOperation({ summary: 'Stream de progresso via Server-Sent Events' })
  progressStream(@Param('uploadId') uploadId: string): Observable<MessageEvent> {
    return new Observable((observer) => {
      const interval = setInterval(() => {
        const progress = this.uploadProgress.get(uploadId);

        if (progress) {
          observer.next({ data: progress } as MessageEvent);

          // Parar quando concluído ou falhou
          if (progress.stage === 'completed' || progress.stage === 'failed') {
            clearInterval(interval);
            observer.complete();

            // Limpar após 5 minutos
            setTimeout(() => {
              this.uploadProgress.delete(uploadId);
            }, 5 * 60 * 1000);
          }
        }
      }, 1000); // Atualizar a cada 1 segundo

      return () => clearInterval(interval);
    });
  }

  private getLanguageName(code: string): string {
    const languages: Record<string, string> = {
      'pt-BR': 'Português (Brasil)',
      'en-US': 'English (US)',
      'es': 'Español',
      'fr': 'Français',
      'de': 'Deutsch',
      'it': 'Italiano',
      'ja': '日本語',
      'ko': '한국어',
      'zh': '中文',
    };

    return languages[code] || code;
  }
}
