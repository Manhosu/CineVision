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
    return this.adminContentService.createContent(dto, null);
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
    return this.adminContentService.initiateUpload(dto, null);
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
    return this.adminContentService.completeUpload(dto, null);
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
      null,
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
    return this.adminContentService.createSeries(dto, null);
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
      null, // Pass null instead of invalid user ID
    );
  }

  @Put('series/:seriesId/episodes/:episodeId')
  @ApiOperation({
    summary: 'Update episode',
    description: 'Updates episode metadata, video URL, or processing status',
  })
  @ApiResponse({
    status: 200,
    description: 'Episode updated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Episode not found',
  })
  @HttpCode(HttpStatus.OK)
  async updateEpisode(
    @Param('seriesId') seriesId: string,
    @Param('episodeId') episodeId: string,
    @Body() updateData: any,
    // @GetUser() user: User, // Temporarily disabled
  ) {
    return this.adminContentService.updateEpisode(seriesId, episodeId, updateData, null);
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
    return this.adminContentService.deleteContent(contentId, null);
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Update content metadata',
    description: 'Updates content information (title, description, etc.)',
  })
  @ApiResponse({
    status: 200,
    description: 'Content updated successfully',
  })
  @HttpCode(HttpStatus.OK)
  async updateContent(
    @Param('id') contentId: string,
    @Body() updateData: any,
  ) {
    return this.adminContentService.updateContent(contentId, updateData);
  }

  // Audio/Language Management Endpoints

  @Get(':id/audio-tracks')
  @ApiOperation({
    summary: 'Get all audio tracks for content',
    description: 'Retrieves all audio/language versions for a movie or series',
  })
  @ApiResponse({
    status: 200,
    description: 'Audio tracks retrieved successfully',
  })
  async getAudioTracks(@Param('id') contentId: string) {
    return this.adminContentService.getAudioTracks(contentId);
  }

  @Post(':id/audio-tracks')
  @ApiOperation({
    summary: 'Add new audio track to content',
    description: 'Adds a new dubbed or subtitled version',
  })
  @ApiResponse({
    status: 201,
    description: 'Audio track added successfully',
  })
  async addAudioTrack(
    @Param('id') contentId: string,
    @Body() audioData: any,
  ) {
    return this.adminContentService.addAudioTrack(contentId, audioData);
  }

  @Delete(':id/audio-tracks/:audioId')
  @ApiOperation({
    summary: 'Delete audio track',
    description: 'Removes audio track from content and deletes from S3',
  })
  @ApiResponse({
    status: 200,
    description: 'Audio track deleted successfully',
  })
  @HttpCode(HttpStatus.OK)
  async deleteAudioTrack(
    @Param('id') contentId: string,
    @Param('audioId') audioId: string,
  ) {
    return this.adminContentService.deleteAudioTrack(contentId, audioId);
  }
}
