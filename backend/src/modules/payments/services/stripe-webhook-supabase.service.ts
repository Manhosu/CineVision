import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import { SupabaseService } from '../../../config/supabase.service';
import { TelegramsEnhancedService } from '../../telegrams/telegrams-enhanced.service';

@Injectable()
export class StripeWebhookSupabaseService {
  private readonly logger = new Logger(StripeWebhookSupabaseService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly telegramsService: TelegramsEnhancedService,
  ) {}

  private get supabase() {
    return this.supabaseService.client;
  }

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
    const purchaseToken = metadata?.purchase_token;

    if (!purchaseId && !purchaseToken) {
      this.logger.warn(`No purchase_id or purchase_token in payment intent metadata: ${paymentIntent.id}`);
      return;
    }

    try {
      // Find purchase by ID or token
      let query = this.supabase
        .from('purchases')
        .select('*, content(*)');

      if (purchaseId) {
        query = query.eq('id', purchaseId);
      } else if (purchaseToken) {
        query = query.eq('purchase_token', purchaseToken);
      }

      const { data: purchase, error: purchaseError } = await query.single();

      if (purchaseError || !purchase) {
        this.logger.error(`Purchase not found for payment intent ${paymentIntent.id}`);
        return;
      }

      // Detect payment method (card or PIX)
      const paymentMethodType = paymentIntent.payment_method_types?.[0] || 'card';
      const isPix = paymentMethodType === 'pix';

      this.logger.log(`Payment method detected: ${paymentMethodType} (isPix: ${isPix})`);

      // Update purchase to PAID status
      const { error: updateError } = await this.supabase
        .from('purchases')
        .update({
          status: 'paid',
          payment_provider_id: paymentIntent.id,
          payment_method: isPix ? 'pix' : 'card', // Detect if PIX or card
          provider_meta: {
            ...metadata,
            payment_method_type: paymentMethodType,
            stripe_payment_method: paymentIntent.payment_method,
          },
          access_expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year from now
          updated_at: new Date().toISOString(),
        })
        .eq('id', purchase.id);

      if (updateError) {
        this.logger.error(`Failed to update purchase ${purchase.id}: ${updateError.message}`);
        return;
      }

      // Increment sales counters for content
      if (purchase.content_id) {
        // Try to use RPC, fall back to manual update if it fails
        const { error: rpcError } = await this.supabase.rpc('increment_content_sales', {
          content_id: purchase.content_id,
        });

        if (rpcError) {
          // If RPC doesn't exist, manually increment
          this.logger.warn('RPC increment_content_sales not found, using manual update');
          await this.supabase
            .from('content')
            .update({
              weekly_sales: (purchase.content?.weekly_sales || 0) + 1,
              total_sales: (purchase.content?.total_sales || 0) + 1,
              purchases_count: (purchase.content?.purchases_count || 0) + 1,
            })
            .eq('id', purchase.content_id);
        }
      }

      // Log successful payment
      await this.supabase
        .from('system_logs')
        .insert({
          type: 'payment',
          level: 'info',
          message: `Payment succeeded for purchase ${purchase.id}`,
          meta: {
            purchase_id: purchase.id,
            payment_intent_id: paymentIntent.id,
            amount: paymentIntent.amount,
            currency: paymentIntent.currency,
          },
        });

      this.logger.log(`Purchase ${purchase.id} marked as PAID`);

      // Deliver content via Telegram bot automatically
      try {
        // Re-fetch purchase with content
        const { data: purchaseWithContent } = await this.supabase
          .from('purchases')
          .select('*, content(*)')
          .eq('id', purchase.id)
          .single();

        if (purchaseWithContent && purchaseWithContent.user_id) {
          // Get user's telegram_chat_id
          const { data: user } = await this.supabase
            .from('users')
            .select('telegram_chat_id')
            .eq('id', purchaseWithContent.user_id)
            .single();

          if (user?.telegram_chat_id) {
            // Ensure provider_meta has telegram_chat_id for delivery function
            const purchaseWithTelegramId = {
              ...purchaseWithContent,
              provider_meta: {
                ...purchaseWithContent.provider_meta,
                telegram_chat_id: user.telegram_chat_id,
              },
            };

            // Call the function that sends video links and options to user
            await this.telegramsService['deliverContentAfterPayment'](purchaseWithTelegramId);
            this.logger.log(`Content delivery initiated for purchase ${purchase.id} to chat ${user.telegram_chat_id}`);
          } else {
            this.logger.warn(`No telegram_chat_id found for user ${purchaseWithContent.user_id}`);

            // Notify admin about missing telegram_chat_id
            await this.telegramsService['notifyDeliveryFailure'](
              purchaseWithContent,
              new Error('No telegram_chat_id found for user')
            );

            // Log to failed_deliveries for manual retry
            await this.supabase
              .from('system_logs')
              .insert({
                type: 'delivery_failed',
                level: 'error',
                message: `No telegram_chat_id found for user ${purchaseWithContent.user_id}`,
                meta: {
                  purchase_id: purchase.id,
                  user_id: purchaseWithContent.user_id,
                  content_id: purchaseWithContent.content_id,
                  reason: 'missing_telegram_chat_id',
                },
              });
          }
        }
      } catch (error) {
        this.logger.error(`Failed to deliver content via Telegram: ${error.message}`);

        // Notify admin about delivery failure
        try {
          const { data: purchaseData } = await this.supabase
            .from('purchases')
            .select('*, content(*)')
            .eq('id', purchase.id)
            .single();

          if (purchaseData) {
            await this.telegramsService['notifyDeliveryFailure'](purchaseData, error);
          }

          // Log to failed_deliveries for manual retry
          await this.supabase
            .from('system_logs')
            .insert({
              type: 'delivery_failed',
              level: 'error',
              message: `Content delivery failed: ${error.message}`,
              meta: {
                purchase_id: purchase.id,
                error: error.message,
                stack: error.stack,
                reason: 'delivery_exception',
              },
            });
        } catch (notifyError) {
          this.logger.error(`Failed to send admin notification: ${notifyError.message}`);
        }

        // Don't fail the webhook if content delivery fails
      }
    } catch (error) {
      this.logger.error(`Error handling payment intent succeeded: ${error.message}`, error.stack);
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
      // Update purchase to FAILED status
      await this.supabase
        .from('purchases')
        .update({
          status: 'failed',
          payment_provider_id: paymentIntent.id,
          provider_meta: {
            ...metadata,
            failure_message: paymentIntent.last_payment_error?.message,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', purchaseId);

      // Log failed payment
      await this.supabase
        .from('system_logs')
        .insert({
          type: 'payment',
          level: 'error',
          message: `Payment failed for purchase ${purchaseId}`,
          meta: {
            purchase_id: purchaseId,
            payment_intent_id: paymentIntent.id,
            error: paymentIntent.last_payment_error?.message,
          },
        });

      this.logger.log(`Purchase ${purchaseId} marked as FAILED`);
    } catch (error) {
      this.logger.error(`Error handling payment intent failed: ${error.message}`, error.stack);
    }
  }

  private async handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
    this.logger.log(`Checkout session completed: ${session.id}`);

    const metadata = session.metadata;
    const purchaseId = metadata?.purchase_id;
    const purchaseToken = metadata?.purchase_token;

    if (!purchaseId && !purchaseToken) {
      this.logger.warn(`No purchase info in checkout session metadata: ${session.id}`);
      return;
    }

    try {
      // Find purchase
      let query = this.supabase
        .from('purchases')
        .select('*, content(*)');

      if (purchaseId) {
        query = query.eq('id', purchaseId);
      } else if (purchaseToken) {
        query = query.eq('purchase_token', purchaseToken);
      }

      const { data: purchase, error: purchaseError } = await query.single();

      if (purchaseError || !purchase) {
        this.logger.error(`Purchase not found for checkout session ${session.id}`);
        return;
      }

      // Update purchase with session info
      await this.supabase
        .from('purchases')
        .update({
          provider_meta: {
            ...purchase.provider_meta,
            checkout_session_id: session.id,
            payment_status: session.payment_status,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', purchase.id);

      this.logger.log(`Checkout session info saved for purchase ${purchase.id}`);
    } catch (error) {
      this.logger.error(`Error handling checkout session completed: ${error.message}`, error.stack);
    }
  }

  private async handleChargeRefunded(charge: Stripe.Charge) {
    this.logger.log(`Charge refunded: ${charge.id}`);

    try {
      // Find purchase by payment_provider_id
      const { data: purchase, error } = await this.supabase
        .from('purchases')
        .select('*')
        .eq('payment_provider_id', charge.payment_intent as string)
        .single();

      if (error || !purchase) {
        this.logger.warn(`Purchase not found for charge ${charge.id}`);
        return;
      }

      // Update purchase to REFUNDED status
      await this.supabase
        .from('purchases')
        .update({
          status: 'refunded',
          access_expires_at: new Date().toISOString(), // Immediately expire access
          provider_meta: {
            ...purchase.provider_meta,
            refund_id: charge.refunds?.data[0]?.id,
            refund_reason: charge.refunds?.data[0]?.reason,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', purchase.id);

      // Log refund
      await this.supabase
        .from('system_logs')
        .insert({
          type: 'payment',
          level: 'warn',
          message: `Payment refunded for purchase ${purchase.id}`,
          meta: {
            purchase_id: purchase.id,
            charge_id: charge.id,
            refund_amount: charge.amount_refunded,
          },
        });

      this.logger.log(`Purchase ${purchase.id} marked as REFUNDED`);
    } catch (error) {
      this.logger.error(`Error handling charge refunded: ${error.message}`, error.stack);
    }
  }
}
