import { Module, forwardRef } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentsSupabaseService } from './payments-supabase.service';
import { PixService } from './services/pix.service';
import { StripeService } from './services/stripe.service';
import { WooviService } from './services/woovi.service';
import { NewBankService } from './services/new-bank.service';
import { OasyfyService } from './services/oasyfy.service';
import { WooviWebhookService } from './services/woovi-webhook.service';
import { PixQRCodeService } from './services/pix-qrcode.service';
import { StripeWebhookService } from './services/stripe-webhook.service';
import { StripeWebhookSupabaseService } from './services/stripe-webhook-supabase.service';
import { StripeTestController } from './controllers/stripe-test.controller';
import { StripeWebhookController } from './controllers/stripe-webhook.controller';
import { WooviWebhookController } from './controllers/woovi-webhook.controller';
import { OasyfyWebhookController } from './controllers/oasyfy-webhook.controller';
import { PixProviderFactory } from './providers/pix-provider.factory';
import { TestPaymentController } from './test-payment.controller';
import { Payment } from './entities/payment.entity';
import { Purchase } from '../purchases/entities/purchase.entity';
import { AdminModule } from '../admin/admin.module';
import { TelegramsModule } from '../telegrams/telegrams.module';
import { SupabaseModule } from '../../config/supabase.module';
import { optionalTypeOrmFeature, isTypeOrmEnabled } from '../../config/typeorm-optional.helper';

const conditionalControllers = [PaymentsController, StripeTestController, StripeWebhookController, WooviWebhookController, OasyfyWebhookController, TestPaymentController];

const conditionalProviders = isTypeOrmEnabled()
  ? [PaymentsService, PixService, StripeService, WooviService, NewBankService, OasyfyService, PixProviderFactory, WooviWebhookService, PixQRCodeService, StripeWebhookService, {
      provide: 'IPaymentsService',
      useClass: PaymentsService,
    }]
  : [PaymentsSupabaseService, StripeService, WooviService, NewBankService, OasyfyService, PixProviderFactory, WooviWebhookService, PixQRCodeService, StripeWebhookSupabaseService, {
      provide: PaymentsService,
      useClass: PaymentsSupabaseService,
    }];

const conditionalExports = isTypeOrmEnabled()
  ? [PaymentsService, PixService, StripeService, WooviService, OasyfyService, PixQRCodeService, PixProviderFactory]
  : [PaymentsService, StripeService, WooviService, OasyfyService, PixQRCodeService, PixProviderFactory];

@Module({
  imports: [
    ...optionalTypeOrmFeature([Payment, Purchase]),
    SupabaseModule,
    forwardRef(() => AdminModule),
    forwardRef(() => TelegramsModule),
  ],
  controllers: conditionalControllers,
  providers: conditionalProviders,
  exports: conditionalExports,
})
export class PaymentsModule {}
