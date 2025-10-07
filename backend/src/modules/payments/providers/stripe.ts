import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import {
  PaymentProvider,
  PaymentIntent,
  PaymentStatusResponse,
  WebhookVerificationResult,
  CreatePaymentIntentOptions,
  RefundResponse,
  PaymentMethod,
} from './interfaces';

@Injectable()
export class StripePaymentProvider implements PaymentProvider {
  private readonly logger = new Logger(StripePaymentProvider.name);
  private readonly stripe: Stripe;

  constructor(private configService: ConfigService) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is required');
    }

    this.stripe = new Stripe(secretKey, {
      apiVersion: '2025-08-27.basil',
      timeout: 30000, // 30 seconds timeout
      maxNetworkRetries: 3, // Retry failed requests up to 3 times
    });
  }

  async createPaymentIntent(options: CreatePaymentIntentOptions): Promise<PaymentIntent> {
    const { purchase, payment_method, return_url, cancel_url, pix_key } = options;

    try {
      if (payment_method === PaymentMethod.PIX) {
        return await this.createPixPaymentIntent(purchase, pix_key, return_url, cancel_url);
      } else if (payment_method === PaymentMethod.CARD) {
        return await this.createCardPaymentIntent(purchase, return_url, cancel_url);
      } else {
        throw new Error(`Unsupported payment method: ${payment_method}`);
      }
    } catch (error) {
      if (error.type === 'StripeConnectionError') {
        this.logger.error(`Stripe connection error (timeout/network): ${error.message}`);
      } else if (error.type === 'StripeAPIError') {
        this.logger.error(`Stripe API error: ${error.message}`);
      } else {
        this.logger.error(`Error creating Stripe payment intent: ${error.message}`, error.stack);
      }
      throw error;
    }
  }

  private async createPixPaymentIntent(
    purchase: any,
    pix_key?: string,
    return_url?: string,
    cancel_url?: string
  ): Promise<PaymentIntent> {
    // For PIX payments in Brazil, we use Stripe's payment_method_types: ['pix']
    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: purchase.amount_cents,
      currency: 'brl', // PIX only works with BRL
      payment_method_types: ['pix'],
      metadata: {
        purchase_id: purchase.id,
        purchase_token: purchase.purchase_token,
        content_id: purchase.content_id,
        user_id: purchase.user_id || 'guest',
        pix_key: pix_key || this.configService.get<string>('DEFAULT_PIX_KEY', ''),
      },
      // PIX payments are immediate, no confirmation required
      confirmation_method: 'automatic',
      confirm: false, // We'll confirm when user initiates payment
    });

    return {
      provider_payment_id: paymentIntent.id,
      amount_cents: paymentIntent.amount,
      currency: paymentIntent.currency.toUpperCase(),
      payment_data: {
        client_secret: paymentIntent.client_secret,
        pix_key: pix_key || this.configService.get<string>('DEFAULT_PIX_KEY', ''),
        instructions: 'Use a chave PIX abaixo para realizar o pagamento',
        qr_code_url: null, // Will be generated on frontend with client_secret
      },
      metadata: paymentIntent.metadata,
    };
  }

  private async createCardPaymentIntent(
    purchase: any,
    return_url?: string,
    cancel_url?: string
  ): Promise<PaymentIntent> {
    // For card payments, create a Checkout Session for hosted page
    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'brl',
            product_data: {
              name: purchase.content?.title || 'Filme',
              description: `Compra do filme ${purchase.content?.title || 'desconhecido'}`,
            },
            unit_amount: purchase.amount_cents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: return_url || `${this.configService.get('FRONTEND_URL')}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancel_url || `${this.configService.get('FRONTEND_URL')}/payment/cancel`,
      metadata: {
        purchase_id: purchase.id,
        purchase_token: purchase.purchase_token,
        content_id: purchase.content_id,
        user_id: purchase.user_id || 'guest',
      },
      expires_at: Math.floor(Date.now() / 1000) + 1800, // 30 minutes
    });

    return {
      provider_payment_id: session.payment_intent as string,
      payment_url: session.url!,
      amount_cents: purchase.amount_cents,
      currency: 'BRL',
      metadata: {
        session_id: session.id,
        ...session.metadata,
      },
    };
  }

  async verifyWebhookSignature(
    payload: string,
    signature: string,
    secret?: string
  ): Promise<WebhookVerificationResult> {
    try {
      const webhookSecret = secret || this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
      if (!webhookSecret) {
        return {
          isValid: false,
          error: 'STRIPE_WEBHOOK_SECRET not configured',
        };
      }

      const event = this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);

      return {
        isValid: true,
        event,
      };
    } catch (error) {
      this.logger.error(`Stripe webhook verification failed: ${error.message}`);
      return {
        isValid: false,
        error: error.message,
      };
    }
  }

  async fetchPaymentStatus(paymentId: string): Promise<PaymentStatusResponse> {
    try {
      // Try to get as payment intent first
      let paymentIntent: Stripe.PaymentIntent;

      try {
        paymentIntent = await this.stripe.paymentIntents.retrieve(paymentId);
      } catch {
        // If not a payment intent, try as checkout session
        const session = await this.stripe.checkout.sessions.retrieve(paymentId);
        if (session.payment_intent) {
          paymentIntent = await this.stripe.paymentIntents.retrieve(session.payment_intent as string);
        } else {
          throw new Error('Payment intent not found in session');
        }
      }

      return {
        status: this.mapStripeStatusToPaymentStatus(paymentIntent.status),
        amount_paid: paymentIntent.amount_received || 0,
        paid_at: paymentIntent.status === 'succeeded' && paymentIntent.created
          ? new Date(paymentIntent.created * 1000)
          : undefined,
        failure_reason: paymentIntent.last_payment_error?.message,
        metadata: paymentIntent.metadata,
      };
    } catch (error) {
      if (error.type === 'StripeConnectionError') {
        this.logger.error(`Stripe connection error while fetching payment status (timeout/network): ${error.message}`);
      } else if (error.type === 'StripeAPIError') {
        this.logger.error(`Stripe API error while fetching payment status: ${error.message}`);
      } else {
        this.logger.error(`Error fetching payment status: ${error.message}`);
      }
      throw error;
    }
  }

  private mapStripeStatusToPaymentStatus(
    stripeStatus: Stripe.PaymentIntent.Status
  ): 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded' {
    switch (stripeStatus) {
      case 'succeeded':
        return 'paid';
      case 'canceled':
        return 'cancelled';
      case 'requires_confirmation':
      case 'requires_action':
      case 'processing':
      case 'requires_capture':
        return 'pending';
      case 'requires_payment_method':
        return 'failed';
      default:
        return 'pending';
    }
  }

  getProviderName(): string {
    return 'stripe';
  }

  /**
   * Helper method to get supported payment methods based on country/currency
   */
  getSupportedPaymentMethods(currency = 'brl'): PaymentMethod[] {
    if (currency.toLowerCase() === 'brl') {
      return [PaymentMethod.PIX, PaymentMethod.CARD];
    }
    return [PaymentMethod.CARD];
  }

  async refundPayment(paymentId: string, amount?: number, reason?: string): Promise<RefundResponse> {
    try {
      // Create refund using payment intent ID directly
      const refundParams: any = {
         payment_intent: paymentId,
         metadata: {
           payment_intent_id: paymentId,
         },
       };

      if (amount) {
        refundParams.amount = amount;
      }

      if (reason) {
        // Map custom reason to Stripe's allowed reasons
        const stripeReason = this.mapReasonToStripeReason(reason);
        if (stripeReason) {
          refundParams.reason = stripeReason;
        }
      } else {
        refundParams.reason = 'requested_by_customer';
      }

      const refund = await this.stripe.refunds.create(refundParams);

      return {
        refund_id: refund.id,
        amount_refunded: refund.amount,
        currency: refund.currency.toUpperCase(),
        status: this.mapStripeRefundStatus(refund.status),
        reason: refund.reason,
        metadata: refund.metadata,
      };
    } catch (error) {
      this.logger.error(`Failed to refund payment ${paymentId}:`, error.message);
      throw new Error(`Refund failed: ${error.message}`);
    }
  }

  private mapStripeRefundStatus(stripeStatus: string): 'pending' | 'succeeded' | 'failed' {
    switch (stripeStatus) {
      case 'succeeded':
        return 'succeeded';
      case 'pending':
        return 'pending';
      case 'failed':
      case 'canceled':
        return 'failed';
      default:
        return 'pending';
    }
  }

  private mapReasonToStripeReason(reason: string): string | null {
    const lowerReason = reason.toLowerCase();
    
    if (lowerReason.includes('duplicate')) {
      return 'duplicate';
    }
    if (lowerReason.includes('fraud')) {
      return 'fraudulent';
    }
    if (lowerReason.includes('customer') || lowerReason.includes('request')) {
      return 'requested_by_customer';
    }
    
    // Default to requested_by_customer for other cases
    return 'requested_by_customer';
  }

  /**
   * Helper method to format PIX payment instructions
   */
  formatPixInstructions(pix_key: string, amount_cents: number): string {
    const amount_reais = (amount_cents / 100).toFixed(2);
    return `
PIX - Instruções de Pagamento:
1. Abra seu app bancário
2. Acesse a função PIX
3. Escolha "PIX Copia e Cola" ou "PIX QR Code"
4. Use a chave: ${pix_key}
5. Valor: R$ ${amount_reais}
6. Confirme o pagamento

Atenção: O pagamento será confirmado automaticamente em poucos segundos.
    `.trim();
  }
}