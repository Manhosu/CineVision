import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { VideoUploadController } from './video-upload.controller';
import { VideoUploadService } from './video-upload.service';
import { VideoProcessorService } from './services/video-processor.service';
import { VideoConversionService } from './services/video-conversion.service';
import { VideoProcessorController } from './controllers/video-processor.controller';
import { VideoConversionLogsService } from './services/video-conversion-logs.service';

@Module({
  imports: [ConfigModule],
  controllers: [VideoUploadController, VideoProcessorController],
  providers: [
    VideoUploadService,
    VideoProcessorService,
    VideoConversionService,
    VideoConversionLogsService,
  ],
  exports: [
    VideoUploadService,
    VideoProcessorService,
    VideoConversionService,
    VideoConversionLogsService,
  ],
})
export class VideoUploadModule {}