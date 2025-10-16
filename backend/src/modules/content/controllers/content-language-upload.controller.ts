import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  HttpCode,
  NotFoundException,
  BadRequestException,
  SetMetadata,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../users/entities/user.entity';
import { ContentLanguageService, CreateContentLanguageDto, UpdateContentLanguageDto } from '../services/content-language.service';
import { VideoUploadService } from '../../video/video-upload.service';
import { VideoProcessorService } from '../../video/services/video-processor.service';
import { LanguageType, LanguageCode } from '../entities/content-language.entity';
import { SupabaseService } from '../../../config/supabase.service';

export class CreateLanguageUploadDto {
  content_id: string;
  language_type: LanguageType;
  language_code: LanguageCode;
  language_name: string;
  is_default?: boolean;
}

export class InitiateLanguageUploadDto {
  content_language_id: string;
  file_name: string;
  file_size: number;
  content_type?: string; // Optional: 'video/mp4' or 'video/x-matroska'
}

export class InitiateUploadDto {
  fileName: string;
  fileSize: number;
  contentType?: string;
  chunkSize?: number;
}

export class CompleteUploadDto {
  upload_id: string;
  key: string;
  parts: Array<{
    ETag: string;
    PartNumber: number;
  }>;
}

export class CompleteLanguageUploadDto {
  content_language_id: string;
  upload_id: string;
  parts: Array<{
    ETag: string;
    PartNumber: number;
  }>;
}

export class GenerateLanguagePresignedUrlDto {
  content_language_id: string;
  part_number: number;
  upload_id: string;
}

@ApiTags('Content Language Upload')
@Controller('content-language-upload')
// @UseGuards(JwtAuthGuard, RolesGuard) // Temporarily disabled for direct upload
@ApiBearerAuth()
export class ContentLanguageUploadController {
  private readonly logger = new Logger(ContentLanguageUploadController.name);

  constructor(
    private readonly contentLanguageService: ContentLanguageService,
    private readonly videoUploadService: VideoUploadService,
    private readonly videoProcessorService: VideoProcessorService,
    private readonly supabaseService: SupabaseService,
  ) {}

  @Post('language')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Criar novo idioma para conteúdo' })
  @ApiResponse({ status: 201, description: 'Idioma criado com sucesso' })
  async createLanguage(@Body() createDto: CreateLanguageUploadDto) {
    return await this.contentLanguageService.create(createDto);
  }

  @Get('languages/:contentId')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Listar idiomas de um conteúdo (Admin)' })
  @ApiResponse({ status: 200, description: 'Lista de idiomas' })
  async getLanguages(@Param('contentId') contentId: string) {
    return await this.contentLanguageService.findByContentId(contentId);
  }

  @Get('public/languages/:contentId')
  @SetMetadata('isPublic', true)
  @ApiOperation({ summary: 'Listar idiomas disponíveis de um conteúdo (Público)' })
  @ApiResponse({ status: 200, description: 'Lista de idiomas ativos' })
  async getPublicLanguages(@Param('contentId') contentId: string) {
    return await this.contentLanguageService.findByContentId(contentId);
  }

  @Get('language-options')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Obter opções de idiomas disponíveis' })
  @ApiResponse({ status: 200, description: 'Opções de idiomas' })
  async getLanguageOptions() {
    return await this.contentLanguageService.getLanguageOptions();
  }

