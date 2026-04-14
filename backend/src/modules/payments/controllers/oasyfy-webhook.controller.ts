import { Controller, Post, Body, Logger, HttpCode } from '@nestjs/common';
import { OasyfyService, OasyfyWebhookPayload } from '../services/oasyfy.service';
import { SupabaseService } from '../../../config/supabase.service';

@Controller('api/v1/webhooks')
export class OasyfyWebhookController {
  private readonly logger = new Logger(OasyfyWebhookController.name);

  constructor(
    private readonly oasyfyService: OasyfyService,
    private readonly supabaseService: SupabaseService,
  ) {}

  @Post('oasyfy')
  @HttpCode(200)
  async handleWebhook(@Body() payload: OasyfyWebhookPayload) {
    this.logger.log(`Oasyfy webhook received: ${payload.event} | Transaction: ${payload.transaction?.id}`);

    // Verify webhook token
    if (!this.oasyfyService.verifyWebhookToken(payload.token)) {
      this.logger.warn(`Invalid webhook token received: ${payload.token}`);
      return { received: true, valid: false };
    }

    try {
      switch (payload.event) {
        case 'TRANSACTION_PAID':
          await this.handleTransactionPaid(payload);
          break;
        case 'TRANSACTION_CANCELED':
          await this.handleTransactionCanceled(payload);
          break;
        case 'TRANSACTION_REFUNDED':
          await this.handleTransactionRefunded(payload);
          break;
        case 'TRANSACTION_CREATED':
          this.logger.log(`Transaction created: ${payload.transaction?.id}`);
          break;
        default:
          this.logger.log(`Unhandled event: ${payload.event}`);
      }

      return { received: true, valid: true };
    } catch (error) {
      this.logger.error(`Error processing webhook: ${error.message}`);
      return { received: true, error: error.message };
    }
  }

  private async handleTransactionPaid(payload: OasyfyWebhookPayload) {
    const transactionId = payload.transaction?.id;
    this.logger.log(`Transaction PAID: ${transactionId}`);

    // Find payment by provider_payment_id
    const { data: payment, error: paymentError } = await this.supabaseService.client
      .from('payments')
      .select('id, purchase_id, status')
      .eq('provider_payment_id', transactionId)
      .single();

    if (paymentError || !payment) {
      this.logger.error(`Payment not found for transaction ${transactionId}`);
      return;
    }

    if (payment.status === 'completed') {
      this.logger.log(`Payment ${payment.id} already completed, skipping`);
      return;
    }

    // Update payment status
    await this.supabaseService.client
      .from('payments')
      .update({
        status: 'completed',
        processed_at: new Date().toISOString(),
        webhook_payload: payload,
      })
      .eq('id', payment.id);

    // Update purchase status
    await this.supabaseService.client
      .from('purchases')
      .update({
        status: 'PAID',
        payment_confirmed_at: new Date().toISOString(),
      })
      .eq('id', payment.purchase_id);

    // Increment weekly_sales for the content
    const { data: purchase } = await this.supabaseService.client
      .from('purchases')
      .select('content_id, amount_cents')
      .eq('id', payment.purchase_id)
      .single();

    if (purchase?.content_id) {
      // Increment weekly_sales
      const { data: content } = await this.supabaseService.client
        .from('content')
        .select('weekly_sales')
        .eq('id', purchase.content_id)
        .single();

      if (content) {
        await this.supabaseService.client
          .from('content')
          .update({ weekly_sales: (content.weekly_sales || 0) + 1 })
          .eq('id', purchase.content_id);
      }
    }

    this.logger.log(`Payment ${payment.id} and purchase ${payment.purchase_id} marked as PAID`);

    // Notify bot of payment
    try {
      const apiUrl = process.env.API_URL || 'https://cinevisionn.onrender.com';
      const axios = require('axios');
      await axios.post(`${apiUrl}/api/v1/purchases/${payment.purchase_id}/notify-bot`, {
        status: 'PAID',
      }).catch(() => {});
    } catch (e) {
      // Bot notification is best-effort
    }
  }

  private async handleTransactionCanceled(payload: OasyfyWebhookPayload) {
    const transactionId = payload.transaction?.id;
    this.logger.log(`Transaction CANCELED: ${transactionId}`);

    const { data: payment } = await this.supabaseService.client
      .from('payments')
      .select('id, purchase_id')
      .eq('provider_payment_id', transactionId)
      .single();

    if (payment) {
      await this.supabaseService.client
        .from('payments')
        .update({ status: 'cancelled', webhook_payload: payload })
        .eq('id', payment.id);

      await this.supabaseService.client
        .from('purchases')
        .update({ status: 'failed' })
        .eq('id', payment.purchase_id);
    }
  }

  private async handleTransactionRefunded(payload: OasyfyWebhookPayload) {
    const transactionId = payload.transaction?.id;
    this.logger.log(`Transaction REFUNDED: ${transactionId}`);

    const { data: payment } = await this.supabaseService.client
      .from('payments')
      .select('id, purchase_id')
      .eq('provider_payment_id', transactionId)
      .single();

    if (payment) {
      await this.supabaseService.client
        .from('payments')
        .update({
          status: 'refunded',
          refunded_at: new Date().toISOString(),
          webhook_payload: payload,
        })
        .eq('id', payment.id);

      await this.supabaseService.client
        .from('purchases')
        .update({ status: 'refunded' })
        .eq('id', payment.purchase_id);
    }
  }
}
