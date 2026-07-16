import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import axios from 'axios';
import { SupabaseService } from '../../../config/supabase.service';
import { AdminBotsService } from './admin-bots.service';

/**
 * Igor (11/07): fix do bug de Cenário 3 — bot promocional caía como
 * "stale" 5min após cadastro porque `last_seen_ok_at` só era atualizado
 * quando um usuário desse /start no bot (linha 4385 do telegrams-enhanced).
 * Sem tráfego orgânico o timestamp envelhecia e `getPromoBotForContent`
 * retornava `available: false`, fazendo o clique Comprar cair no bot
 * oficial em vez do promocional.
 *
 * Solução: cron a cada 2min chama `getMe` em cada bot promocional ativo
 * e atualiza `last_seen_ok_at`. Assim bot real fica sempre fresco, e a
 * checagem de staleness (30min) só pega bot morto de verdade.
 *
 * Combinado com o grace period de 24h em getPromoBotForContent (bot
 * recém-cadastrado nunca é stale), o Cenário 3 fica robusto.
 */
@Injectable()
export class PromotionalBotsPingService {
  private readonly logger = new Logger(PromotionalBotsPingService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    @Inject(forwardRef(() => AdminBotsService))
    private readonly adminBots: AdminBotsService,
  ) {}

  @Cron('*/2 * * * *') // every 2 minutes
  async pingPromoBots() {
    try {
      const { data: bots, error } = await this.supabaseService.client
        .from('telegram_bots')
        .select('id, username, token')
        .eq('is_promotional', true)
        .eq('status', 'active');

      if (error) {
        this.logger.warn(`Failed to list promo bots: ${error.message}`);
        return;
      }
      if (!bots?.length) return;

      const results = await Promise.allSettled(
        bots.map(async (b: any) => {
          if (!b.token) return { bot: b.username, ok: false, reason: 'no_token' };
          try {
            const resp = await axios.get(
              `https://api.telegram.org/bot${b.token}/getMe`,
              { timeout: 3000 },
            );
            if (resp.data?.ok) {
              await this.supabaseService.client
                .from('telegram_bots')
                .update({ last_seen_ok_at: new Date().toISOString() })
                .eq('id', b.id);
              return { bot: b.username, ok: true };
            }
            return { bot: b.username, ok: false, reason: resp.data?.description };
          } catch (err: any) {
            return { bot: b.username, ok: false, reason: err?.response?.data?.description || err.message };
          }
        }),
      );

      const failed = results
        .map((r) => r.status === 'fulfilled' ? r.value : { ok: false, reason: 'promise_rejected' })
        .filter((r: any) => !r.ok);

      if (failed.length) {
        this.logger.warn(`Promo bots ping: ${failed.length}/${bots.length} failed — ${JSON.stringify(failed)}`);
      }
    } catch (err: any) {
      this.logger.error(`pingPromoBots threw: ${err.message}`);
    }
  }

  /**
   * Igor (13/07): novo cron pros bots OFICIAIS.
   *
   * Ao contrário do promo (só getMe), este roda `healthcheckDeep` que
   * também valida `getWebhookInfo`. Detecta o cenário dos 5 bots novos:
   * token válido MAS webhook não configurado. Grava webhook_url_reported +
   * last_webhook_check_at → alimenta indicador visual do painel.
   *
   * Rate limit-safe: 5min é conservador. Timeout 5s por bot,
   * Promise.allSettled não trava um pelo outro. Bot API limit
   * é 30 req/s no getMe, 1 setWebhook/segundo — nem chegamos perto.
   */
  @Cron('*/5 * * * *') // every 5 minutes
  async pingOfficialBotsDeep() {
    try {
      const result = await this.adminBots.healthcheckAll(false);
      const results: any[] = result.results || [];
      const bad = results.filter((r: any) => !r.ok);
      if (bad.length) {
        this.logger.warn(`[official-ping] ${bad.length} bot(s) com problema: ${JSON.stringify(bad.map((b: any) => ({ u: b.username, m: b.webhook_mismatch, dead: b.is_truly_dead, reason: b.failure_reason, pending: b.pending_update_count })))}`);
      } else {
        this.logger.debug?.(`[official-ping] ${results.length} bots ok`);
      }

      // Eduardo (16/07): dispara alerta pro admin quando healthcheckDeep
      // acabou de rodar auto-quarantine (should_notify=true). Anti-spam
      // (6h) tá dentro do notifyBotDead.
      const toNotify = results.filter((r: any) => r.should_notify);
      for (const r of toNotify) {
        try {
          await this.adminBots.notifyBotDead(r.id, r.failure_reason || 'bot offline');
        } catch (err: any) {
          this.logger.warn(`notifyBotDead failed for ${r.bot_username}: ${err.message}`);
        }
      }
    } catch (err: any) {
      this.logger.error(`pingOfficialBotsDeep threw: ${err.message}`);
    }
  }
}
