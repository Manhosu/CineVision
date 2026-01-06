import { Injectable, Logger, forwardRef, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../../../config/supabase.service';
import { WooviService } from './woovi.service';
import { TelegramsEnhancedService } from '../../telegrams/telegrams-enhanced.service';

/**
 * Woovi webhook payload format
 * Documentation: https://developers.woovi.com/en/docs/webhook
 *
 * Event types:
 * - OPENPIX:CHARGE_CREATED
 * - OPENPIX:CHARGE_COMPLETED
 * - OPENPIX:CHARGE_EXPIRED
 * - OPENPIX:TRANSACTION_RECEIVED
 * - OPENPIX:TRANSACTION_REFUND_RECEIVED
 */
interface WooviWebhookPayload {
  event: string;
  charge?: {
    status: string;
    value: number;
    identifier: string;
    correlationID: string;
    transactionID?: string;
    brCode?: string;
    paidAt?: string;
    createdAt: string;
    updatedAt: string;
    customer?: {
      name?: string;
      email?: string;
      taxID?: {
        taxID: string;
        type: string;
      };
      correlationID?: string;
    };
    payer?: {
      name?: string;
      taxID?: {
        taxID: string;
        type: string;
      };
    };
  };
  pix?: {
    endToEndId: string;
    txid: string;
    value: number;
    time: string;
  };
}

@Injectable()
export class WooviWebhookService {
  private readonly logger = new Logger(WooviWebhookService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly supabaseService: SupabaseService,
    private readonly wooviService: WooviService,
    @Inject(forwardRef(() => TelegramsEnhancedService))
    private readonly telegramsService: TelegramsEnhancedService,
  ) {
    this.logger.log('WooviWebhookService initialized');
  }

  /**
   * Handle Woovi webhook notification
   * Documentation: https://developers.woovi.com/en/docs/webhook
   *
   * Woovi sends POST requests with these events:
   * - OPENPIX:CHARGE_COMPLETED - Payment confirmed
   * - OPENPIX:TRANSACTION_RECEIVED - PIX received
   */
  async handleWebhook(body: WooviWebhookPayload): Promise<void> {
    try {
      this.logger.log(`Received Woovi webhook: ${body.event}`);
      this.logger.debug(`Webhook body: ${JSON.stringify(body)}`);

      // Handle different event types
      switch (body.event) {
        case 'OPENPIX:CHARGE_COMPLETED':
        case 'OPENPIX:TRANSACTION_RECEIVED':
          await this.handlePaymentReceived(body);
          break;

        case 'OPENPIX:CHARGE_EXPIRED':
          await this.handlePaymentExpired(body);
          break;

        case 'OPENPIX:TRANSACTION_REFUND_RECEIVED':
          await this.handleRefund(body);
          break;

        case 'OPENPIX:CHARGE_CREATED':
          // Just log, no action needed
          this.logger.log(`Charge created: ${body.charge?.correlationID}`);
          break;

        default:
          this.logger.log(`Unhandled webhook event: ${body.event}`);
      }
    } catch (error) {
      this.logger.error(`Error processing webhook: ${error.message}`, error.stack);
      // Don't throw - we don't want to return 500 to Woovi
    }
  }

  /**
   * Handle payment received event
   */
  private async handlePaymentReceived(body: WooviWebhookPayload): Promise<void> {
    const correlationID = body.charge?.correlationID;

    if (!correlationID) {
      this.logger.warn('Webhook received without correlationID');
      return;
    }

    this.logger.log(`Processing payment - correlationID: ${correlationID}`);

    // Find payment in our database
    // Retry logic for race condition when webhook arrives before DB commit completes
    let dbPayment: any = null;
    let retries = 3;

    while (retries > 0 && !dbPayment) {
      const { data, error } = await this.supabaseService.client
        .from('payments')
        .select('*, purchases(*)')
        .eq('provider_payment_id', correlationID)
        .eq('provider', 'woovi')
        .single();

      if (data) {
        dbPayment = data;
        break;
      }

      if (retries > 1) {
        this.logger.log(`Payment ${correlationID} not found, retrying in 500ms... (${retries - 1} retries left)`);
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      retries--;
    }

    if (!dbPayment) {
      this.logger.warn(`Payment ${correlationID} not found in database after retries`);
      return;
    }

    // IDEMPOTENCY CHECK: If payment already processed, skip
    if (dbPayment.status === 'pago') {
      this.logger.log(`Payment ${correlationID} already processed as paid - skipping (idempotency)`);
      return;
    }

    // Process the payment
    await this.handlePaymentApproved(dbPayment, {
      correlationID,
      transactionID: body.charge?.transactionID,
      paidAt: body.charge?.paidAt || body.pix?.time,
      endToEndId: body.pix?.endToEndId,
    });
  }

  /**
   * Handle approved payment
   */
  private async handlePaymentApproved(
    dbPayment: any,
    paymentData: { correlationID: string; transactionID?: string; paidAt?: string; endToEndId?: string }
  ): Promise<void> {
    try {
      this.logger.log(`Payment ${dbPayment.id} approved! Processing...`);

      // Update payment status
      const { error: paymentError } = await this.supabaseService.client
        .from('payments')
        .update({
          status: 'pago',
          paid_at: new Date().toISOString(),
          provider_meta: {
            ...dbPayment.provider_meta,
            transactionID: paymentData.transactionID,
            endToEndId: paymentData.endToEndId,
            paidAt: paymentData.paidAt,
          },
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
          status: 'pago',
        })
        .eq('id', dbPayment.purchase_id);

      if (purchaseError) {
        this.logger.error(`Failed to update purchase: ${purchaseError.message}`);
        throw purchaseError;
      }

      this.logger.log(`Payment ${dbPayment.id} successfully processed - Purchase ${dbPayment.purchase_id} is now PAID`);

      // Increment content sales counters
      try {
        const { data: purchase } = await this.supabaseService.client
          .from('purchases')
          .select('content_id, content(weekly_sales, total_sales, purchases_count)')
          .eq('id', dbPayment.purchase_id)
          .single();

        if (purchase && purchase.content_id) {
          this.logger.log(`Incrementing sales counters for content ${purchase.content_id}`);

          const { error: rpcError } = await this.supabaseService.client.rpc('increment_content_sales', {
            content_id: purchase.content_id,
          });

          if (rpcError) {
            this.logger.warn('RPC increment_content_sales not found, using manual update');
            const content = Array.isArray(purchase.content) ? purchase.content[0] : purchase.content;
            await this.supabaseService.client
              .from('content')
              .update({
                weekly_sales: (content?.weekly_sales || 0) + 1,
                total_sales: (content?.total_sales || 0) + 1,
                purchases_count: (content?.purchases_count || 0) + 1,
              })
              .eq('id', purchase.content_id);
          }
        }
      } catch (salesError) {
        this.logger.error(`Failed to increment sales counters: ${salesError.message}`);
      }

      // Deliver content to user via Telegram
      try {
        this.logger.log(`Delivering content for purchase ${dbPayment.purchase_id} to user...`);

        const { data: fullPurchase, error: fetchError } = await this.supabaseService.client
          .from('purchases')
          .select('*, content(*)')
          .eq('id', dbPayment.purchase_id)
          .single();

        if (fetchError || !fullPurchase) {
          throw new Error(`Failed to fetch purchase details: ${fetchError?.message}`);
        }

        await this.telegramsService.deliverContentAfterPayment(fullPurchase);

        this.logger.log(`Content successfully delivered for purchase ${dbPayment.purchase_id}`);
      } catch (deliveryError) {
        this.logger.error(`Failed to deliver content for purchase ${dbPayment.purchase_id}: ${deliveryError.message}`);

        await this.supabaseService.client.from('system_logs').insert({
          type: 'delivery_failed',
          level: 'error',
          message: `Failed to deliver content for purchase ${dbPayment.purchase_id} after payment approval: ${deliveryError.message}`,
          metadata: {
            purchase_id: dbPayment.purchase_id,
            payment_id: dbPayment.id,
            error: deliveryError.message,
          },
          created_at: new Date().toISOString(),
        });
      }
    } catch (error) {
      this.logger.error(`Error handling approved payment: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Handle payment expired event
   */
  private async handlePaymentExpired(body: WooviWebhookPayload): Promise<void> {
    const correlationID = body.charge?.correlationID;

    if (!correlationID) {
      return;
    }

    this.logger.log(`Payment expired: ${correlationID}`);

    const { error } = await this.supabaseService.client
      .from('payments')
      .update({
        status: 'expirado',
      })
      .eq('provider_payment_id', correlationID)
      .eq('provider', 'woovi');

    if (error) {
      this.logger.error(`Failed to update expired payment: ${error.message}`);
    }
  }

  /**
   * Handle refund event
   */
  private async handleRefund(body: WooviWebhookPayload): Promise<void> {
    const correlationID = body.charge?.correlationID;

    if (!correlationID) {
      return;
    }

    this.logger.log(`Refund received for: ${correlationID}`);

    const { error } = await this.supabaseService.client
      .from('payments')
      .update({
        status: 'reembolsado',
        provider_meta: {
          refund: body.pix,
        },
      })
      .eq('provider_payment_id', correlationID)
      .eq('provider', 'woovi');

    if (error) {
      this.logger.error(`Failed to update refunded payment: ${error.message}`);
    }
  }

  /**
   * Verify webhook signature
   * Woovi sends signature in x-webhook-signature header
   */
  verifyWebhook(signature: string | undefined, payload: string): boolean {
    const webhookSecret = this.configService.get('WOOVI_WEBHOOK_SECRET');

    // If no secret configured, skip verification (dev mode)
    if (!webhookSecret) {
      this.logger.log('Webhook secret not configured, skipping signature verification');
      return true;
    }

    if (!signature) {
      this.logger.warn('No signature provided for webhook verification');
      return false;
    }

    return this.wooviService.verifyWebhookSignature(payload, signature);
  }
}