  @Post('initiate-multipart')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Iniciar upload multipart para idioma específico' })
  @ApiResponse({ status: 200, description: 'Upload iniciado com sucesso' })
  async initiateMultipartUpload(@Body() initiateDto: InitiateLanguageUploadDto) {
    // Buscar o idioma do conteúdo
    const contentLanguage = await this.contentLanguageService.findById(initiateDto.content_language_id);
    
    // Gerar chave de armazenamento única para este idioma
    const storageKey = `videos/${contentLanguage.content_id}/languages/${contentLanguage.language_type}-${contentLanguage.language_code}/${Date.now()}-${initiateDto.file_name}`;
    
    // Validar content type (MP4 ou MKV)
    const contentType = initiateDto.content_type || 'video/mp4';
    const allowedTypes = ['video/mp4', 'video/x-matroska'];

    if (!allowedTypes.includes(contentType)) {
      throw new BadRequestException(`Content type não suportado. Use 'video/mp4' ou 'video/x-matroska'`);
    }

    // Iniciar upload multipart usando o serviço existente
    const uploadResult = await this.videoUploadService.initiateMultipartUpload(
      storageKey,
      contentType,
      initiateDto.file_size,
      10 * 1024 * 1024 // 10MB chunks
    );

    // Atualizar o idioma com a chave de armazenamento
    await this.contentLanguageService.update(initiateDto.content_language_id, {
      video_storage_key: storageKey,
    });

    return {
      ...uploadResult,
      content_language_id: initiateDto.content_language_id,
      storage_key: storageKey,
    };
  }

  @Post('complete-multipart')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Completar upload multipart para idioma específico' })
  @ApiResponse({ status: 200, description: 'Upload completado com sucesso' })
  async completeMultipartUpload(@Body() completeDto: CompleteLanguageUploadDto) {
    // Buscar o idioma do conteúdo
    const contentLanguage = await this.contentLanguageService.findById(completeDto.content_language_id);

    if (!contentLanguage.video_storage_key) {
      throw new Error('Chave de armazenamento não encontrada para este idioma');
    }

    // Completar upload multipart usando o serviço existente
    const s3Url = await this.videoUploadService.completeMultipartUpload({
      uploadId: completeDto.upload_id,
      parts: completeDto.parts,
      key: contentLanguage.video_storage_key,
    });

    this.logger.log(`Upload completed for language ${completeDto.content_language_id}, starting auto-processing`);

    // Atualizar status para 'processing'
    await this.contentLanguageService.update(completeDto.content_language_id, {
      video_url: s3Url,
      upload_status: 'processing',
    });

    // **PROCESSAMENTO AUTOMÁTICO EM BACKGROUND**
    // Detecta formato e converte MKV → MP4, gera HLS se necessário
    this.processVideoInBackground(
      completeDto.content_language_id,
      contentLanguage.content_id,
      contentLanguage.video_storage_key,
      s3Url
    ).catch(error => {
      this.logger.error(`Background processing failed for ${completeDto.content_language_id}:`, error);
    });

    return {
      success: true,
      message: 'Upload completed. Video is being processed automatically.',
      data: {
        video_url: s3Url,
        processing_status: 'processing'
      },
      content_language_id: completeDto.content_language_id,
    };
  }

  /**
   * Processa vídeo em background após upload
   */
  private async processVideoInBackground(
    languageId: string,
    contentId: string,
    storageKey: string,
    s3Url: string
  ): Promise<void> {
    try {
      this.logger.log(`[Background] Starting video processing for language ${languageId}`);

      // Detectar formato do arquivo
      const fileExtension = storageKey.split('.').pop()?.toLowerCase();
      this.logger.log(`[Background] Detected format: ${fileExtension}`);

      // Se for MKV, precisa converter
      const needsConversion = ['mkv', 'avi', 'flv', 'wmv', 'mov'].includes(fileExtension || '');

      if (needsConversion) {
        this.logger.log(`[Background] Format requires conversion: ${fileExtension}`);

        // Chamar serviço de processamento
        const result = await this.videoProcessorService.processVideo({
          contentId: languageId, // Usar languageId como contentId único
          inputPath: s3Url,
          languageId: languageId,
          autoConvertToHLS: true, // Converter para HLS se > 500MB
        });

        if (result.success) {
          this.logger.log(`[Background] Processing completed successfully`);

          // Atualizar content_language com resultado
          const updateData: UpdateContentLanguageDto = {
            upload_status: 'completed',
          };

          if (result.hlsGenerated && result.hlsMasterUrl) {
            updateData.hls_master_url = result.hlsMasterUrl;
            updateData.video_url = result.hlsMasterUrl; // Usar HLS como URL principal
            this.logger.log(`[Background] HLS generated: ${result.hlsMasterUrl}`);
          } else if (result.videoUrl) {
            updateData.video_url = result.videoUrl;
            this.logger.log(`[Background] MP4 available: ${result.videoUrl}`);
          }

          await this.contentLanguageService.update(languageId, updateData);

          this.logger.log(`[Background] Language ${languageId} updated with processed video`);
        } else {
          throw new Error(result.error || 'Processing failed');
        }
      } else {
        // MP4 ou formato compatível - apenas marcar como ready
        this.logger.log(`[Background] Format is compatible (${fileExtension}), marking as ready`);

        await this.contentLanguageService.update(languageId, {
          upload_status: 'completed',
          video_url: s3Url,
        });
      }

      // ✅ AUTO-PUBLICAR CONTEÚDO APÓS PRIMEIRO VÍDEO COMPLETAR
      await this.autoPublishContentIfReady(contentId);

    } catch (error) {
      this.logger.error(`[Background] Processing failed for language ${languageId}:`, error);

      // Marcar como falho mas manter URL original
      await this.contentLanguageService.update(languageId, {
        upload_status: 'failed',
      });
    }
  }

