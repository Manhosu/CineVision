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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../users/entities/user.entity';
import { ContentLanguageService, CreateContentLanguageDto, UpdateContentLanguageDto } from '../services/content-language.service';
import { VideoUploadService } from '../../video/video-upload.service';
import { LanguageType, LanguageCode } from '../entities/content-language.entity';

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
  constructor(
    private readonly contentLanguageService: ContentLanguageService,
    private readonly videoUploadService: VideoUploadService,
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
    const result = await this.videoUploadService.completeMultipartUpload({
      uploadId: completeDto.upload_id,
      parts: completeDto.parts,
      key: contentLanguage.video_storage_key,
    });

    // Atualizar o idioma com a URL do vídeo
    await this.contentLanguageService.update(completeDto.content_language_id, {
      video_url: result,
      upload_status: 'completed',
    });

    return {
      success: true,
      data: { video_url: result },
      content_language_id: completeDto.content_language_id,
    };
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
}