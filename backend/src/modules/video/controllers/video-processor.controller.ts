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
        success: true,
        contentId: dto.contentId,
        outputFormat: result.outputFormat,
        outputPath: result.outputPath,
        hlsMasterUrl: result.hlsMasterUrl,
        qualitiesGenerated: result.qualitiesGenerated,
        processingTime: result.processingTime,
        message: result.message,
      };
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
  async getProcessingStatus(
    @Param('contentId') contentId: string,
  ): Promise<VideoProcessingStatusDto> {
    try {
      const logs = await this.videoConversionLogsService.getLogsByContentId(contentId);

      if (!logs || logs.length === 0) {
        return {
          contentId,
          status: 'not_found',
          message: 'No processing logs found for this content',
        };
      }

      // Get the most recent log
      const latestLog = logs[0];

      return {
        contentId,
        status: latestLog.status,
        progress: latestLog.progress,
        conversionType: latestLog.conversion_type,
        outputFormat: latestLog.output_format,
        outputPath: latestLog.output_hls_path,
        qualitiesGenerated: latestLog.qualities_generated,
        processingTime: latestLog.processing_time_seconds,
        errorMessage: latestLog.error_message,
        startedAt: latestLog.started_at,
        completedAt: latestLog.completed_at,
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

  /**
   * Get all conversion logs for content
   */
  @Get('logs/:contentId')
  @UseGuards(JwtAuthGuard)
  async getConversionLogs(@Param('contentId') contentId: string) {
    try {
      const logs = await this.videoConversionLogsService.getLogsByContentId(contentId);
      return {
        contentId,
        logs,
        totalCount: logs.length,
      };
    } catch (error) {
      this.logger.error(`Failed to get conversion logs: ${error.message}`);
      throw new HttpException(
        {
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get conversion statistics
   */
  @Get('stats')
  @UseGuards(JwtAuthGuard)
  async getConversionStats() {
    try {
      const stats = await this.videoConversionLogsService.getConversionStats();
      return stats;
    } catch (error) {
      this.logger.error(`Failed to get conversion stats: ${error.message}`);
      throw new HttpException(
        {
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
