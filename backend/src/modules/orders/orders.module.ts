import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { SupabaseModule } from '../../config/supabase.module';
import { CartModule } from '../cart/cart.module';
import { PaymentsModule } from '../payments/payments.module';
import { TelegramsModule } from '../telegrams/telegrams.module';

@Module({
  imports: [
    ConfigModule,
    SupabaseModule,
    forwardRef(() => CartModule),
    forwardRef(() => PaymentsModule),
    forwardRef(() => TelegramsModule),
  ],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    {
      provide: 'OrdersService',
      useExisting: OrdersService,
    },
  ],
  exports: [OrdersService, 'OrdersService'],
})
export class OrdersModule {}
