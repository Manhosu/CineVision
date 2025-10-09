import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PurchasesController } from './purchases.controller';
import { PurchasesService } from './purchases.service';
import { PurchasesSupabaseService } from './purchases-supabase.service';
import { Purchase } from './entities/purchase.entity';
import { Content } from '../content/entities/content.entity';
import { optionalTypeOrmFeature, isTypeOrmEnabled } from '../../config/typeorm-optional.helper';

// Use Supabase service when TypeORM is disabled
const ServiceProvider = {
  provide: 'PurchasesService',
  useClass: isTypeOrmEnabled() ? PurchasesService : PurchasesSupabaseService,
};

@Module({
  imports: [
    ...optionalTypeOrmFeature([Purchase, Content]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'cine-vision-secret-key',
        signOptions: { expiresIn: '24h' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [PurchasesController],
  providers: [ServiceProvider],
  exports: [ServiceProvider],
})
export class PurchasesModule {}