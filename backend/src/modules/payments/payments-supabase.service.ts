import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../../config/supabase.service';
import { StripeService } from './services/stripe.service';
import {
  CreatePaymentDto,
  CreatePaymentResponseDto,
  PaymentStatusDto,
  PaymentStatusResponseDto
} from './dto';

@Injectable()
export class PaymentsSupabaseService {
  private readonly logger = new Logger(PaymentsSupabaseService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly stripeService: StripeService,
    private readonly configService: ConfigService,
  ) {
    this.logger.log('PaymentsSupabaseService initialized (Supabase mode)');
  }

  /**
   * Create payment intent using Stripe Checkout
   * This version uses Supabase instead of TypeORM
   */
  async createPayment(dto: CreatePaymentDto): Promise<CreatePaymentResponseDto> {
    try {
      this.logger.log(`Creating payment for purchase ${dto.purchase_id}`);

      // Find purchase in Supabase
      const { data: purchase, error: purchaseError } = await this.supabaseService.client
        .from('purchases')
        .select('*, content(*)')
        .eq('id', dto.purchase_id)
        .single();

      if (purchaseError || !purchase) {
        throw new NotFoundException(`Purchase with ID ${dto.purchase_id} not found`);
      }

      if (purchase.status === 'paid') {
        throw new BadRequestException('Purchase is already paid');
      }

      // Create or get Stripe product/price for this content
      const content = purchase.content;
      let stripeProductId = content.stripe_product_id;
      let stripePriceId = content.stripe_price_id;

      // Create Stripe product if doesn't exist
      if (!stripeProductId || !stripePriceId) {
        this.logger.log(`Creating Stripe product for content ${content.id}`);

        const stripeResult = await this.stripeService.createProductWithPrice(
          {
            name: content.title,
            description: content.description,
            images: content.thumbnail_url ? [content.thumbnail_url] : [],
            metadata: {
              content_id: content.id,
              content_type: content.content_type,
            },
          },
          {
            unitAmount: content.price_cents,
            currency: content.currency?.toLowerCase() || 'brl',
            metadata: {
              content_id: content.id,
            },
          },
        );

        stripeProductId = stripeResult.productId;
        stripePriceId = stripeResult.priceId;

        // Update content with Stripe IDs
        await this.supabaseService.client
          .from('content')
          .update({
            stripe_product_id: stripeProductId,
            stripe_price_id: stripePriceId,
          })
          .eq('id', content.id);
      }

      // Create Stripe Checkout Session
      const checkoutSession = await this.stripeService.createCheckoutSession(
        stripePriceId,
        dto.return_url || `${this.configService.get('FRONTEND_URL')}/payment-success`,
        dto.cancel_url || `${this.configService.get('FRONTEND_URL')}/payment-cancel`,
        {
          purchase_id: purchase.id,
          purchase_token: purchase.purchase_token,
          content_id: content.id,
          user_id: purchase.user_id || 'anonymous',
        },
      );

      // Create payment record in Supabase
      const { data: payment, error: paymentError } = await this.supabaseService.client
        .from('payments')
        .insert({
          purchase_id: purchase.id,
          provider_payment_id: checkoutSession.id,
          provider: 'stripe',
          status: 'pending',
          amount_cents: purchase.amount_cents,
          currency: purchase.currency,
          payment_method: dto.payment_method || 'card',
          provider_meta: {
            checkout_session_id: checkoutSession.id,
            payment_intent_id: checkoutSession.payment_intent,
          },
        })
        .select()
        .single();

      if (paymentError) {
        this.logger.error('Error creating payment record:', paymentError);
      }

      this.logger.log(`Payment created successfully: ${checkoutSession.id}`);

      return {
        provider_payment_id: checkoutSession.id,
        payment_method: dto.payment_method,
        payment_url: checkoutSession.url,
        payment_data: {
          session_id: checkoutSession.id,
          payment_intent_id: checkoutSession.payment_intent as string,
        },
        amount_cents: purchase.amount_cents,
        currency: purchase.currency,
        purchase_id: purchase.id,
        provider: 'stripe',
        created_at: new Date(),
      };
    } catch (error) {
      this.logger.error(`Error creating payment for purchase ${dto.purchase_id}:`, error);
      throw error;
    }
  }

