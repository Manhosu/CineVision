import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../../../config/supabase.service';
import { MercadoPagoService } from './mercado-pago.service';

@Injectable()
export class MercadoPagoWebhookService {
  private readonly logger = new Logger(MercadoPagoWebhookService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly supabaseService: SupabaseService,
    private readonly mercadoPagoService: MercadoPagoService,
  ) {
    this.logger.log('MercadoPagoWebhookService initialized');
  }

  /**
   * Handle Mercado Pago webhook notification
   * Documentation: https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
   */
  async handleWebhook(body: any): Promise<void> {
    try {
      this.logger.log(`Received Mercado Pago webhook: ${JSON.stringify(body)}`);

      // Mercado Pago sends different types of notifications
      const { type, action, data } = body;

      // We only care about payment notifications
      if (type === 'payment' || action === 'payment.created' || action === 'payment.updated') {
        const paymentId = data?.id || body.id;

        if (!paymentId) {
          this.logger.warn('Webhook received without payment ID');
          return;
        }

        this.logger.log(`Processing payment notification for ID: ${paymentId}`);

        // Get payment details from Mercado Pago
        const payment = await this.mercadoPagoService.getPayment(String(paymentId));

        this.logger.log(`Payment ${paymentId} status: ${payment.status}`);

        // Find payment in our database
        const { data: dbPayment, error } = await this.supabaseService.client
          .from('payments')
          .select('*, purchases(*)')
          .eq('provider_payment_id', String(paymentId))
          .eq('provider', 'mercadopago')
          .single();

        if (error || !dbPayment) {
          this.logger.warn(`Payment ${paymentId} not found in database`);
          return;
        }

        // Check if payment is approved
        if (payment.status === 'approved') {
          await this.handlePaymentApproved(dbPayment, payment);
        } else if (payment.status === 'cancelled' || payment.status === 'rejected') {
          await this.handlePaymentFailed(dbPayment, payment);
        } else if (payment.status === 'in_process') {
          await this.handlePaymentPending(dbPayment, payment);
        }
      }
    } catch (error) {
      this.logger.error(`Error processing webhook: ${error.message}`, error.stack);
      // Don't throw - we don't want to return 500 to Mercado Pago
      // They will retry if we return 500, creating duplicate notifications
    }
  }

  /**
   * Handle approved payment
   */
  private async handlePaymentApproved(dbPayment: any, mpPayment: any): Promise<void> {
    try {
      this.logger.log(`Payment ${dbPayment.id} approved! Processing...`);

      // Update payment status
      const { error: paymentError } = await this.supabaseService.client
        .from('payments')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
        })
        .eq('id', dbPayment.id);

      if (paymentError) {
        this.logger.error(`Failed to update payment: ${paymentError.message}`);
        throw paymentError;
      }

      // Update purchase status
      const { error: purchaseError } = await this.supabaseService.client
        .from('purchases')
        .update({
          status: 'paid',
        })
        .eq('id', dbPayment.purchase_id);

      if (purchaseError) {
        this.logger.error(`Failed to update purchase: ${purchaseError.message}`);
        throw purchaseError;
      }

      this.logger.log(`✅ Payment ${dbPayment.id} successfully processed - Purchase ${dbPayment.purchase_id} is now PAID`);

      // The Telegram bot will automatically deliver the content when it detects the purchase is paid
    } catch (error) {
      this.logger.error(`Error handling approved payment: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Handle failed payment
   */
  private async handlePaymentFailed(dbPayment: any, mpPayment: any): Promise<void> {
    try {
      this.logger.log(`Payment ${dbPayment.id} failed/cancelled`);

      // Update payment status
      const { error } = await this.supabaseService.client
        .from('payments')
        .update({
          status: 'failed',
        })
        .eq('id', dbPayment.id);

      if (error) {
        this.logger.error(`Failed to update payment: ${error.message}`);
        throw error;
      }

      this.logger.log(`❌ Payment ${dbPayment.id} marked as failed`);
    } catch (error) {
      this.logger.error(`Error handling failed payment: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Handle pending payment
   */
  private async handlePaymentPending(dbPayment: any, mpPayment: any): Promise<void> {
    try {
      this.logger.log(`Payment ${dbPayment.id} is pending`);

      // Update payment status if needed
      if (dbPayment.status !== 'pending') {
        const { error } = await this.supabaseService.client
          .from('payments')
          .update({
            status: 'pending',
          })
          .eq('id', dbPayment.id);

        if (error) {
          this.logger.error(`Failed to update payment: ${error.message}`);
        }
      }

      this.logger.log(`⏳ Payment ${dbPayment.id} is still pending`);
    } catch (error) {
      this.logger.error(`Error handling pending payment: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Verify webhook signature (recommended for production)
   * Documentation: https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/additional-info
   */
  verifySignature(signature: string, body: string): boolean {
    try {
      // TODO: Implement signature verification
      // For now, we'll accept all webhooks
      // In production, you should verify the x-signature header
      return true;
    } catch (error) {
      this.logger.error(`Signature verification failed: ${error.message}`);
      return false;
    }
  }
}
