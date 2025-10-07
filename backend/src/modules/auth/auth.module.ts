import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { AuthController } from './auth.controller';
import { WebhooksController } from './webhooks.controller';
import { AuthService } from './auth.service';
import { TelegramAuthService } from './services/telegram-auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { SupabaseJwtStrategy } from './strategies/supabase-jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { UsersModule } from '../users/users.module';
import { PurchasesModule } from '../purchases/purchases.module';
import { PaymentsModule } from '../payments/payments.module';
// import { LogsModule } from '../logs/logs.module'; // Temporarily commented
import { RefreshToken } from './entities/refresh-token.entity';
import { TelegramLinkToken } from './entities/telegram-link-token.entity';
import { jwtConfig } from '../../config/jwt.config';
import { optionalTypeOrmFeature, isTypeOrmEnabled } from '../../config/typeorm-optional.helper';

const conditionalControllers = isTypeOrmEnabled() ? [AuthController, WebhooksController] : [AuthController];

@Module({
  imports: [
    UsersModule,
    PurchasesModule,
    PaymentsModule,
    // LogsModule, // Temporarily commented
    PassportModule,
    JwtModule.register(jwtConfig),
    ...optionalTypeOrmFeature([RefreshToken, TelegramLinkToken]),
  ],
  controllers: conditionalControllers,
  providers: [
    AuthService,
    ...(isTypeOrmEnabled() ? [TelegramAuthService] : []),
    LocalStrategy,
    JwtStrategy,
    SupabaseJwtStrategy
  ],
  exports: [
    AuthService, 
    ...(isTypeOrmEnabled() ? [TelegramAuthService] : []), 
    JwtModule
  ],
})
export class AuthModule {}