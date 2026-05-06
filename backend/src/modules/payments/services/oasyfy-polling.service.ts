import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OasyfyService } from './oasyfy.service';
import { SupabaseService } from '../../../config/supabase.service';
import { OrdersService } from '../../orders/orders.service';

/**
 * N15 (Igor 04/05): Igor reportou cliente que pagou PIX, comprovante OK,
 * mas sistema mostra "pendente". Causa: webhook da Oasyfy pode falhar
 * (Render reiniciando, Oasyfy com problema, etc) e o cliente fica sem
 * acesso até alguém intervir manualmente.
 *
 * Esse serviço roda a cada 2min, pega `payments` PIX `pending` criados
 * há mais de 5min e <24h, e consulta a Oasyfy diretamente via
 * `getPaymentStatus`. Se Oasyfy diz que está pago, replicamos o mesmo
 * fluxo do webhook: update payment → update purchase → notify bot.
 *
 * Cap de 5min de idade: cliente recém-pagou pode ainda não ter o status
 * propagado na Oasyfy — esperar evita race + desperdício de API call.
 *
 * Cap de 24h: depois disso o purchases-cleanup service expira o purchase
 * automaticamente; não vale ressuscitar.
 */
@Injectable()
export class OasyfyPollingService {
  private readonly logger = new Logger(OasyfyPollingService.name);

  constructor(
    private readonly oasyfyService: OasyfyService,
    private readonly supabaseService: SupabaseService,
    @Optional() @Inject(OrdersService) private readonly ordersService?: OrdersService,
  ) {}

  // 2-minute interval — não tem CronExpression.EVERY_2_MINUTES nativo,
  // mas o `@Cron` aceita expression cron raw.
  @Cron('*/2 * * * *')
  async pollPendingOasyfyPayments() {
    try {
      const now = Date.now();
      const olderThan = new Date(now - 5 * 60 * 1000).toISOString();
      const youngerThan = new Date(now - 24 * 60 * 60 * 1000).toISOString();

      const { data: payments, error } = await this.supabaseService.client
        .from('payments')
        .select('id, purchase_id, provider_payment_id, provider_meta, created_at')
        .eq('payment_method', 'pix')
        .eq('status', 'pending')
        .lt('created_at', olderThan)
        .gt('created_at', youngerThan)
        .limit(50);

      if (error) {
        this.logger.error(`Failed to query pending Oasyfy payments: ${error.message}`);
        return;
      }
      if (!payments || payments.length === 0) return;

      this.logger.log(`Polling ${payments.length} pending Oasyfy payment(s) older than 5min`);

      for (const payment of payments) {
        if (!payment.provider_payment_id) continue;
        try {
          const status = await this.oasyfyService.getPaymentStatus(payment.provider_payment_id);
          if (status.status === 'approved') {
            this.logger.log(
              `Oasyfy says payment ${payment.id} (tx=${payment.provider_payment_id}) is APPROVED — webhook missed it. Reconciling.`,
            );
            await this.reconcilePaidPayment(payment);
          } else if (status.status === 'cancelled' || status.status === 'expired') {
            this.logger.log(
              `Oasyfy says payment ${payment.id} (tx=${payment.provider_payment_id}) is ${status.status} — marking failed`,
            );
            await this.supabaseService.client
              .from('payments')
              .update({ status: status.status === 'cancelled' ? 'cancelled' : 'expired' })
              .eq('id', payment.id);
            if (payment.purchase_id) {
              await this.supabaseService.client
                .from('purchases')
                .update({ status: 'failed' })
                .eq('id', payment.purchase_id);
            }
          }
          // 'pending' → continua aguardando, não faz nada.
        } catch (err: any) {
          this.logger.warn(
            `Failed to poll payment ${payment.id} (tx=${payment.provider_payment_id}): ${err.message}`,
          );
        }
      }
    } catch (err: any) {
      this.logger.error(`pollPendingOasyfyPayments crashed: ${err.message}`);
    }
  }

  /**
   * Replica o fluxo de TRANSACTION_PAID do webhook quando descobrimos
   * via polling que a Oasyfy aprovou o pagamento.
   */
  private async reconcilePaidPayment(payment: {
    id: string;
    purchase_id?: string | null;
    provider_payment_id: string;
    provider_meta?: any;
  }) {
    await this.supabaseService.client
      .from('payments')
      .update({
        status: 'completed',
        processed_at: new Date().toISOString(),
        webhook_payload: { reconciled: true, source: 'polling', at: new Date().toISOString() },
      })
      .eq('id', payment.id);

    // Order-level (cart checkout)
    const orderId = payment.provider_meta?.order_id;
    if (orderId && this.ordersService) {
      try {
        await this.ordersService.markOrderPaid(orderId);
        this.logger.log(`Order ${orderId} reconciled via polling`);
      } catch (err: any) {
        this.logger.error(`Failed to mark order ${orderId} paid via polling: ${err.message}`);
      }
      return;
    }

    if (!payment.purchase_id) {
      this.logger.warn(`Payment ${payment.id} reconciled but has no purchase_id/order — orphan`);
      return;
    }

    await this.supabaseService.client
      .from('purchases')
      .update({
        status: 'PAID',
        payment_confirmed_at: new Date().toISOString(),
      })
      .eq('id', payment.purchase_id);

    // Increment weekly_sales
    const { data: purchase } = await this.supabaseService.client
      .from('purchases')
      .select('content_id')
      .eq('id', payment.purchase_id)
      .single();

    if (purchase?.content_id) {
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

    // Best-effort bot notify
    try {
      const apiUrl = process.env.API_URL || 'https://cinevisionn.onrender.com';
      const axios = require('axios');
      await axios
        .post(`${apiUrl}/api/v1/purchases/${payment.purchase_id}/notify-bot`, {
          status: 'PAID',
          source: 'polling-reconciliation',
        })
        .catch(() => {});
    } catch (e) {
      // best-effort
    }

    this.logger.log(`Reconciled purchase ${payment.purchase_id} as PAID via polling`);
  }
}
