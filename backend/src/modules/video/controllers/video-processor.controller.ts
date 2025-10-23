import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  UseGuards,
  Logger,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { VideoProcessorService } from '../services/video-processor.service';
import { VideoConversionLogsService } from '../services/video-conversion-logs.service';
import {
  ProcessVideoDto,
  ProcessVideoResponseDto,
  VideoProcessingStatusDto,
} from '../dto/process-video.dto';

@Controller('api/v1/video-processor')
export class VideoProcessorController {
  private readonly logger = new Logger(VideoProcessorController.name);

  constructor(
    private readonly videoProcessorService: VideoProcessorService,
    private readonly videoConversionLogsService: VideoConversionLogsService,
  ) {}

  /**
   * Process video (convert MKV to MP4, or MP4 to HLS if large)
   */
  @Post('process')
  @UseGuards(JwtAuthGuard)
  async processVideo(
    @Body() dto: ProcessVideoDto,
  ): Promise<ProcessVideoResponseDto> {
    try {
      this.logger.log(`Processing video for content ${dto.contentId}`);

      const result = await this.videoProcessorService.processVideo({
        contentId: dto.contentId,
        inputPath: dto.inputPath,
        languageId: dto.languageId,
        languageType: dto.languageType,
        autoConvertToHLS: dto.autoConvertToHLS ?? true,
      });

      return {
        success: result.success,
        contentId: result.contentId,
        originalFormat: result.originalFormat,
        finalFormat: result.finalFormat,
        hlsGenerated: result.hlsGenerated,
        hlsMasterUrl: result.hlsMasterUrl,
        videoUrl: result.videoUrl,
        fileSize: result.fileSize,
        processingTime: result.processingTime,
        error: result.error,
      } as any;
    } catch (error) {
      this.logger.error(`Failed to process video: ${error.message}`, error.stack);
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get processing status for content
   */
  @Get('status/:contentId')
  @UseGuards(JwtAuthGuard)
  async getProcessingStatus(@Param('contentId') contentId: string) {
    try {
      const log = await this.videoConversionLogsService.getLogByContentId(contentId);

      if (!log) {
        return {
          contentId,
          status: 'not_found',
          message: 'No processing logs found for this content',
        };
      }

      return {
        contentId,
        status: log.status,
        progress: log.progress,
        conversionType: log.conversion_type,
        outputFormat: log.output_format,
        processingTime: log.processing_time_seconds,
        errorMessage: log.error_message,
        startedAt: log.started_at,
        completedAt: log.completed_at,
      };
    } catch (error) {
      this.logger.error(`Failed to get processing status: ${error.message}`);
      throw new HttpException(
        {
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
