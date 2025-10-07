import { Module } from '@nestjs/common';
import { ApiController } from './api.controller';
import { RequestsModule } from '../modules/requests/requests.module';
import { PurchasesModule } from '../modules/purchases/purchases.module';
import { AuthModule } from '../modules/auth/auth.module';
import { OptionalAuthGuard } from '../modules/auth/guards/optional-auth.guard';
import { isTypeOrmEnabled } from '../config/typeorm-optional.helper';

const conditionalControllers = isTypeOrmEnabled() ? [ApiController] : [];

@Module({
  imports: [
    RequestsModule,
    PurchasesModule,
    AuthModule,
  ],
  controllers: conditionalControllers,
  providers: [OptionalAuthGuard],
})
export class ApiModule {}