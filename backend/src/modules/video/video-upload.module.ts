import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { VideoUploadController } from './video-upload.controller';
import { VideoUploadService } from './video-upload.service';

@Module({
  imports: [ConfigModule],
  controllers: [VideoUploadController],
  providers: [VideoUploadService],
  exports: [VideoUploadService],
})
export class VideoUploadModule {}