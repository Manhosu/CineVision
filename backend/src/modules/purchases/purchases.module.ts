import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PurchasesController } from './purchases.controller';
import { PurchasesService } from './purchases.service';
import { Purchase } from './entities/purchase.entity';
import { Content } from '../content/entities/content.entity';
import { optionalTypeOrmFeature, isTypeOrmEnabled } from '../../config/typeorm-optional.helper';

const conditionalControllers = isTypeOrmEnabled() ? [PurchasesController] : [];
const conditionalProviders = isTypeOrmEnabled() ? [PurchasesService] : [];
const conditionalExports = isTypeOrmEnabled() ? [PurchasesService] : [];

@Module({
  imports: [
    ...optionalTypeOrmFeature([Purchase, Content]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'temp-secret',
      signOptions: { expiresIn: '24h' },
    }),
  ],
  controllers: conditionalControllers,
  providers: conditionalProviders,
  exports: conditionalExports,
})
export class PurchasesModule {}