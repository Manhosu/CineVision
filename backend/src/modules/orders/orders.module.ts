import { Module, OnModuleInit, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { SupabaseModule } from '../../config/supabase.module';
import { CartModule } from '../cart/cart.module';
import { PaymentsModule } from '../payments/payments.module';
import { TelegramsModule } from '../telegrams/telegrams.module';
import { TelegramsEnhancedService } from '../telegrams/telegrams-enhanced.service';

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
export class OrdersModule implements OnModuleInit {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly telegramsEnhancedService: TelegramsEnhancedService,
  ) {}

  onModuleInit() {
    // Igor (04/07): Cenário 3 — handlePurchaseIntent no bot promo precisa
    // criar order + PIX. Injeta OrdersService no enhanced pra ele delegar.
    // Setter-injection evita ciclo de dependência (TelegramsModule já é
    // importado aqui, importar de volta OrdersModule daria loop).
    this.telegramsEnhancedService.setOrdersService(this.ordersService);
  }
}
