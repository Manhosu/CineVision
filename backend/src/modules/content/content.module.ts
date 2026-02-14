import { Module, forwardRef } from '@nestjs/common';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';
import { ContentSupabaseService } from './services/content-supabase.service';
import { TranscodeService } from './services/transcode.service';
import { ContentLanguageService } from './services/content-language.service';
import { ContentLanguageSupabaseService } from './services/content-language-supabase.service';
import { Content } from './entities/content.entity';
import { ContentLanguage } from './entities/content-language.entity';
import { Category } from './entities/category.entity';
import { Series } from './entities/series.entity';
import { Episode } from './entities/episode.entity';
import { VideoVariant } from './entities/video-variant.entity';
import { StreamingAnalytics } from './entities/streaming-analytics.entity';
import { SystemLog } from '../logs/entities/system-log.entity';
import { SupabaseModule } from '../../config/supabase.module';
import { AuthModule } from '../auth/auth.module';
import { AdminModule } from '../admin/admin.module';
import { optionalTypeOrmFeature, isTypeOrmEnabled } from '../../config/typeorm-optional.helper';

console.log('TypeORM enabled:', isTypeOrmEnabled());
console.log('ENABLE_TYPEORM env var:', process.env.ENABLE_TYPEORM);

const conditionalControllers = [ContentController];
const conditionalProviders = isTypeOrmEnabled() 
  ? [ContentService, TranscodeService, ContentLanguageService]
  : [
      ContentSupabaseService,
      ContentLanguageSupabaseService,
      {
        provide: ContentService,
        useExisting: ContentSupabaseService,
      },
      {
        provide: ContentLanguageService,
        useExisting: ContentLanguageSupabaseService,
      },
    ];

const conditionalExports = isTypeOrmEnabled()
  ? [ContentService, TranscodeService, ContentLanguageService]
  : [ContentService, ContentLanguageService, ContentLanguageSupabaseService];

console.log('Content controllers:', conditionalControllers);
console.log('Content providers:', conditionalProviders);
console.log('Content exports:', conditionalExports);

@Module({
  imports: [
    ...optionalTypeOrmFeature([Content, ContentLanguage, Category, Series, Episode, VideoVariant, StreamingAnalytics, SystemLog]),
    SupabaseModule,
    forwardRef(() => AuthModule),
    forwardRef(() => AdminModule),
  ],
  controllers: conditionalControllers,
  providers: conditionalProviders,
  exports: conditionalExports,
})
export class ContentModule {}