  /**
   * Auto-publica conteúdo quando o primeiro vídeo for completado
   * Usado em uploads do /admin/content/manage
   */
  private async autoPublishContentIfReady(contentId: string): Promise<void> {
    try {
      // Buscar o status atual do conteúdo
      const { data: content, error: contentError } = await this.supabaseService.client
        .from('content')
        .select('id, title, status')
        .eq('id', contentId)
        .single();

      if (contentError || !content) {
        this.logger.warn(`[Auto-Publish] Content ${contentId} not found`);
        return;
      }

      // Se já está publicado, não fazer nada
      if (content.status === 'PUBLISHED') {
        this.logger.log(`[Auto-Publish] Content ${contentId} already published`);
        return;
      }

      // Verificar se há pelo menos um vídeo completado
      const { data: languages, error: languagesError } = await this.supabaseService.client
        .from('content_languages')
        .select('id, upload_status')
        .eq('content_id', contentId);

      if (languagesError) {
        this.logger.error(`[Auto-Publish] Error fetching languages:`, languagesError);
        return;
      }

      const completedCount = (languages || []).filter(l => l.upload_status === 'completed').length;

      if (completedCount > 0) {
        // Publicar automaticamente
        const { error: updateError } = await this.supabaseService.client
          .from('content')
          .update({
            status: 'PUBLISHED',
            updated_at: new Date().toISOString(),
          })
          .eq('id', contentId);

        if (updateError) {
          this.logger.error(`[Auto-Publish] Error publishing content:`, updateError);
        } else {
          this.logger.log(`✅ [Auto-Publish] Content "${content.title}" (${contentId}) auto-published after first video completion!`);
        }
      } else {
        this.logger.log(`[Auto-Publish] Content ${contentId} has no completed videos yet`);
      }
    } catch (error) {
      this.logger.error(`[Auto-Publish] Error:`, error);
    }
  }

  @Post('presigned-url')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Gerar URL pré-assinada para parte do upload' })
  @ApiResponse({ status: 200, description: 'URL gerada com sucesso' })
  async generatePresignedUrl(@Body() presignedDto: GenerateLanguagePresignedUrlDto) {
    // Buscar o idioma do conteúdo
    const contentLanguage = await this.contentLanguageService.findById(presignedDto.content_language_id);

    if (!contentLanguage.video_storage_key) {
      throw new Error('Chave de armazenamento não encontrada para este idioma');
    }

    // Gerar URL pré-assinada para upload da parte específica
    const url = await this.videoUploadService.generatePresignedPartUploadUrl(
      contentLanguage.video_storage_key,
      presignedDto.upload_id,
      presignedDto.part_number,
      3600, // 1 hora
    );

    return { url };
  }

