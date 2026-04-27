import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AiChatController } from './ai-chat.controller';
import { AiChatService } from './ai-chat.service';
import { ClaudeProvider } from './providers/claude.provider';
import { CatalogContextService } from './services/catalog-context.service';
import { SupabaseModule } from '../../config/supabase.module';
import { OrdersModule } from '../orders/orders.module';
import { CartModule } from '../cart/cart.module';
import { TelegramsModule } from '../telegrams/telegrams.module';

@Module({
  imports: [
    ConfigModule,
    SupabaseModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'cine-vision-secret-key',
        signOptions: { expiresIn: '24h' },
      }),
      inject: [ConfigService],
    }),
    forwardRef(() => OrdersModule),
    forwardRef(() => CartModule),
    forwardRef(() => TelegramsModule),
  ],
  controllers: [AiChatController],
  providers: [AiChatService, ClaudeProvider, CatalogContextService],
  exports: [AiChatService],
})
export class AiChatModule {}
