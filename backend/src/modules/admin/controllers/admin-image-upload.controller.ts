import {
  Controller,
  Post,
  Body,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../users/entities/user.entity';
import { ImageUploadService, ImageUploadResult, PresignedImageUploadUrl } from '../services/image-upload.service';

class PresignedImageUploadDto {
  fileName: string;
  contentType: string;
  imageType: 'poster' | 'cover' | 'backdrop';
  contentId?: string;
}

@ApiTags('Admin - Image Upload')
@Controller('admin/api/images')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminImageUploadController {
  constructor(private readonly imageUploadService: ImageUploadService) {}

  @Post('upload')
  @ApiOperation({ 
    summary: 'Upload image file directly',
    description: 'Upload poster, cover, or backdrop image directly to S3'
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        imageType: {
          type: 'string',
          enum: ['poster', 'cover', 'backdrop'],
        },
        contentId: {
          type: 'string',
          description: 'Optional content ID to associate with the image',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Image uploaded successfully',
    schema: {
      type: 'object',
      properties: {
        key: { type: 'string' },
        url: { type: 'string' },
        publicUrl: { type: 'string' },
        fileSize: { type: 'number' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @Body('imageType') imageType: 'poster' | 'cover' | 'backdrop',
    @Body('contentId') contentId?: string,
  ): Promise<ImageUploadResult> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    if (!imageType) {
      throw new BadRequestException('imageType is required');
    }

    try {
      return await this.imageUploadService.uploadImage({
        file,
        imageType,
        contentId,
      });
    } catch (error) {
      throw new BadRequestException(`Upload failed: ${error.message}`);
    }
  }

  @Post('presigned-url')
  @ApiOperation({
    summary: 'Generate presigned URL for image upload',
    description: 'Generate a presigned URL for direct S3 upload of images'
  })
  @ApiResponse({
    status: 201,
    description: 'Presigned URL generated successfully',
    schema: {
      type: 'object',
      properties: {
        uploadUrl: { type: 'string' },
        key: { type: 'string' },
        publicUrl: { type: 'string' },
        expiresIn: { type: 'number' },
      },
    },
  })
  async generatePresignedUrl(
    @Body() dto: PresignedImageUploadDto,
  ): Promise<PresignedImageUploadUrl> {
    const { fileName, contentType, imageType, contentId } = dto;

    if (!fileName || !contentType || !imageType) {
      throw new BadRequestException('fileName, contentType, and imageType are required');
    }

    try {
      return await this.imageUploadService.generatePresignedImageUploadUrl(
        fileName,
        contentType,
        imageType,
        contentId,
      );
    } catch (error) {
      throw new BadRequestException(`Failed to generate presigned URL: ${error.message}`);
    }
  }
}