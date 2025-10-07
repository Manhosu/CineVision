import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminContentController } from './controllers/admin-content.controller';
import { AdminContentService } from './services/admin-content.service';
import { AdminContentSimpleService } from './services/admin-content-simple.service';
import { AdminSettingsController } from './controllers/admin-settings.controller';
import { AdminSettingsService } from './services/admin-settings.service';
import { AdminImageUploadController } from './controllers/admin-image-upload.controller';
import { ImageUploadService } from './services/image-upload.service';
import { AdminPurchasesController } from './controllers/admin-purchases.controller';
import { AdminPurchasesSimpleService } from './services/admin-purchases-simple.service';
import { SupabaseModule } from '../../config/supabase.module';
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
import { optionalTypeOrmFeature, isTypeOrmEnabled } from '../../config/typeorm-optional.helper';

const conditionalControllers = isTypeOrmEnabled() ? [
  AdminController,
  AdminContentController,
  AdminSettingsController,
  AdminImageUploadController,
  AdminPurchasesController,
] : [
  AdminContentController, // Always include AdminContentController
  AdminImageUploadController, // Always include image upload
  AdminPurchasesController, // Always include purchases controller
];

console.log('TypeORM enabled:', isTypeOrmEnabled());
console.log('Admin controllers:', conditionalControllers.map(c => c.name));

const conditionalProviders = isTypeOrmEnabled() ? [
  AdminService,
  AdminContentService,
  AdminSettingsService,
  StripeService,
  VideoUploadService,
  BotNotificationService,
  TelegramsService,
  CDNService,
  QueueService,
  TranscodeService,
  ImageUploadService,
] : [
  AdminContentSimpleService, // Use simplified service for testing
  ImageUploadService, // Always include image upload service
  AdminPurchasesSimpleService, // Always include purchases service
  StripeService, // Include StripeService for payments even without TypeORM
];

const conditionalExports = isTypeOrmEnabled() ? [
  AdminService,
  AdminContentService,
  AdminSettingsService,
  StripeService,
] : [AdminContentSimpleService]; // Export simplified service for testing

@Module({
  imports: [
    ...optionalTypeOrmFeature([
      Content,
      Series,
      Episode,
      Category,
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
  ],
  controllers: conditionalControllers,
  providers: conditionalProviders,
  exports: conditionalExports,
})
export class AdminModule {}