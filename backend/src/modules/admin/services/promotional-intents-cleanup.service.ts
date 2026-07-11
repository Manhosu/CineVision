import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SupabaseService } from '../../../config/supabase.service';

/**
 * Igor (04/07): housekeeping dos purchase_intents pendentes/expirados.
 *
 * purchase_intents é criado no Cenário 3 (cliente clica Comprar num bot
 * oficial, filme com bot promo vinculado). Cliente pode nunca clicar no
 * link → intent fica pending pra sempre. Cron marca como 'expired' após
 * expires_at (default +15min do INSERT), pra:
 *   - manter o painel de analytics limpo
 *   - permitir que o cliente clique de novo (novo INSERT com token novo)
 *   - reciclar o índice parcial de expires_at
 *
 * Roda a cada 5 min — TTL do intent é 15min, então máx 20min de lag antes
 * de virar 'expired' (pouco).
 */
@Injectable()
export class PromotionalIntentsCleanupService {
  private readonly logger = new Logger(PromotionalIntentsCleanupService.name);

  constructor(private readonly supabase: SupabaseService) {}

  @Cron('*/5 * * * *') // every 5 minutes
  async expirePendingIntents() {
    try {
      const nowIso = new Date().toISOString();
      const { data, error } = await this.supabase.client
        .from('purchase_intents')
        .update({ status: 'expired' })
        .eq('status', 'pending')
        .lt('expires_at', nowIso)
        .select('id');
      if (error) {
        this.logger.warn(`Failed to expire pending intents: ${error.message}`);
        return;
      }
      if (data && data.length > 0) {
        this.logger.log(`⏰ Expired ${data.length} pending purchase_intents`);
      }
    } catch (err: any) {
      this.logger.error(`expirePendingIntents threw: ${err.message}`);
    }
  }
}
