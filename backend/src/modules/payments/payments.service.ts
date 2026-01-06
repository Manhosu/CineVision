import { Injectable, Logger, NotFoundException, BadRequestException, Optional, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Purchase, PurchaseStatus } from '../purchases/entities/purchase.entity';
import { Payment, PaymentStatus, PaymentProvider as PaymentProviderEnum } from './entities/payment.entity';
import { StripePaymentProvider } from './providers/stripe';
import { PaymentProvider, PaymentMethod } from './providers/interfaces';
import { TelegramsEnhancedService } from '../telegrams/telegrams-enhanced.service';
import {
  CreatePaymentDto,
  CreatePaymentResponseDto,
  PaymentStatusDto,
  PaymentStatusResponseDto
} from './dto';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly paymentProvider: PaymentProvider;

  constructor(
    @InjectRepository(Purchase)
    private purchaseRepository: Repository<Purchase>,
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    private configService: ConfigService,
    @Optional() @Inject(forwardRef(() => TelegramsEnhancedService))
    private telegramsService?: TelegramsEnhancedService,
  ) {
    // Initialize payment provider (currently only Stripe)
    this.paymentProvider = new StripePaymentProvider(configService);
  }

  async createPayment(dto: CreatePaymentDto): Promise<CreatePaymentResponseDto> {
    // Find purchase
    const purchase = await this.purchaseRepository.findOne({
      where: { id: dto.purchase_id },
      relations: ['content'],
    });

    if (!purchase) {
      throw new NotFoundException(`Purchase with ID ${dto.purchase_id} not found`);
    }

    if (purchase.status === PurchaseStatus.PAID) {
      throw new BadRequestException('Purchase is already paid');
    }

    try {
      // Get PIX key from config or DTO
      const pix_key = dto.pix_key || this.configService.get<string>('DEFAULT_PIX_KEY');

      // Create payment intent with provider
      const paymentIntent = await this.paymentProvider.createPaymentIntent({
        purchase,
        payment_method: dto.payment_method,
        return_url: dto.return_url,
        cancel_url: dto.cancel_url,
        pix_key,
      });

      // Create payment record
      const payment = this.paymentRepository.create({
        purchase_id: purchase.id,
        provider_payment_id: paymentIntent.provider_payment_id,
        provider: PaymentProviderEnum.STRIPE,
        status: PaymentStatus.PENDING,
        amount_cents: paymentIntent.amount_cents,
        currency: paymentIntent.currency,
        payment_method: dto.payment_method === PaymentMethod.PIX ? 'pix' : 'card',
        provider_meta: paymentIntent.metadata,
      });

      const savedPayment = await this.paymentRepository.save(payment);

      this.logger.log(`Payment created: ${savedPayment.id} for purchase ${purchase.id}`);

      return {
        provider_payment_id: paymentIntent.provider_payment_id,
        payment_method: dto.payment_method,
        payment_url: paymentIntent.payment_url,
        payment_data: paymentIntent.payment_data,
        amount_cents: paymentIntent.amount_cents,
        currency: paymentIntent.currency,
        purchase_id: purchase.id,
        provider: this.paymentProvider.getProviderName(),
        created_at: savedPayment.created_at,
      };
    } catch (error) {
      this.logger.error(`Error creating payment for purchase ${dto.purchase_id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async verifyWebhookSignature(payload: string, signature: string): Promise<boolean> {
    try {
      const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
      const result = await this.paymentProvider.verifyWebhookSignature(payload, signature, webhookSecret);
      return result.isValid;
    } catch (error) {
      this.logger.error(`Webhook signature verification failed: ${error.message}`);
      return false;
    }
  }

  async handleStripeWebhook(payload: string, signature: string): Promise<any> {
    try {
      // Verify webhook signature
      const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
      const verificationResult = await this.paymentProvider.verifyWebhookSignature(payload, signature, webhookSecret);

      if (!verificationResult.isValid) {
        this.logger.error('Invalid webhook signature');
        return { status: 'error', message: 'Invalid signature' };
      }

      const event = verificationResult.event;
      this.logger.log(`Processing Stripe webhook: ${event.type}`);

      // Handle different event types
      switch (event.type) {
        case 'payment_intent.succeeded':
          return await this.handlePaymentSucceeded(event.data.object);
        case 'payment_intent.payment_failed':
          return await this.handlePaymentFailed(event.data.object);
        case 'checkout.session.completed':
          return await this.handleCheckoutCompleted(event.data.object);
        default:
          this.logger.log(`Unhandled event type: ${event.type}`);
          return { status: 'ignored', event_type: event.type };
      }
    } catch (error) {
      this.logger.error('Error processing Stripe webhook', error);
      return { status: 'error', message: error.message };
    }
  }

  private sanitizeWebhookPayload(payload: any): Record<string, any> {
    // Remove sensitive data from webhook payload before storing
    const sanitized = { ...payload };
    
    // Remove sensitive fields
    delete sanitized.client_secret;
    delete sanitized.charges?.data?.[0]?.payment_method_details;
    delete sanitized.payment_method_details;
    delete sanitized.source;
    delete sanitized.receipt_url;
    
    // Keep only essential fields for debugging/auditing
    return {
      id: sanitized.id,
      status: sanitized.status,
      amount: sanitized.amount,
      amount_received: sanitized.amount_received,
      currency: sanitized.currency,
      created: sanitized.created,
      metadata: sanitized.metadata,
      payment_method_types: sanitized.payment_method_types,
      last_payment_error: sanitized.last_payment_error ? {
        code: sanitized.last_payment_error.code,
        message: sanitized.last_payment_error.message,
        type: sanitized.last_payment_error.type,
      } : undefined,
    };
  }

  private async handlePaymentSucceeded(paymentIntent: any): Promise<any> {
    const payment_id = paymentIntent.id;
    const metadata = paymentIntent.metadata;

    // Find payment record
    const payment = await this.paymentRepository.findOne({
      where: { provider_payment_id: payment_id },
      relations: ['purchase'],
    });

    if (!payment) {
      // Try to find by purchase_token in metadata
      const purchase_token = metadata.purchase_token;
      if (purchase_token) {
        const purchase = await this.purchaseRepository.findOne({
          where: { purchase_token },
          relations: ['content'],
        });

        if (purchase) {
          // Create new payment record
          const newPayment = this.paymentRepository.create({
            purchase_id: purchase.id,
            provider_payment_id: payment_id,
            provider: PaymentProviderEnum.STRIPE,
            status: PaymentStatus.COMPLETED,
            amount_cents: paymentIntent.amount_received,
            currency: paymentIntent.currency.toUpperCase(),
            webhook_payload: paymentIntent,
            processed_at: new Date(),
          });

          await this.paymentRepository.save(newPayment);
          payment.purchase = purchase;
        }
      }

      if (!payment?.purchase) {
        this.logger.error(`Payment or purchase not found for payment_intent: ${payment_id}`);
        return { status: 'error', message: 'Payment not found' };
      }
    }

    // Check if already processed (idempotency)
    if (payment.status === PaymentStatus.COMPLETED) {
      this.logger.log(`Payment ${payment_id} already processed`);
      return { status: 'already_processed' };
    }

    // Update payment status
    payment.status = PaymentStatus.COMPLETED;
    payment.processed_at = new Date();
    payment.webhook_payload = this.sanitizeWebhookPayload(paymentIntent);
    await this.paymentRepository.save(payment);

    // Update purchase status
    const purchase = payment.purchase;
    purchase.status = PurchaseStatus.PAID;
    purchase.payment_provider_id = payment_id;

    // For PIX payments, use immediate access. For cards, use webhook timing.
    const accessHours = paymentIntent.payment_method_types?.includes('pix') ? 24 : 24;
    purchase.access_expires_at = new Date(Date.now() + accessHours * 60 * 60 * 1000);

    await this.purchaseRepository.save(purchase);

    this.logger.log(`Payment succeeded: ${payment_id} for purchase ${purchase.id}`);

    // Entregar conteúdo via Telegram se for compra Telegram
    const telegramChatId = purchase.provider_meta?.telegram_chat_id;
    if (this.telegramsService && telegramChatId) {
      this.logger.log(`Triggering content delivery for purchase ${purchase.id} to chat ${telegramChatId}`);
      try {
        await this.telegramsService.deliverContentAfterPayment(purchase);
      } catch (error) {
        this.logger.error('Error delivering content to Telegram:', error);
        // Não fazer throw para não quebrar o webhook do Stripe
      }
    }

    return {
      status: 'processed',
      purchase_id: purchase.id,
      payment_status: payment.status,
    };
  }

  private async handlePaymentFailed(paymentIntent: any): Promise<any> {
    const payment_id = paymentIntent.id;

    const payment = await this.paymentRepository.findOne({
      where: { provider_payment_id: payment_id },
      relations: ['purchase'],
    });

    if (!payment) {
      this.logger.error(`Payment not found for payment_intent: ${payment_id}`);
      return { status: 'error', message: 'Payment not found' };
    }

    // Update payment status
    payment.status = PaymentStatus.FAILED;
    payment.failure_reason = paymentIntent.last_payment_error?.message;
    payment.webhook_payload = this.sanitizeWebhookPayload(paymentIntent);
    await this.paymentRepository.save(payment);

    // Update purchase status
    payment.purchase.status = PurchaseStatus.FAILED;
    await this.purchaseRepository.save(payment.purchase);

    this.logger.log(`Payment failed: ${payment_id} for purchase ${payment.purchase.id}`);

    return {
      status: 'processed',
      purchase_id: payment.purchase.id,
      payment_status: payment.status,
    };
  }

  private async handleCheckoutCompleted(session: any): Promise<any> {
    const payment_intent_id = session.payment_intent;

    if (payment_intent_id) {
      // Get the actual payment intent to process
      const paymentStatus = await this.paymentProvider.fetchPaymentStatus(payment_intent_id);

      if (paymentStatus.status === 'paid') {
        // This will be handled by payment_intent.succeeded event
        return { status: 'deferred_to_payment_intent' };
      }
    }

    return { status: 'processed', session_id: session.id };
  }

  // Legacy webhook handler for backward compatibility
  async handleWebhook(webhookData: any) {
    this.logger.warn('Using legacy webhook handler. Consider migrating to handleStripeWebhook');
    return this.handleLegacyWebhook(webhookData);
  }

  private async handleLegacyWebhook(webhookData: any) {
    try {
      // Simulate webhook data structure from EFI Bank
      const { purchase_token, status, payment_id, amount } = webhookData;

      if (!purchase_token || !status || !payment_id) {
        this.logger.error('Missing required webhook data');
        return { status: 'error', message: 'Missing required data' };
      }

      // Find the purchase by token
      const purchase = await this.purchaseRepository.findOne({
        where: { purchase_token },
        relations: ['content'],
      });

      if (!purchase) {
        this.logger.error(`Purchase not found for token: ${purchase_token}`);
        return { status: 'error', message: 'Purchase not found' };
      }

      // Check if payment is already processed (idempotency)
      const existingPayment = await this.paymentRepository.findOne({
        where: { provider_payment_id: payment_id },
      });

      if (existingPayment && existingPayment.status === PaymentStatus.COMPLETED) {
        this.logger.log(`Payment ${payment_id} already processed`);
        return { status: 'already_processed' };
      }

      // Create or update payment record
      let payment = existingPayment;
      if (!payment) {
        payment = this.paymentRepository.create({
          purchase_id: purchase.id,
          provider_payment_id: payment_id,
          provider: PaymentProviderEnum.LEGACY,
          status: status === 'approved' ? PaymentStatus.COMPLETED : PaymentStatus.PENDING,
          webhook_payload: this.sanitizeWebhookPayload(webhookData),
        });
      } else {
        payment.status = status === 'approved' ? PaymentStatus.COMPLETED : PaymentStatus.PENDING;
        payment.webhook_payload = this.sanitizeWebhookPayload(webhookData);
      }

      await this.paymentRepository.save(payment);

      // Update purchase status if payment is approved
      if (status === 'approved') {
        purchase.status = PurchaseStatus.PAID;
        purchase.access_expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
        await this.purchaseRepository.save(purchase);

        // Entregar conteúdo via Telegram se for compra Telegram
        const telegramChatId = purchase.provider_meta?.telegram_chat_id;
        if (this.telegramsService && telegramChatId) {
          this.logger.log(`Triggering content delivery for purchase ${purchase.id} to chat ${telegramChatId} (legacy webhook)`);
          try {
            await this.telegramsService.deliverContentAfterPayment(purchase);
          } catch (error) {
            this.logger.error('Error delivering content to Telegram:', error);
          }
        }
      }

      return {
        status: 'processed',
        purchase_id: purchase.id,
        payment_status: payment.status,
      };

    } catch (error) {
      this.logger.error('Error processing webhook', error);
      return { status: 'error', message: error.message };
    }
  }

  async refundPayment(providerPaymentId: string, amount?: number, reason?: string) {
    try {
      // Find the payment in our database
      const payment = await this.paymentRepository.findOne({
        where: { provider_payment_id: providerPaymentId },
        relations: ['purchase'],
      });

      if (!payment) {
        throw new NotFoundException('Payment not found');
      }

      if (payment.status !== PaymentStatus.COMPLETED) {
        throw new BadRequestException('Only completed payments can be refunded');
      }

      // Process refund with payment provider
      const refundResponse = await this.paymentProvider.refundPayment(
        providerPaymentId,
        amount,
        reason
      );

      // Update payment status to refunded
      payment.status = PaymentStatus.REFUNDED;
      payment.refund_id = refundResponse.refund_id;
      payment.refund_amount = refundResponse.amount_refunded;
      payment.refund_reason = reason;
      payment.refunded_at = new Date();
      
      await this.paymentRepository.save(payment);

      // Update purchase status if full refund
      if (!amount || amount >= payment.amount_cents) {
        const purchase = payment.purchase;
        purchase.status = PurchaseStatus.REFUNDED;
        purchase.access_expires_at = new Date(); // Revoke access immediately
        await this.purchaseRepository.save(purchase);
      }

      this.logger.log(`Payment ${providerPaymentId} refunded successfully`);

      return {
        refund_id: refundResponse.refund_id,
        amount_refunded: refundResponse.amount_refunded,
        currency: refundResponse.currency,
        status: refundResponse.status,
        reason: refundResponse.reason,
        payment_id: providerPaymentId,
      };
    } catch (error) {
      this.logger.error(`Error processing refund for payment ${providerPaymentId}:`, error.message);
      throw error;
    }
  }

  async getPaymentStatus(dto: PaymentStatusDto): Promise<PaymentStatusResponseDto> {
    try {
      const statusResponse = await this.paymentProvider.fetchPaymentStatus(dto.provider_payment_id);

      return {
        status: statusResponse.status,
        amount_paid: statusResponse.amount_paid,
        paid_at: statusResponse.paid_at,
        failure_reason: statusResponse.failure_reason,
        provider_payment_id: dto.provider_payment_id,
        provider: this.paymentProvider.getProviderName(),
      };
    } catch (error) {
      this.logger.error(`Error fetching payment status: ${error.message}`);
      throw error;
    }
  }

  async createPixPayment(purchaseId: string): Promise<any> {
    throw new BadRequestException('PIX payments are only available in Supabase mode. This method should not be called in TypeORM mode.');
  }
}