  @Post('upload-part')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Upload de parte do vídeo via proxy do backend (evita CORS)' })
  @ApiResponse({ status: 200, description: 'Parte enviada com sucesso' })
  async uploadPart(
    @Body() body: {
      content_language_id: string;
      upload_id: string;
      part_number: number;
      chunk_data: string; // base64 encoded chunk
    }
  ) {
    // Buscar o idioma do conteúdo
    const contentLanguage = await this.contentLanguageService.findById(body.content_language_id);

    if (!contentLanguage.video_storage_key) {
      throw new Error('Chave de armazenamento não encontrada para este idioma');
    }

    // Decodificar o chunk de base64
    const chunkBuffer = Buffer.from(body.chunk_data, 'base64');

    // Fazer upload da parte usando o serviço
    const etag = await this.videoUploadService.uploadPart(
      contentLanguage.video_storage_key,
      body.upload_id,
      body.part_number,
      chunkBuffer,
    );

    return { ETag: etag, PartNumber: body.part_number };
  }

  @Put('language/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Atualizar idioma de conteúdo' })
  @ApiResponse({ status: 200, description: 'Idioma atualizado com sucesso' })
  async updateLanguage(@Param('id') id: string, @Body() updateDto: UpdateContentLanguageDto) {
    return await this.contentLanguageService.update(id, updateDto);
  }

  @Put('language/:id/set-default')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Definir idioma como padrão' })
  @ApiResponse({ status: 200, description: 'Idioma definido como padrão' })
  async setAsDefault(@Param('id') id: string) {
    return await this.contentLanguageService.setAsDefault(id);
  }

  @Delete('language/:id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deletar idioma de conteúdo' })
  @ApiResponse({ status: 204, description: 'Idioma deletado com sucesso' })
  async deleteLanguage(@Param('id') id: string) {
    await this.contentLanguageService.delete(id);
  }

  @Post('abort-multipart')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Abortar upload multipart' })
  @ApiResponse({ status: 200, description: 'Upload abortado com sucesso' })
  async abortMultipartUpload(
    @Body() body: { content_language_id: string; upload_id: string }
  ) {
    const contentLanguage = await this.contentLanguageService.findById(body.content_language_id);

    if (!contentLanguage.video_storage_key) {
      throw new BadRequestException('Chave de armazenamento não encontrada');
    }

    await this.videoUploadService.abortMultipartUpload(
      body.upload_id,
      contentLanguage.video_storage_key
    );

    return { message: 'Upload abortado com sucesso' };
  }

  @Get('public/video-url/:languageId')
  @ApiOperation({ summary: 'Get signed video URL for playback' })
  @ApiResponse({ status: 200, description: 'Signed video URL generated' })
  async getPublicVideoUrl(@Param('languageId') languageId: string) {
    const contentLanguage = await this.contentLanguageService.findById(languageId);

    if (!contentLanguage.video_storage_key) {
      throw new NotFoundException('Video not found for this language');
    }

    // Generate a signed URL valid for 240 minutes (4 hours)
    const signedUrl = await this.videoUploadService.generateSignedUrl(
      contentLanguage.video_storage_key,
      240,
    );

    return {
      url: signedUrl,
      expires_in: 14400,
      language_type: contentLanguage.language_type,
      language_code: contentLanguage.language_code,
    };
  }

  @Get('processing-status/:languageId')
  @ApiOperation({ summary: 'Get video processing status' })
  @ApiResponse({ status: 200, description: 'Processing status retrieved' })
  async getProcessingStatus(@Param('languageId') languageId: string) {
    const contentLanguage = await this.contentLanguageService.findById(languageId);

    return {
      language_id: languageId,
      content_id: contentLanguage.content_id,
      upload_status: contentLanguage.upload_status,
      video_url: contentLanguage.video_url,
      hls_master_url: contentLanguage.hls_master_url,
      is_hls: !!contentLanguage.hls_master_url,
      ready_for_playback: contentLanguage.upload_status === 'completed',
      language_type: contentLanguage.language_type,
      language_name: contentLanguage.language_name,
    };
  }
}