  /**
   * Get payment status from Stripe
   */
  async getPaymentStatus(dto: PaymentStatusDto): Promise<PaymentStatusResponseDto> {
    try {
      // Check if it's a checkout session or payment intent
      let paymentIntent: any;

      if (dto.provider_payment_id.startsWith('cs_')) {
        // It's a checkout session
        const session = await this.stripeService.getCheckoutSession(dto.provider_payment_id);
        if (session.payment_intent) {
          paymentIntent = await this.stripeService.getPaymentIntent(session.payment_intent as string);
        } else {
          return {
            status: session.payment_status === 'paid' ? 'paid' : 'pending',
            amount_paid: session.amount_total / 100,
            paid_at: session.payment_status === 'paid' ? new Date() : undefined,
            provider_payment_id: dto.provider_payment_id,
            provider: 'stripe',
          };
        }
      } else {
        // It's a payment intent
        paymentIntent = await this.stripeService.getPaymentIntent(dto.provider_payment_id);
      }

      return {
        status: paymentIntent.status === 'succeeded' ? 'paid' : paymentIntent.status,
        amount_paid: paymentIntent.amount_received / 100,
        paid_at: paymentIntent.status === 'succeeded' ? new Date(paymentIntent.created * 1000) : undefined,
        failure_reason: paymentIntent.last_payment_error?.message,
        provider_payment_id: dto.provider_payment_id,
        provider: 'stripe',
      };
    } catch (error) {
      this.logger.error(`Error fetching payment status: ${error.message}`);
      throw error;
    }
  }

  /**
   * Refund payment
   */
  async refundPayment(providerPaymentId: string, amount?: number, reason?: string) {
    try {
      // Find the payment in Supabase
      const { data: payment, error: paymentError } = await this.supabaseService.client
        .from('payments')
        .select('*, purchase:purchases(*)')
        .eq('provider_payment_id', providerPaymentId)
        .single();

      if (paymentError || !payment) {
        throw new NotFoundException('Payment not found');
      }

      if (payment.status !== 'completed') {
        throw new BadRequestException('Only completed payments can be refunded');
      }

      // Get payment intent from Stripe
      let paymentIntentId: string;

      if (providerPaymentId.startsWith('cs_')) {
        const session = await this.stripeService.getCheckoutSession(providerPaymentId);
        paymentIntentId = session.payment_intent as string;
      } else {
        paymentIntentId = providerPaymentId;
      }

      // Create refund in Stripe
      const refund = await this.stripeService.createRefund(paymentIntentId, amount, reason);

      // Update payment status in Supabase
      await this.supabaseService.client
        .from('payments')
        .update({
          status: 'refunded',
          refund_id: refund.id,
          refund_amount: refund.amount,
          refund_reason: reason,
          refunded_at: new Date().toISOString(),
        })
        .eq('id', payment.id);

      // Update purchase status if full refund
      if (!amount || amount >= payment.amount_cents) {
        await this.supabaseService.client
          .from('purchases')
          .update({
            status: 'refunded',
            access_expires_at: new Date().toISOString(), // Revoke access
          })
          .eq('id', payment.purchase_id);
      }

      this.logger.log(`Payment ${providerPaymentId} refunded successfully`);

      return {
        refund_id: refund.id,
        amount_refunded: refund.amount,
        currency: refund.currency,
        status: refund.status,
        reason,
        payment_id: providerPaymentId,
      };
    } catch (error) {
      this.logger.error(`Error processing refund for payment ${providerPaymentId}:`, error.message);
      throw error;
    }
  }

  /**
   * Handle webhook - stub for now
   */
  async handleWebhook(webhookData: any) {
    this.logger.warn('Using legacy webhook handler in Supabase mode');
    return { status: 'not_implemented', message: 'Use /webhooks/stripe endpoint instead' };
  }
}
