import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ConfigService } from '@nestjs/config';

@ApiTags('admin/upload')
@Controller('admin/upload')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UploadPresignedController {
  private readonly s3Client: S3Client;
  private readonly bucketName: string;

  constructor(private configService: ConfigService) {
    this.s3Client = new S3Client({
      region: this.configService.get('AWS_REGION') || 'us-east-2',
      credentials: {
        accessKeyId: this.configService.get('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.get('AWS_SECRET_ACCESS_KEY'),
      },
    });
    this.bucketName = this.configService.get('S3_VIDEO_BUCKET') || 'cinevision-video';
  }

  @Post('presigned-url')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generate presigned URL for direct S3 upload',
    description: 'Generates a presigned URL that allows the frontend to upload files directly to S3 without going through the backend',
  })
  @ApiResponse({
    status: 200,
    description: 'Presigned URL generated successfully',
    schema: {
      type: 'object',
      properties: {
        uploadUrl: { type: 'string', description: 'Presigned URL for PUT request' },
        fileUrl: { type: 'string', description: 'Public URL of the file after upload' },
        key: { type: 'string', description: 'S3 object key' },
        expiresIn: { type: 'number', description: 'URL expiration time in seconds' },
      },
    },
  })
  async generatePresignedUrl(
    @Body() body: { filename: string; contentType: string; contentId?: string },
  ) {
    const { filename, contentType, contentId } = body;

    // Sanitize filename and create S3 key
    const sanitizedFilename = filename
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9.-]/g, '');

    const timestamp = Date.now();
    const key = contentId
      ? `videos/${contentId}/${timestamp}-${sanitizedFilename}`
      : `videos/${timestamp}-${sanitizedFilename}`;

    // Create the command for PUT operation
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: contentType,
    });

    // Generate presigned URL (valid for 1 hour)
    const expiresIn = 3600; // 1 hour
    const uploadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn,
    });

    // Construct the public URL (cinevision-video is in us-east-2)
    const fileUrl = `https://${this.bucketName}.s3.${this.configService.get('AWS_REGION') || 'us-east-2'}.amazonaws.com/${key}`;

    return {
      uploadUrl,
      fileUrl,
      key,
      expiresIn,
    };
  }

  @Post('presigned-url-multipart')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generate presigned URL for multipart upload',
    description: 'For very large files (>100MB), use multipart upload',
  })
  async generateMultipartPresignedUrl(
    @Body() body: { filename: string; contentType: string; fileSize: number; contentId?: string },
  ) {
    const { filename, contentType, fileSize, contentId } = body;

    // Sanitize filename
    const sanitizedFilename = filename
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9.-]/g, '');

    const timestamp = Date.now();
    const key = contentId
      ? `videos/${contentId}/${timestamp}-${sanitizedFilename}`
      : `videos/${timestamp}-${sanitizedFilename}`;

    // For files > 100MB, recommend multipart upload with 10MB chunks
    const chunkSize = 10 * 1024 * 1024; // 10MB
    const numberOfParts = Math.ceil(fileSize / chunkSize);

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: contentType,
    });

    const expiresIn = 3600; // 1 hour
    const uploadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn,
    });

    const fileUrl = `https://${this.bucketName}.s3.${this.configService.get('AWS_REGION') || 'us-east-2'}.amazonaws.com/${key}`;

    return {
      uploadUrl,
      fileUrl,
      key,
      expiresIn,
      multipart: {
        chunkSize,
        numberOfParts,
      },
    };
  }
}
