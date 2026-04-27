import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { CartController, CartSettingsController } from './cart.controller';
import { CartService } from './cart.service';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'cine-vision-secret-key',
        signOptions: { expiresIn: '24h' },
      }),
      inject: [ConfigService],
    }),
    forwardRef(() => OrdersModule),
  ],
  controllers: [CartController, CartSettingsController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}
