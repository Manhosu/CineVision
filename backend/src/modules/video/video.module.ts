import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { VideoIngestService } from './services/video-ingest.service';
import { VideoTranscodingService } from './services/video-transcoding.service';
import { VideoProcessorService } from './services/video-processor.service';
import { VideoConversionLogsService } from './services/video-conversion-logs.service';
import { VideoProcessorController } from './controllers/video-processor.controller';
import { Content } from '../content/entities/content.entity';
import { VideoVariant } from '../content/entities/video-variant.entity';
import { QueueModule } from '../queue/queue.module';
import { SupabaseModule } from '../../config/supabase.module';
import { optionalTypeOrmFeature, isTypeOrmEnabled } from '../../config/typeorm-optional.helper';

const conditionalProviders = isTypeOrmEnabled()
  ? [VideoIngestService, VideoTranscodingService, VideoProcessorService, VideoConversionLogsService]
  : [
      {
        provide: VideoIngestService,
        useValue: undefined,
      },
      {
        provide: VideoTranscodingService,
        useValue: undefined,
      },
      {
        provide: VideoProcessorService,
        useValue: undefined,
      },
      {
        provide: VideoConversionLogsService,
        useValue: undefined,
      },
    ];
const conditionalExports = isTypeOrmEnabled()
  ? [VideoIngestService, VideoTranscodingService, VideoProcessorService, VideoConversionLogsService]
  : [VideoIngestService, VideoTranscodingService, VideoProcessorService, VideoConversionLogsService];
const conditionalImports = isTypeOrmEnabled() ? [QueueModule, SupabaseModule] : [SupabaseModule];
const conditionalControllers = isTypeOrmEnabled() ? [VideoProcessorController] : [];

@Module({
  imports: [
    ...optionalTypeOrmFeature([Content, VideoVariant]),
    ConfigModule,
    ...conditionalImports,
  ],
  controllers: conditionalControllers,
  providers: conditionalProviders,
  exports: conditionalExports,
})
export class VideoModule {}