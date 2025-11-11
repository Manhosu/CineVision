import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Stripe from 'stripe';
import { Purchase, PurchaseStatus } from '../../purchases/entities/purchase.entity';
import { Payment, PaymentStatus, PaymentProvider } from '../entities/payment.entity';
import { Content } from '../../content/entities/content.entity';
import { SystemLog } from '../../logs/entities/system-log.entity';
import { User } from '../../users/entities/user.entity';
import { BotNotificationService } from '../../telegrams/services/bot-notification.service';

@Injectable()
export class StripeWebhookService {
  private readonly logger = new Logger(StripeWebhookService.name);

  constructor(
    @InjectRepository(Purchase)
    private purchaseRepository: Repository<Purchase>,
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(Content)
    private contentRepository: Repository<Content>,
    @InjectRepository(SystemLog)
    private systemLogRepository: Repository<SystemLog>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private botNotificationService: BotNotificationService,
  ) {}

  async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    this.logger.log(`Processing webhook event: ${event.type}`);

    try {
      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
          break;

        case 'payment_intent.payment_failed':
          await this.handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
          break;

        case 'checkout.session.completed':
          await this.handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
          break;

        case 'charge.refunded':
          await this.handleChargeRefunded(event.data.object as Stripe.Charge);
          break;

        default:
          this.logger.log(`Unhandled event type: ${event.type}`);
      }
    } catch (error) {
      this.logger.error(`Error processing webhook event ${event.type}: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
    this.logger.log(`Payment intent succeeded: ${paymentIntent.id}`);

    const metadata = paymentIntent.metadata;
    const purchaseId = metadata?.purchase_id;
    const userId = metadata?.user_id;
    const contentId = metadata?.content_id;

    if (!purchaseId) {
      this.logger.warn(`No purchase_id in payment intent metadata: ${paymentIntent.id}`);
      return;
    }

    try {
      // Find or create payment record
      let payment = await this.paymentRepository.findOne({
        where: { provider_payment_id: paymentIntent.id },
      });

      if (!payment) {
        payment = this.paymentRepository.create({
          purchase_id: purchaseId,
          provider: PaymentProvider.STRIPE,
          provider_payment_id: paymentIntent.id,
          amount_cents: paymentIntent.amount,
          currency: paymentIntent.currency.toUpperCase(),
          status: PaymentStatus.COMPLETED,
          processed_at: new Date(),
          provider_meta: paymentIntent.metadata,
        });

        await this.paymentRepository.save(payment);
      } else {
        payment.status = PaymentStatus.COMPLETED;
        payment.processed_at = new Date();
        await this.paymentRepository.save(payment);
      }

      // Update purchase status
      const purchase = await this.purchaseRepository.findOne({
        where: { id: purchaseId },
      });

      if (purchase) {
        purchase.status = PurchaseStatus.PAID;
        purchase.payment_confirmed_at = new Date();

        // Set access expiration (e.g., 1 year from now, or lifetime if null)
        const accessExpiresAt = new Date();
        accessExpiresAt.setFullYear(accessExpiresAt.getFullYear() + 1);
        purchase.access_expires_at = accessExpiresAt;

        await this.purchaseRepository.save(purchase);

        // Increment weekly_sales and total_sales for content
        if (contentId) {
          await this.contentRepository.increment(
            { id: contentId },
            'weekly_sales',
            1,
          );
          await this.contentRepository.increment(
            { id: contentId },
            'total_sales',
            1,
          );
        }

        // Log successful payment
        await this.systemLogRepository.save({
          entity_type: 'purchase',
          entity_id: purchaseId,
          action: 'payment_succeeded',
          user_id: userId,
          meta: {
            payment_intent_id: paymentIntent.id,
            amount: paymentIntent.amount,
            currency: paymentIntent.currency,
          },
        });

        this.logger.log(`Purchase ${purchaseId} marked as PAID`);

        // NOTE: This TypeORM-based webhook service is deprecated.
        // Production uses StripeWebhookSupabaseService which calls
        // TelegramsEnhancedService.deliverContentAfterPayment() for content delivery.
        // The old sendPurchaseAccess() method has been removed as it sent videos in private chat,
        // which violates the architecture requirement (content only via Telegram groups + dashboard).
        this.logger.log(`Telegram notification handled by Supabase webhook service for purchase ${purchaseId}`);
      }
    } catch (error) {
      this.logger.error(`Failed to process payment intent succeeded: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
    this.logger.log(`Payment intent failed: ${paymentIntent.id}`);

    const metadata = paymentIntent.metadata;
    const purchaseId = metadata?.purchase_id;

    if (!purchaseId) {
      return;
    }

    try {
      // Update payment status
      const payment = await this.paymentRepository.findOne({
        where: { provider_payment_id: paymentIntent.id },
      });

      if (payment) {
        payment.status = PaymentStatus.FAILED;
        payment.processed_at = new Date();
        await this.paymentRepository.save(payment);
      }

      // Update purchase status
      const purchase = await this.purchaseRepository.findOne({
        where: { id: purchaseId },
      });

      if (purchase) {
        purchase.status = PurchaseStatus.FAILED;
        await this.purchaseRepository.save(purchase);
      }

      // Log failure
      await this.systemLogRepository.save({
        entity_type: 'purchase',
        entity_id: purchaseId,
        action: 'payment_failed',
        meta: {
          payment_intent_id: paymentIntent.id,
          last_payment_error: paymentIntent.last_payment_error,
        },
      });

      this.logger.log(`Purchase ${purchaseId} marked as FAILED`);
    } catch (error) {
      this.logger.error(`Failed to process payment intent failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
    this.logger.log(`Checkout session completed: ${session.id}`);

    const metadata = session.metadata;
    const purchaseId = metadata?.purchase_id;
    const userId = metadata?.user_id;
    const contentId = metadata?.content_id;

    if (!purchaseId) {
      this.logger.warn(`No purchase_id in checkout session metadata: ${session.id}`);
      return;
    }

    try {
      // Similar to payment_intent.succeeded
      const payment = this.paymentRepository.create({
        purchase_id: purchaseId,
        provider: PaymentProvider.STRIPE,
        provider_payment_id: session.payment_intent as string,
        amount_cents: session.amount_total,
        currency: session.currency?.toUpperCase(),
        status: PaymentStatus.COMPLETED,
        processed_at: new Date(),
        provider_meta: session.metadata,
      });

      await this.paymentRepository.save(payment);

      // Update purchase
      const purchase = await this.purchaseRepository.findOne({
        where: { id: purchaseId },
      });

      if (purchase) {
        purchase.status = PurchaseStatus.PAID;
        purchase.payment_confirmed_at = new Date();

        const accessExpiresAt = new Date();
        accessExpiresAt.setFullYear(accessExpiresAt.getFullYear() + 1);
        purchase.access_expires_at = accessExpiresAt;

        await this.purchaseRepository.save(purchase);

        // Increment sales
        if (contentId) {
          await this.contentRepository.increment({ id: contentId }, 'weekly_sales', 1);
          await this.contentRepository.increment({ id: contentId }, 'total_sales', 1);
        }

        // Log
        await this.systemLogRepository.save({
          entity_type: 'purchase',
          entity_id: purchaseId,
          action: 'checkout_completed',
          user_id: userId,
          meta: {
            session_id: session.id,
            amount: session.amount_total,
          },
        });

        this.logger.log(`Checkout completed for purchase ${purchaseId}`);

        // NOTE: This TypeORM-based webhook service is deprecated.
        // Production uses StripeWebhookSupabaseService which calls
        // TelegramsEnhancedService.deliverContentAfterPayment() for content delivery.
        // The old sendPurchaseAccess() method has been removed as it sent videos in private chat,
        // which violates the architecture requirement (content only via Telegram groups + dashboard).
        this.logger.log(`Telegram notification handled by Supabase webhook service for checkout ${session.id}`);
      }
    } catch (error) {
      this.logger.error(`Failed to process checkout session: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async handleChargeRefunded(charge: Stripe.Charge) {
    this.logger.log(`Charge refunded: ${charge.id}`);

    try {
      const payment = await this.paymentRepository.findOne({
        where: { provider_payment_id: charge.payment_intent as string },
      });

      if (payment) {
        payment.status = 'REFUNDED' as any;
        await this.paymentRepository.save(payment);

        // Log refund
        await this.systemLogRepository.save({
          entity_type: 'payment',
          entity_id: payment.id,
          action: 'payment_refunded',
          meta: {
            charge_id: charge.id,
            amount_refunded: charge.amount_refunded,
          },
        });

        this.logger.log(`Payment ${payment.id} marked as REFUNDED`);
      }
    } catch (error) {
      this.logger.error(`Failed to process charge refund: ${error.message}`, error.stack);
      throw error;
    }
  }
}
