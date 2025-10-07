import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { HealthController } from './health.controller';
import { SupabaseModule } from './config/supabase.module';
import { CacheModule } from './common/cache/cache.module';
import { TelegramsModule } from './modules/telegrams/telegrams.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { LogsModule } from './modules/logs/logs.module';
import { ContentModule } from './modules/content/content.module';
import { PurchasesModule } from './modules/purchases/purchases.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { AdminModule } from './modules/admin/admin.module';
import { RequestsModule } from './modules/requests/requests.module';
import { VideoUploadModule } from './modules/video/video-upload.module';
import { ApiModule } from './api/api.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),
    SupabaseModule,
    CacheModule,
    TelegramsModule,
    AuthModule,
    UsersModule,
    LogsModule,
    ContentModule,
    PurchasesModule,
    PaymentsModule,
    AdminModule,
    RequestsModule,
    VideoUploadModule,
    ApiModule,
    HealthModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppTestModule {}