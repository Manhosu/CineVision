import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { GetUser } from '../../auth/decorators/get-user.decorator';
import { User } from '../../users/entities/user.entity';
import { AdminContentSimpleService } from '../services/admin-content-simple.service';
import {
  CreateContentDto,
  InitiateUploadDto,
  CompleteUploadDto,
  PublishContentDto,
  CreateSeriesDto,
  CreateEpisodeDto,
} from '../dto/create-content.dto';

@ApiTags('Admin - Content Management')
@Controller('admin/content')
// @UseGuards(JwtAuthGuard) // Temporarily disabled for testing
@ApiBearerAuth()
export class AdminContentController {
  constructor(private readonly adminContentService: AdminContentSimpleService) {
    console.log('AdminContentController loaded successfully');
  }

  @Get()
  @ApiOperation({
    summary: 'Get all content',
    description: 'Retrieves all content for admin management',
  })
  @ApiResponse({
    status: 200,
    description: 'Content retrieved successfully',
  })
  async getAllContent() {
    return this.adminContentService.getAllContent();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get content by ID',
    description: 'Retrieves a single content item by its ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Content retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Content not found',
  })
  async getContentById(@Param('id') id: string) {
    return this.adminContentService.getContentById(id);
  }

  @Post('create')
  @ApiOperation({
    summary: 'Create new content (movie/series/documentary)',
    description: 'Creates content in database and automatically generates Stripe Product + Price',
  })
  @ApiResponse({
    status: 201,
    description: 'Content created successfully with Stripe integration',
  })
  @ApiResponse({ status: 400, description: 'Invalid input or Stripe error' })
  async createContent(
    @Body() dto: CreateContentDto,
    // @GetUser() user: User, // Temporarily disabled
  ) {
    return this.adminContentService.createContent(dto, 'test-user-id');
  }

  @Post('initiate-upload')
  @ApiOperation({
    summary: 'Initiate multipart upload for content video file',
    description: 'Generates presigned URLs for S3 multipart upload with validation',
  })
  @ApiResponse({
    status: 200,
    description: 'Upload initiated with presigned URLs for each part',
  })
  async initiateUpload(
    @Body() dto: InitiateUploadDto,
    // @GetUser() user: User, // Temporarily disabled
  ) {
    return this.adminContentService.initiateUpload(dto, 'test-user-id');
  }

  @Post('complete-upload')
  @ApiOperation({
    summary: 'Complete multipart upload and trigger transcoding',
    description: 'Finalizes S3 upload, validates parts, and queues content for HLS transcoding',
  })
  @ApiResponse({
    status: 200,
    description: 'Upload completed, transcoding initiated',
  })
  @HttpCode(HttpStatus.OK)
  async completeUpload(
    @Body() dto: CompleteUploadDto,
    // @GetUser() user: User, // Temporarily disabled
  ) {
    return this.adminContentService.completeUpload(dto, 'test-user-id');
  }

  @Get(':id/status')
  @ApiOperation({
    summary: 'Get content processing status',
    description: 'Returns upload/processing/transcoding status with progress',
  })
  @ApiResponse({
    status: 200,
    description: 'Content status retrieved',
  })
  async getContentStatus(@Param('id') contentId: string) {
    return this.adminContentService.getContentStatus(contentId);
  }

  @Put(':id/publish')
  @ApiOperation({
    summary: 'Publish content (make available to users)',
    description: 'Sets content status to PUBLISHED and optionally sends Telegram notifications',
  })
  @ApiResponse({
    status: 200,
    description: 'Content published successfully',
  })
  @HttpCode(HttpStatus.OK)
  async publishContent(
    @Param('id') contentId: string,
    @Body() dto: Omit<PublishContentDto, 'content_id'>,
    // @GetUser() user: User, // Temporarily disabled
  ) {
    return this.adminContentService.publishContent(
      { content_id: contentId, ...dto },
      'test-user-id',
    );
  }

  // Series Management Endpoints

  @Post('series/create')
  @ApiOperation({
    summary: 'Create new TV series',
    description: 'Creates series with optional per-series or per-episode pricing',
  })
  @ApiResponse({
    status: 201,
    description: 'Series created successfully',
  })
  async createSeries(
    @Body() dto: CreateSeriesDto,
    // @GetUser() user: User, // Temporarily disabled
  ) {
    return this.adminContentService.createSeries(dto, 'test-user-id');
  }

  @Post('series/:seriesId/episodes')
  @ApiOperation({
    summary: 'Add episode to series',
    description: 'Creates episode with optional individual Stripe product/price',
  })
  @ApiResponse({
    status: 201,
    description: 'Episode created successfully',
  })
  async createEpisode(
    @Param('seriesId') seriesId: string,
    @Body() dto: Omit<CreateEpisodeDto, 'series_id'>,
    // @GetUser() user: User, // Temporarily disabled
  ) {
    return this.adminContentService.createEpisode(
      { series_id: seriesId, ...dto },
      'test-user-id',
    );
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete content',
    description: 'Deletes content from database, S3, and Stripe. This action cannot be undone.',
  })
  @ApiResponse({
    status: 200,
    description: 'Content deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Content not found',
  })
  @HttpCode(HttpStatus.OK)
  async deleteContent(
    @Param('id') contentId: string,
    // @GetUser() user: User, // Temporarily disabled
  ) {
    return this.adminContentService.deleteContent(contentId, 'test-user-id');
  }
}
