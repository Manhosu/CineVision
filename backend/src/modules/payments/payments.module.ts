import { Module, forwardRef } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PixService } from './services/pix.service';
import { StripeService } from './services/stripe.service';
import { StripeTestController } from './controllers/stripe-test.controller';
import { Payment } from './entities/payment.entity';
import { Purchase } from '../purchases/entities/purchase.entity';
import { AdminModule } from '../admin/admin.module';
import { TelegramsModule } from '../telegrams/telegrams.module';
import { optionalTypeOrmFeature, isTypeOrmEnabled } from '../../config/typeorm-optional.helper';

const conditionalControllers = isTypeOrmEnabled() ? [PaymentsController] : [StripeTestController];
const conditionalProviders = isTypeOrmEnabled() ? [PaymentsService, PixService, StripeService] : [StripeService];
const conditionalExports = isTypeOrmEnabled() ? [PaymentsService, PixService, StripeService] : [StripeService];

@Module({
  imports: [
    ...optionalTypeOrmFeature([Payment, Purchase]),
    forwardRef(() => AdminModule),
    forwardRef(() => TelegramsModule),
  ],
  controllers: conditionalControllers,
  providers: conditionalProviders,
  exports: conditionalExports,
})
export class PaymentsModule {}
