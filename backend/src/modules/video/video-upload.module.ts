import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { VideoUploadController } from './video-upload.controller';
import { VideoUploadService } from './video-upload.service';
import { VideoProcessorService } from './services/video-processor.service';
import { VideoConversionService } from './services/video-conversion.service';

@Module({
  imports: [ConfigModule],
  controllers: [VideoUploadController],
  providers: [
    VideoUploadService,
    VideoProcessorService,
    VideoConversionService,
  ],
  exports: [
    VideoUploadService,
    VideoProcessorService,
    VideoConversionService,
  ],
})
export class VideoUploadModule {}