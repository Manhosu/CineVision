import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PixRecoveryController } from './pix-recovery.controller';
import { PixRecoveryService } from './pix-recovery.service';
import { SupabaseModule } from '../../config/supabase.module';
import { OrdersModule } from '../orders/orders.module';
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
    forwardRef(() => TelegramsModule),
  ],
  controllers: [PixRecoveryController],
  providers: [PixRecoveryService],
  exports: [PixRecoveryService],
})
export class PixRecoveryModule {}
