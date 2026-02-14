import { Module, OnModuleInit, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TelegramsService } from './telegrams.service';
import { TelegramsEnhancedService } from './telegrams-enhanced.service';
import { TelegramCatalogSyncService } from './services/telegram-catalog-sync.service';
import { TelegramsController } from './telegrams.controller';
import { User } from '../users/entities/user.entity';
import { SystemLog } from '../logs/entities/system-log.entity';
import { Content } from '../content/entities/content.entity';
import { Purchase } from '../purchases/entities/purchase.entity';
import { optionalTypeOrmFeature, isTypeOrmEnabled } from '../../config/typeorm-optional.helper';
import { UsersModule } from '../users/users.module';
import { ContentModule } from '../content/content.module';
import { PurchasesModule } from '../purchases/purchases.module';
import { PaymentsModule } from '../payments/payments.module';
import { SupabaseModule } from '../../config/supabase.module';
import { AuthModule } from '../auth/auth.module';

// Always enable telegram controllers and services (works with both TypeORM and Supabase)
const conditionalControllers = [TelegramsController];
const conditionalProviders = [TelegramsService, TelegramsEnhancedService, TelegramCatalogSyncService];
const conditionalExports = [TelegramsService, TelegramsEnhancedService, TelegramCatalogSyncService];

@Module({
  imports: [
    ...optionalTypeOrmFeature([User, SystemLog, Content, Purchase]),
    ConfigModule,
    SupabaseModule,
    UsersModule,
    forwardRef(() => ContentModule),
    forwardRef(() => PurchasesModule),
    forwardRef(() => PaymentsModule),
    forwardRef(() => AuthModule),
  ],
  providers: conditionalProviders,
  controllers: conditionalControllers,
  exports: conditionalExports,
})
export class TelegramsModule implements OnModuleInit {
  constructor(
    private readonly telegramsEnhancedService: TelegramsEnhancedService,
    private readonly catalogSyncService: TelegramCatalogSyncService,
  ) {}

  onModuleInit() {
    // Inject catalog sync service into enhanced service to avoid circular dependency
    this.telegramsEnhancedService.setCatalogSyncService(this.catalogSyncService);
  }
}