import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../users/entities/user.entity';
import {
  MultipartUploadService,
  InitMultipartUploadDto,
  CompleteMultipartUploadDto,
} from '../services/multipart-upload.service';

@ApiTags('Admin / Video Upload')
@Controller('admin/uploads')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class VideoUploadController {
  private readonly logger = new Logger(VideoUploadController.name);

  constructor(
    private readonly multipartUploadService: MultipartUploadService,
  ) {}

  @Post('init')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Initialize multipart upload',
    description:
      'Creates S3 multipart upload and returns presigned URLs for each part',
  })
  @ApiResponse({
    status: 200,
    description: 'Multipart upload initialized successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  async initUpload(@Body() dto: InitMultipartUploadDto) {
    this.logger.log(
      `Initializing upload for file: ${dto.filename} (${dto.size} bytes)`,
    );

    try {
      const result = await this.multipartUploadService.initMultipartUpload(dto);
      return {
        success: true,
        ...result,
      };
    } catch (error) {
      this.logger.error(`Failed to initialize upload: ${error.message}`);
      throw error;
    }
  }

  @Post('complete')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Complete multipart upload',
    description:
      'Completes S3 multipart upload and triggers transcode job',
  })
  @ApiResponse({
    status: 200,
    description: 'Upload completed successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  async completeUpload(@Body() dto: CompleteMultipartUploadDto) {
    this.logger.log(`Completing upload: ${dto.uploadId}`);

    try {
      const result =
        await this.multipartUploadService.completeMultipartUpload(dto);
      return {
        success: true,
        message: 'Upload completed. Transcoding will begin shortly.',
        ...result,
      };
    } catch (error) {
      this.logger.error(`Failed to complete upload: ${error.message}`);
      throw error;
    }
  }

  @Post('abort')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Abort multipart upload',
    description: 'Aborts an in-progress multipart upload',
  })
  @ApiResponse({
    status: 200,
    description: 'Upload aborted successfully',
  })
  async abortUpload(
    @Body() dto: { uploadId: string; key: string },
  ) {
    this.logger.log(`Aborting upload: ${dto.uploadId}`);

    try {
      const result = await this.multipartUploadService.abortMultipartUpload(
        dto.uploadId,
        dto.key,
      );
      return {
        success: true,
        message: 'Upload aborted successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to abort upload: ${error.message}`);
      throw error;
    }
  }

  @Get('status/:uploadId')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get upload status',
    description: 'Returns current status and progress of multipart upload',
  })
  @ApiResponse({
    status: 200,
    description: 'Upload status retrieved successfully',
  })
  async getUploadStatus(@Param('uploadId') uploadId: string) {
    try {
      const status =
        await this.multipartUploadService.getUploadStatus(uploadId);
      return {
        success: true,
        ...status,
      };
    } catch (error) {
      this.logger.error(`Failed to get upload status: ${error.message}`);
      throw error;
    }
  }
}
