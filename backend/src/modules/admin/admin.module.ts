import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminContentController } from './controllers/admin-content.controller';
import { AdminContentService } from './services/admin-content.service';
import { AdminContentSimpleService } from './services/admin-content-simple.service';
import { AdminStatsController } from './controllers/admin-stats.controller';
import { AdminStatsService } from './services/admin-stats.service';
import { AdminSettingsController } from './controllers/admin-settings.controller';
import { AdminSettingsService } from './services/admin-settings.service';
import { AdminSettingsSupabaseService } from './services/admin-settings-supabase.service';
import { AdminImageUploadController } from './controllers/admin-image-upload.controller';
import { ImageUploadService } from './services/image-upload.service';
import { AdminPurchasesController } from './controllers/admin-purchases.controller';
import { AdminPurchasesSimpleService } from './services/admin-purchases-simple.service';
import { AdminRequestsController } from './controllers/admin-requests.controller';
import { AdminRequestsPublicController } from './controllers/admin-requests-public.controller';
import { AdminUsersController } from './controllers/admin-users.controller';
import { UploadPresignedController } from './controllers/upload-presigned.controller';
// Removed DriveImportController - replaced with VideoUploadController
import { VideoUploadController } from './controllers/video-upload.controller';
import { BroadcastController } from './controllers/broadcast.controller';
import { MultipartUploadService } from './services/multipart-upload.service';
import { BroadcastService } from './services/broadcast.service';
import { SupabaseModule } from '../../config/supabase.module';
import { ContentLanguageService } from '../content/services/content-language.service';
import { ContentLanguageSupabaseService } from '../content/services/content-language-supabase.service';
import { ContentLanguage } from '../content/entities/content-language.entity';
import { AdminSettings } from './entities/admin-settings.entity';
import { Content } from '../content/entities/content.entity';
import { Series } from '../content/entities/series.entity';
import { Episode } from '../content/entities/episode.entity';
import { Category } from '../content/entities/category.entity';
import { User } from '../users/entities/user.entity';
import { Purchase } from '../purchases/entities/purchase.entity';
import { Payment } from '../payments/entities/payment.entity';
import { SystemLog } from '../logs/entities/system-log.entity';
import { StreamingAnalytics } from '../content/entities/streaming-analytics.entity';
import { ContentRequest } from '../requests/entities/content-request.entity';
import { StripeService } from '../payments/services/stripe.service';
import { VideoUploadService } from '../video/video-upload.service';
import { BotNotificationService } from '../telegrams/services/bot-notification.service';
import { TelegramsService } from '../telegrams/telegrams.service';
import { CDNService } from '../cdn/services/cdn.service';
import { QueueService } from '../queue/services/queue.service';
import { TranscodeService } from '../content/services/transcode.service';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { RequestsModule } from '../requests/requests.module';
import { optionalTypeOrmFeature, isTypeOrmEnabled } from '../../config/typeorm-optional.helper';

const conditionalControllers = isTypeOrmEnabled() ? [
  AdminController,
  AdminContentController,
  AdminStatsController,
  AdminSettingsController,
  AdminImageUploadController,
  AdminPurchasesController,
  AdminUsersController,
  AdminRequestsPublicController,
  // AdminRequestsController, // Temporarily disabled - requires RequestsModule
  UploadPresignedController,
  VideoUploadController, // Direct S3 multipart upload
  BroadcastController,
] : [
  AdminContentController,
  AdminStatsController,
  AdminSettingsController,
  AdminImageUploadController,
  AdminPurchasesController,
  AdminUsersController,
  AdminRequestsPublicController,
  // AdminRequestsController, // Temporarily disabled - requires RequestsModule
  UploadPresignedController,
  VideoUploadController, // Direct S3 multipart upload
  BroadcastController,
];

console.log('TypeORM enabled:', isTypeOrmEnabled());
console.log('Admin controllers:', conditionalControllers.map(c => c.name));

const conditionalProviders = isTypeOrmEnabled() ? [
  AdminService,
  AdminContentService,
  AdminStatsService,
  AdminSettingsService,
  StripeService,
  VideoUploadService,
  BotNotificationService,
  TelegramsService,
  CDNService,
  QueueService,
  TranscodeService,
  ImageUploadService,
  MultipartUploadService,
  ContentLanguageService,
  BroadcastService,
] : [
  AdminContentSimpleService,
  AdminStatsService,
  AdminSettingsSupabaseService,
  ImageUploadService,
  AdminPurchasesSimpleService,
  StripeService,
  MultipartUploadService,
  ContentLanguageSupabaseService,
  BroadcastService,
  { provide: ContentLanguageService, useClass: ContentLanguageSupabaseService },
  { provide: AdminSettingsService, useClass: AdminSettingsSupabaseService },
];

const conditionalExports = isTypeOrmEnabled() ? [
  AdminService,
  AdminContentService,
  AdminSettingsService,
  StripeService,
  MultipartUploadService,
] : [AdminContentSimpleService, AdminSettingsService, MultipartUploadService];

@Module({
  imports: [
    ...optionalTypeOrmFeature([
      Content,
      Series,
      Episode,
      Category,
      ContentLanguage,
      User,
      Purchase,
      Payment,
      SystemLog,
      StreamingAnalytics,
      ContentRequest,
      AdminSettings,
    ]),
    JwtModule.register({}),
    ConfigModule,
    SupabaseModule,
    // RequestsModule, // Temporarily disabled - causing startup issues
  ],
  controllers: conditionalControllers,
  providers: conditionalProviders,
  exports: conditionalExports,
})
export class AdminModule {}