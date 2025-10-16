import { Module, forwardRef } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentsSupabaseService } from './payments-supabase.service';
import { PixService } from './services/pix.service';
import { StripeService } from './services/stripe.service';
import { StripeTestController } from './controllers/stripe-test.controller';
import { Payment } from './entities/payment.entity';
import { Purchase } from '../purchases/entities/purchase.entity';
import { AdminModule } from '../admin/admin.module';
import { TelegramsModule } from '../telegrams/telegrams.module';
import { SupabaseModule } from '../../config/supabase.module';
import { optionalTypeOrmFeature, isTypeOrmEnabled } from '../../config/typeorm-optional.helper';

// Always load PaymentsController and required services since Telegram bot needs them
const conditionalControllers = [PaymentsController, StripeTestController];

// When TypeORM is disabled, use PaymentsSupabaseService instead of PaymentsService
const conditionalProviders = isTypeOrmEnabled()
  ? [PaymentsService, PixService, StripeService, {
      provide: 'IPaymentsService',
      useClass: PaymentsService,
    }]
  : [PaymentsSupabaseService, StripeService, {
      provide: PaymentsService,
      useClass: PaymentsSupabaseService,
    }];

const conditionalExports = isTypeOrmEnabled()
  ? [PaymentsService, PixService, StripeService]
  : [PaymentsService, StripeService]; // PaymentsService alias points to PaymentsSupabaseService

@Module({
  imports: [
    ...optionalTypeOrmFeature([Payment, Purchase]),
    SupabaseModule, // Always import SupabaseModule for Supabase-based services
    forwardRef(() => AdminModule),
    forwardRef(() => TelegramsModule),
  ],
  controllers: conditionalControllers,
  providers: conditionalProviders,
  exports: conditionalExports,
})
export class PaymentsModule {}
