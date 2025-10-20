import { Injectable, Logger, NotFoundException, BadRequestException, Inject, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../../config/supabase.service';
import { StripeService } from './services/stripe.service';
import { PixQRCodeService } from './services/pix-qrcode.service';
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
    private readonly pixQRCodeService: PixQRCodeService,
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
   * Create PIX payment with QR Code
   */
  async createPixPayment(purchaseId: string): Promise<any> {
    try {
      this.logger.log(`Creating PIX payment for purchase ${purchaseId}`);

      // Find purchase in Supabase
      const { data: purchase, error: purchaseError } = await this.supabaseService.client
        .from('purchases')
        .select('*, content(*)')
        .eq('id', purchaseId)
        .single();

      if (purchaseError || !purchase) {
        throw new NotFoundException(`Purchase with ID ${purchaseId} not found`);
      }

      if (purchase.status === 'COMPLETED' || purchase.status === 'paid') {
        throw new BadRequestException('Purchase is already paid');
      }

      // Get PIX settings from admin_settings
      const { data: pixKeyData } = await this.supabaseService.client
        .from('admin_settings')
        .select('value')
        .eq('key', 'pix_key')
        .single();

      const { data: merchantNameData } = await this.supabaseService.client
        .from('admin_settings')
        .select('value')
        .eq('key', 'merchant_name')
        .single();

      const { data: merchantCityData } = await this.supabaseService.client
        .from('admin_settings')
        .select('value')
        .eq('key', 'merchant_city')
        .single();

      const pixKey = pixKeyData?.value;
      if (!pixKey) {
        throw new BadRequestException('PIX key not configured. Please configure it in admin settings.');
      }

      const merchantName = merchantNameData?.value || 'Cine Vision';
      const merchantCity = merchantCityData?.value || 'SAO PAULO';

      // Validate PIX key
      const validation = this.pixQRCodeService.validatePixKey(pixKey);
      if (!validation.valid) {
        throw new BadRequestException(`Invalid PIX key: ${validation.error}`);
      }

      // Generate unique transaction ID
      const transactionId = `CIN${Date.now()}${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

      // Generate PIX QR Code
      const qrCodeData = this.pixQRCodeService.generatePixQRCode({
        pixKey,
        merchantName,
        merchantCity,
        amount: purchase.amount_cents / 100, // Convert cents to reais
        transactionId,
        description: `${purchase.content.title}`,
      });

      // Generate QR Code image
      let qrCodeImage: string | undefined;
      try {
        qrCodeImage = await this.pixQRCodeService.generateQRCodeImage(qrCodeData.qrCodeText);
      } catch (error) {
        this.logger.warn('Could not generate QR Code image:', error.message);
      }

      // Create payment record in Supabase
      // Prepare user_id - convert to UUID or use a default for guest purchases
      let paymentUserId = purchase.user_id;
      if (!paymentUserId) {
        // For guest purchases, create a temporary UUID to satisfy NOT NULL constraint
        // This will be associated with the purchase via purchase_id in provider_meta
        paymentUserId = '00000000-0000-0000-0000-000000000000';
      }

      const { data: payment, error: paymentError } = await this.supabaseService.client
        .from('payments')
        .insert({
          user_id: paymentUserId,
          movie_id: purchase.content_id,
          amount: (purchase.amount_cents / 100).toString(),
          currency: purchase.currency,
          payment_method: 'pix',
          payment_status: 'pending',
          stripe_payment_intent_id: transactionId,
          provider_meta: {
            purchase_id: purchase.id,
            transaction_id: transactionId,
            pix_key: pixKey,
            qr_code_emv: qrCodeData.qrCodeText,
            qr_code_image: qrCodeImage,
            amount_cents: purchase.amount_cents,
            currency: purchase.currency,
            payment_method: 'pix',
          },
        })
        .select()
        .single();

      if (paymentError) {
        this.logger.error('Error creating PIX payment record:', paymentError);
        throw new BadRequestException('Failed to create PIX payment');
      }

      this.logger.log(`PIX payment created successfully: ${transactionId}`);

      return {
        provider_payment_id: transactionId,
        payment_method: 'pix',
        qr_code_text: qrCodeData.qrCodeText,
        qr_code_image: qrCodeImage,
        copy_paste_code: qrCodeData.copyPasteCode,
        amount_cents: purchase.amount_cents,
        amount_brl: (purchase.amount_cents / 100).toFixed(2),
        currency: purchase.currency,
        purchase_id: purchase.id,
        provider: 'pix',
        expires_in: 3600, // 1 hour
        created_at: new Date(),
        payment_instructions: 'Abra seu aplicativo bancário, escaneie o QR Code ou copie e cole o código PIX para efetuar o pagamento.',
      };
    } catch (error) {
      this.logger.error(`Error creating PIX payment for purchase ${purchaseId}:`, error);
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
