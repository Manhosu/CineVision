import { Controller, Get, Post, Delete, Body, Param, Query, UnauthorizedException, NotFoundException, UseGuards, Request, Optional, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { ContentService } from './content.service';
import { JwtService } from '@nestjs/jwt';
import { CDNService } from '../cdn/services/cdn.service';
import { VideoIngestService } from '../video/services/video-ingest.service';
import { VideoTranscodingService } from '../video/services/video-transcoding.service';
import { MultipartUploadService } from '../admin/services/multipart-upload.service';
import { OptionalAuthGuard } from '../auth/guards/optional-auth.guard';

@ApiTags('content')
@Controller('content')
export class ContentController {
  constructor(
    private readonly contentService: ContentService,
    private readonly jwtService: JwtService,
    @Optional() private readonly cdnService?: CDNService,
    @Optional() private readonly videoIngestService?: VideoIngestService,
    @Optional() private readonly videoTranscodingService?: VideoTranscodingService,
    @Optional() private readonly multipartUploadService?: MultipartUploadService,
  ) {}

  @Get('movies')
  @ApiOperation({ summary: 'Get all movies' })
  @ApiQuery({ name: 'page', description: 'Page number', required: false, type: Number })
  @ApiQuery({ name: 'limit', description: 'Items per page', required: false, type: Number })
  @ApiQuery({ name: 'genre', description: 'Filter by genre', required: false, type: String })
  @ApiQuery({ name: 'sort', description: 'Sort order', required: false, enum: ['newest', 'popular', 'rating', 'price_low', 'price_high'] })
  @ApiResponse({ status: 200, description: 'Movies retrieved successfully' })
  async getMovies(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('genre') genre?: string,
    @Query('sort') sort = 'newest',
  ) {
    return this.contentService.findAllMovies(Number(page), Number(limit), genre, sort);
  }

  @Get('series')
  @ApiOperation({ summary: 'Get all series' })
  @ApiQuery({ name: 'page', description: 'Page number', required: false, type: Number })
  @ApiQuery({ name: 'limit', description: 'Items per page', required: false, type: Number })
  @ApiQuery({ name: 'genre', description: 'Filter by genre', required: false, type: String })
  @ApiQuery({ name: 'sort', description: 'Sort order', required: false, enum: ['newest', 'popular', 'rating', 'price_low', 'price_high'] })
  @ApiResponse({ status: 200, description: 'Series retrieved successfully' })
  async getSeries(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('genre') genre?: string,
    @Query('sort') sort = 'newest',
  ) {
    return this.contentService.findAllSeries(Number(page), Number(limit), genre, sort);
  }

  @Get('movies/:id')
  @ApiOperation({ summary: 'Get movie by ID' })
  @ApiResponse({ status: 200, description: 'Movie retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Movie not found' })
  async getMovie(@Param('id') id: string) {
    return this.contentService.findMovieById(id);
  }

  @Get('series/:id')
  @ApiOperation({ summary: 'Get series by ID' })
  @ApiResponse({ status: 200, description: 'Series retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Series not found' })
  async getSeries(@Param('id') id: string) {
    return this.contentService.findSeriesById(id);
  }

  @Get('categories')
  @ApiOperation({ summary: 'Get all categories' })
  @ApiResponse({ status: 200, description: 'Categories retrieved successfully' })
  async getCategories() {
    return this.contentService.findAllCategories();
  }

  @Get('top10/films')
  @ApiOperation({ summary: 'Get Top 10 films of the week' })
  @ApiResponse({ status: 200, description: 'Top 10 films retrieved successfully' })
  async getTop10Films() {
    return this.contentService.findTop10Films();
  }

  @Get('top10/series')
  @ApiOperation({ summary: 'Get Top 10 series of the week' })
  @ApiResponse({ status: 200, description: 'Top 10 series retrieved successfully' })
  async getTop10Series() {
    return this.contentService.findTop10Series();
  }

  @Get('movies/related/:id')
  @ApiOperation({ summary: 'Get related movies' })
  @ApiParam({ name: 'id', description: 'Movie ID' })
  @ApiQuery({ name: 'genres', description: 'Comma-separated genres', required: false, type: String })
  @ApiQuery({ name: 'limit', description: 'Number of related movies', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Related movies retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Movie not found' })
  async getRelatedMovies(
    @Param('id') movieId: string,
    @Query('genres') genres?: string,
    @Query('limit') limit = 6,
  ) {
    const genreArray = genres ? genres.split(',').map(g => g.trim()) : [];
    return this.contentService.findRelatedMovies(movieId, genreArray, Number(limit));
  }

  @Get('series/:id/episodes')
  @ApiOperation({ summary: 'Get all episodes for a series' })
  @ApiParam({ name: 'id', description: 'Series ID' })
  @ApiQuery({ name: 'season', description: 'Filter by season number', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Episodes retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Series not found' })
  async getSeriesEpisodes(
    @Param('id') seriesId: string,
    @Query('season') season?: number,
  ) {
    return this.contentService.findSeriesEpisodes(seriesId, season ? Number(season) : undefined);
  }

  @Get(':id/stream')
  @UseGuards(OptionalAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get signed streaming URLs for content',
    description: 'Returns signed CDN URLs for HLS streaming with adaptive bitrate'
  })
  @ApiParam({ name: 'id', description: 'Content ID' })
  @ApiQuery({ name: 'quality', description: 'Specific quality variant', required: false })
  @ApiQuery({ name: 'expires_in', description: 'URL expiration time in seconds', required: false })
  @ApiResponse({ status: 200, description: 'Signed streaming URLs generated successfully' })
  @ApiResponse({ status: 401, description: 'Authentication required for paid content' })
  @ApiResponse({ status: 403, description: 'Access denied - no valid purchase found' })
  @ApiResponse({ status: 404, description: 'Content not found or not ready for streaming' })
  async getStreamingUrl(
    @Param('id') contentId: string,
    @Query('quality') quality?: string,
    @Query('expires_in') expiresIn?: number,
    @Request() req?: any,
  ) {
    if (!this.cdnService) {
      throw new NotFoundException('Streaming service not available');
    }

    const userId = req?.user?.sub;

    return this.cdnService.generateSignedStreamingUrl({
      contentId,
      userId,
      quality,
      expiresIn: expiresIn || 43200, // 12 hours default
      allowDownload: false,
    });
  }

  @Get(':id/stream/segment/:segment')
  @UseGuards(OptionalAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get signed URL for HLS segment',
    description: 'Returns signed CDN URL for specific HLS segment or playlist'
  })
  @ApiParam({ name: 'id', description: 'Content ID' })
  @ApiParam({ name: 'segment', description: 'Segment path (e.g., 720p/segment_001.ts)' })
  @ApiResponse({ status: 200, description: 'Signed segment URL generated successfully' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Content or segment not found' })
  async getSegmentUrl(
    @Param('id') contentId: string,
    @Param('segment') segmentPath: string,
    @Request() req?: any,
  ) {
    if (!this.cdnService) {
      throw new NotFoundException('Streaming service not available');
    }

    const userId = req?.user?.sub;

    const signedUrl = await this.cdnService.generateSignedSegmentUrl(
      contentId,
      segmentPath,
      userId,
      3600 // 1 hour for segments
    );

    return { segmentUrl: signedUrl };
  }

  @Get(':id/processing-status')
  @ApiOperation({
    summary: 'Get video processing status',
    description: 'Returns current transcoding progress and available qualities'
  })
  @ApiParam({ name: 'id', description: 'Content ID' })
  @ApiResponse({ status: 200, description: 'Processing status retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Content not found' })
  async getProcessingStatus(@Param('id') contentId: string) {
    if (!this.videoIngestService || !this.videoTranscodingService) {
      throw new NotFoundException('Video processing services not available');
    }

    const uploadStatus = await this.videoIngestService.getUploadStatus(contentId);
    const transcodingProgress = await this.videoTranscodingService.getTranscodingProgress(contentId);

    return {
      ...uploadStatus,
      transcoding: transcodingProgress,
    };
  }

  @Post(':id/invalidate-cache')
  @ApiOperation({
    summary: 'Invalidate CDN cache for content',
    description: 'Forces CDN cache refresh for updated content (admin only)'
  })
  @ApiParam({ name: 'id', description: 'Content ID' })
  @ApiResponse({ status: 200, description: 'Cache invalidation initiated' })
  @ApiResponse({ status: 404, description: 'Content not found' })
  async invalidateCache(
    @Param('id') contentId: string,
    @Body() body: { paths?: string[] } = {},
  ) {
    if (!this.cdnService) {
      throw new NotFoundException('CDN service not available');
    }

    await this.cdnService.invalidateContentCache(contentId, body.paths);
    return { message: 'Cache invalidation initiated successfully' };
  }

  @Get('stream/:id')
  @ApiOperation({
    summary: 'Legacy streaming endpoint',
    deprecated: true,
    description: 'Use GET /:id/stream instead'
  })
  @ApiQuery({ name: 'token', description: 'Access token for content streaming' })
  @ApiResponse({ status: 200, description: 'Content streaming authorized' })
  @ApiResponse({ status: 401, description: 'Invalid or expired token' })
  @ApiResponse({ status: 404, description: 'Content not found' })
  async streamContent(@Param('id') contentId: string, @Query('token') token: string) {
    if (!token) {
      throw new UnauthorizedException('Access token is required');
    }

    try {
      // Verify and decode the JWT token
      const payload = this.jwtService.verify(token);

      // Check if token is for the requested content
      if (payload.content_id !== contentId) {
        throw new UnauthorizedException('Token is not valid for this content');
      }

      // Check token type
      if (payload.type !== 'content_access') {
        throw new UnauthorizedException('Invalid token type');
      }

      // Return streaming authorization info (legacy format)
      return {
        authorized: true,
        content_id: contentId,
        user_id: payload.sub,
        purchase_id: payload.purchase_id,
        expires_at: new Date(payload.exp * 1000),
        streaming_url: `https://cdn.cinevision.com/stream/${contentId}`,
        message: 'Access granted for content streaming (legacy endpoint - use GET /:id/stream)'
      };

    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new UnauthorizedException('Access token has expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new UnauthorizedException('Invalid access token');
      }
      throw new UnauthorizedException('Token validation failed');
    }
  }

  @Delete('movies/all')
  @ApiOperation({ 
    summary: 'Delete all movies',
    description: 'Removes all movies from the database (admin only)'
  })
  @ApiResponse({ status: 200, description: 'All movies deleted successfully' })
  @ApiResponse({ status: 500, description: 'Error deleting movies' })
  async deleteAllMovies() {
    return this.contentService.deleteAllMovies();
  }

  @Delete('all')
  @ApiOperation({
    summary: 'Delete all content',
    description: 'Removes all content (movies, series, etc.) from the database (admin only)'
  })
  @ApiResponse({ status: 200, description: 'All content deleted successfully' })
  @ApiResponse({ status: 500, description: 'Error deleting content' })
  async deleteAllContent() {
    return this.contentService.deleteAllContent();
  }

  @Get('video-url/:key(*)')
  @ApiOperation({ summary: 'Generate presigned URL for video playback' })
  @ApiParam({ name: 'key', description: 'S3 storage key for the video file', type: String })
  @ApiResponse({ status: 200, description: 'Presigned URL generated successfully' })
  @ApiResponse({ status: 400, description: 'Failed to generate URL' })
  async getVideoUrl(@Param('key') key: string) {
    if (!this.multipartUploadService) {
      throw new NotFoundException('Video service not available');
    }
    const url = await this.multipartUploadService.generatePresignedUrl(key);
    return { url };
  }
}