import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { VideoIngestService } from './services/video-ingest.service';
import { VideoTranscodingService } from './services/video-transcoding.service';
import { Content } from '../content/entities/content.entity';
import { VideoVariant } from '../content/entities/video-variant.entity';
import { QueueModule } from '../queue/queue.module';
import { optionalTypeOrmFeature, isTypeOrmEnabled } from '../../config/typeorm-optional.helper';

const conditionalProviders = isTypeOrmEnabled() 
  ? [VideoIngestService, VideoTranscodingService] 
  : [
      {
        provide: VideoIngestService,
        useValue: undefined,
      },
      {
        provide: VideoTranscodingService,
        useValue: undefined,
      },
    ];
const conditionalExports = isTypeOrmEnabled() 
  ? [VideoIngestService, VideoTranscodingService] 
  : [VideoIngestService, VideoTranscodingService];
const conditionalImports = isTypeOrmEnabled() ? [QueueModule] : [];

@Module({
  imports: [
    ...optionalTypeOrmFeature([Content, VideoVariant]),
    ConfigModule,
    ...conditionalImports,
  ],
  providers: conditionalProviders,
  exports: conditionalExports,
})
export class VideoModule {}