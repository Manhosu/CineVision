import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { VideoUploadService, MultipartUploadResponse, CompleteUploadRequest } from './video-upload.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

export class InitiateUploadDto {
  fileName: string;
  contentType: string;
  fileSize: number;
  chunkSize?: number;
}

export class CompleteUploadDto {
  uploadId: string;
  key: string;
  parts: Array<{
    ETag: string;
    PartNumber: number;
  }>;
}

export class GeneratePresignedUrlDto {
  fileName: string;
  contentType: string;
}

@ApiTags('Video Upload')
@Controller('api/video-upload')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class VideoUploadController {
  constructor(private readonly videoUploadService: VideoUploadService) {}

  @Post('initiate-multipart')
  @ApiOperation({ summary: 'Initiate multipart upload for large video files' })
  @ApiResponse({
    status: 200,
    description: 'Multipart upload initiated successfully',
    schema: {
      type: 'object',
      properties: {
        uploadId: { type: 'string' },
        key: { type: 'string' },
        presignedUrls: { type: 'array', items: { type: 'string' } },
      },
    },
  })
  async initiateMultipartUpload(
    @Body() dto: InitiateUploadDto,
  ): Promise<MultipartUploadResponse> {
    try {
      return await this.videoUploadService.initiateMultipartUpload(
        dto.fileName,
        dto.contentType,
        dto.fileSize,
        dto.chunkSize,
      );
    } catch (error) {
      throw new HttpException(
        `Failed to initiate multipart upload: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('complete-multipart')
  @ApiOperation({ summary: 'Complete multipart upload' })
  @ApiResponse({
    status: 200,
    description: 'Multipart upload completed successfully',
    schema: {
      type: 'object',
      properties: {
        location: { type: 'string' },
        message: { type: 'string' },
      },
    },
  })
  async completeMultipartUpload(@Body() dto: CompleteUploadDto): Promise<{
    location: string;
    message: string;
  }> {
    try {
      const location = await this.videoUploadService.completeMultipartUpload(dto);
      return {
        location,
        message: 'Upload completed successfully',
      };
    } catch (error) {
      throw new HttpException(
        `Failed to complete multipart upload: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('abort-multipart')
  @ApiOperation({ summary: 'Abort multipart upload' })
  @ApiResponse({
    status: 200,
    description: 'Multipart upload aborted successfully',
  })
  async abortMultipartUpload(@Body() body: { uploadId: string; key: string }): Promise<{
    message: string;
  }> {
    try {
      await this.videoUploadService.abortMultipartUpload(body.uploadId, body.key);
      return { message: 'Upload aborted successfully' };
    } catch (error) {
      throw new HttpException(
        `Failed to abort multipart upload: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('presigned-url')
  @ApiOperation({ summary: 'Generate presigned URL for direct upload (small files)' })
  @ApiResponse({
    status: 200,
    description: 'Presigned URL generated successfully',
    schema: {
      type: 'object',
      properties: {
        presignedUrl: { type: 'string' },
        message: { type: 'string' },
      },
    },
  })
  async generatePresignedUrl(@Body() dto: GeneratePresignedUrlDto): Promise<{
    presignedUrl: string;
    message: string;
  }> {
    try {
      const presignedUrl = await this.videoUploadService.generatePresignedUploadUrl(
        dto.fileName,
        dto.contentType,
      );
      return {
        presignedUrl,
        message: 'Presigned URL generated successfully',
      };
    } catch (error) {
      throw new HttpException(
        `Failed to generate presigned URL: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('signed-url/:videoKey')
  @ApiOperation({ summary: 'Generate CloudFront signed URL for video streaming' })
  @ApiResponse({
    status: 200,
    description: 'Signed streaming URL generated successfully',
    schema: {
      type: 'object',
      properties: {
        streamingUrl: { type: 'string' },
        expiresInMinutes: { type: 'number' },
        message: { type: 'string' },
      },
    },
  })
  async generateSignedStreamingUrl(
    @Param('videoKey') videoKey: string,
    @Query('expiresInMinutes') expiresInMinutes?: number,
  ): Promise<{
    streamingUrl: string;
    expiresInMinutes: number;
    message: string;
  }> {
    try {
      const expires = expiresInMinutes ? parseInt(expiresInMinutes.toString()) : 60;
      const streamingUrl = await this.videoUploadService.generateSignedUrl(videoKey, expires);
      
      return {
        streamingUrl,
        expiresInMinutes: expires,
        message: 'Signed streaming URL generated successfully',
      };
    } catch (error) {
      throw new HttpException(
        `Failed to generate signed streaming URL: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('streaming-info/:videoKey')
  @ApiOperation({ summary: 'Get video streaming information' })
  @ApiResponse({
    status: 200,
    description: 'Video streaming information retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        streamingUrl: { type: 'string' },
        metadata: { type: 'object' },
        message: { type: 'string' },
      },
    },
  })
  async getVideoStreamingInfo(@Param('videoKey') videoKey: string): Promise<{
    streamingUrl: string;
    metadata: any;
    message: string;
  }> {
    try {
      const info = await this.videoUploadService.getVideoStreamingInfo(videoKey);
      
      return {
        ...info,
        message: 'Video streaming information retrieved successfully',
      };
    } catch (error) {
      throw new HttpException(
        `Failed to get video streaming info: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('cleanup-incomplete')
  @ApiOperation({ summary: 'Clean up incomplete multipart uploads older than specified hours' })
  @ApiResponse({
    status: 200,
    description: 'Cleanup completed successfully',
    schema: {
      type: 'object',
      properties: {
        cleanedUploads: { type: 'number' },
        message: { type: 'string' },
      },
    },
  })
  async cleanupIncompleteUploads(
    @Body() body: { olderThanHours?: number },
  ): Promise<{
    cleanedUploads: number;
    message: string;
  }> {
    try {
      const cleanedUploads = await this.videoUploadService.cleanupIncompleteUploads(
        body.olderThanHours || 24,
      );
      
      return {
        cleanedUploads,
        message: `Cleaned up ${cleanedUploads} incomplete uploads`,
      };
    } catch (error) {
      throw new HttpException(
        `Failed to cleanup incomplete uploads: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Get upload statistics' })
  @ApiResponse({
    status: 200,
    description: 'Upload statistics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        totalUploads: { type: 'number' },
        incompleteUploads: { type: 'number' },
        totalSize: { type: 'number' },
        message: { type: 'string' },
      },
    },
  })
  async getUploadStatistics(): Promise<{
    totalUploads: number;
    incompleteUploads: number;
    totalSize: number;
    message: string;
  }> {
    try {
      const stats = await this.videoUploadService.getUploadStatistics();
      
      return {
        ...stats,
        message: 'Upload statistics retrieved successfully',
      };
    } catch (error) {
      throw new HttpException(
        `Failed to get upload statistics: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}