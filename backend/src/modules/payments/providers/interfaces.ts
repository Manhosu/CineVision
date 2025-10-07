import { Purchase } from '../../purchases/entities/purchase.entity';

export interface PaymentIntent {
  provider_payment_id: string;
  payment_url?: string; // For hosted pages (card payments)
  payment_data?: any; // PIX QR code, instructions, etc.
  amount_cents: number;
  currency: string;
  metadata?: Record<string, any>;
}

export interface PaymentStatusResponse {
  status: 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded';
  amount_paid?: number;
  paid_at?: Date;
  failure_reason?: string;
  metadata?: Record<string, any>;
}

export interface RefundResponse {
  refund_id: string;
  amount_refunded: number;
  currency: string;
  status: 'pending' | 'succeeded' | 'failed';
  reason?: string;
  metadata?: Record<string, any>;
}

export interface WebhookVerificationResult {
  isValid: boolean;
  event?: any;
  error?: string;
}

export enum PaymentMethod {
  PIX = 'pix',
  CARD = 'card',
}

export interface CreatePaymentIntentOptions {
  purchase: Purchase;
  payment_method: PaymentMethod;
  return_url?: string;
  cancel_url?: string;
  pix_key?: string; // For PIX payments
}

export interface PaymentProvider {
  /**
   * Creates a payment intent with the payment provider
   */
  createPaymentIntent(options: CreatePaymentIntentOptions): Promise<PaymentIntent>;

  /**
   * Verifies webhook signature from payment provider
   */
  verifyWebhookSignature(
    payload: string,
    signature: string,
    secret: string
  ): Promise<WebhookVerificationResult>;

  /**
   * Fetches payment status from provider
   */
  fetchPaymentStatus(paymentId: string): Promise<PaymentStatusResponse>;

  /**
   * Gets provider name
   */
  getProviderName(): string;

  /**
   * Processes a refund for a payment
   */
  refundPayment(paymentId: string, amount?: number, reason?: string): Promise<RefundResponse>;
}