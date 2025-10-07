import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CacheModule } from './common/cache/cache.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { LogsModule } from './modules/logs/logs.module';
import { ContentModule } from './modules/content/content.module';
import { PurchasesModule } from './modules/purchases/purchases.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { TelegramsModule } from './modules/telegrams/telegrams.module';
import { AdminModule } from './modules/admin/admin.module';
import { RequestsModule } from './modules/requests/requests.module';
import { VideoUploadModule } from './modules/video/video-upload.module';
import { ApiModule } from './api/api.module';
import { HealthModule } from './health/health.module';
import { SupabaseModule } from './config/supabase.module';
import { SupabaseTestModule } from './modules/supabase/supabase-test.module';
import { SystemLog } from './modules/logs/entities/system-log.entity';
import { User } from './modules/users/entities/user.entity';
import { RefreshToken } from './modules/auth/entities/refresh-token.entity';
import { TelegramLinkToken } from './modules/auth/entities/telegram-link-token.entity';
import { Content } from './modules/content/entities/content.entity';
import { Series } from './modules/content/entities/series.entity';
import { Episode } from './modules/content/entities/episode.entity';
import { Category } from './modules/content/entities/category.entity';
import { VideoVariant } from './modules/content/entities/video-variant.entity';
import { StreamingAnalytics } from './modules/content/entities/streaming-analytics.entity';
import { Purchase } from './modules/purchases/entities/purchase.entity';
import { Payment } from './modules/payments/entities/payment.entity';
import { ContentRequest } from './modules/requests/entities/content-request.entity';
import { UserFavorite } from './modules/users/entities/user-favorite.entity';
import { AdminSettings } from './modules/admin/entities/admin-settings.entity';


@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Scheduled tasks (cron jobs)
    ScheduleModule.forRoot(),

    // Database configuration (optional - fallback to Supabase REST if connection fails)
    // FORCE DISABLE TypeORM - Using Supabase REST API only
    ...(false ? [
      TypeOrmModule.forRootAsync({
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => {
          // Import entities explicitly to avoid glob pattern issues
          const entities = [
              SystemLog,
              User,
              UserFavorite,
              RefreshToken,
              TelegramLinkToken,
              Content,
              Series,
              Episode,
              Category,
              VideoVariant,
              StreamingAnalytics,
              Purchase,
              Payment,
              ContentRequest,
              AdminSettings,
            ];

          // PostgreSQL configuration via Supabase
          const dbUrl = configService.get('SUPABASE_DATABASE_URL') || configService.get('DATABASE_URL');

          if (!dbUrl) {
            console.warn('SUPABASE_DATABASE_URL or DATABASE_URL not set - TypeORM disabled, using Supabase REST only');
            return null;
          }

          return {
            type: 'postgres',
            url: dbUrl,
            entities: entities,
            synchronize: configService.get('NODE_ENV') === 'development' && configService.get('DATABASE_SYNCHRONIZE') === 'true',
            logging: configService.get('DATABASE_LOGGING') === 'true',
            ssl: {
              rejectUnauthorized: false
            },
            migrations: [__dirname + '/database/migrations/*{.ts,.js}'],
            migrationsRun: false,
            migrationsTableName: 'typeorm_migrations',
            retryAttempts: 3,
            retryDelay: 3000,
          };
        },
        inject: [ConfigService],
      })
    ] : []),

    // Rate limiting
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 100, // requests per minute
      },
    ]),

    // Supabase REST Client
    SupabaseModule,
    SupabaseTestModule,
    
    // Redis Cache
    CacheModule,

    // Feature modules
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
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}