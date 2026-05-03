import { Inject, Injectable, Logger, Optional, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SupabaseService } from '../../../config/supabase.service';
import { TelegramsEnhancedService } from '../../telegrams/telegrams-enhanced.service';

/**
 * Igor pediu (Áudio 3 — 03/05/2026): quando o cliente para de responder
 * (5/10/30/60 min de silêncio), enviar mensagem padrão lembrando que
 * pode comprar pelo /start no app. Funciona MESMO quando a IA está
 * pausada (admin assumiu) — a ideia é re-engajar conversas frias
 * independente de quem foi a última pessoa a falar.
 *
 * Texto LITERAL combinado com Igor:
 *   "🛍 Para realizar novas compras no aplicativo, digite /start"
 *
 * Tier inicial: 30 min. Pode adicionar 5/10/60 min depois se Igor pedir.
 */
const REENGAGEMENT_TEMPLATE =
  '🛍 Para realizar novas compras no aplicativo, digite /start';

const REENGAGEMENT_AFTER_MINUTES = 30;

@Injectable()
export class ReengagementService {
  private readonly logger = new Logger(ReengagementService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly configService: ConfigService,
    @Optional()
    @Inject(forwardRef(() => TelegramsEnhancedService))
    private readonly telegramsService?: TelegramsEnhancedService,
  ) {}

  /**
   * Roda a cada 5 min. Acha conversas que:
   *  - última mensagem do cliente (last_message_at) é mais antiga que
   *    REENGAGEMENT_AFTER_MINUTES;
   *  - ainda não tiveram um re-engajamento enviado nesta janela
   *    (last_reengagement_sent_at IS NULL OR < last_message_at).
   *
   * Pra cada conversa elegível, envia o template via Telegram e
   * carimba `last_reengagement_sent_at = NOW()`.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async tick() {
    if (!this.telegramsService) {
      // Bot não disponível (módulo desligado em ambiente local) — pula.
      return;
    }

    const cutoff = new Date(
      Date.now() - REENGAGEMENT_AFTER_MINUTES * 60 * 1000,
    ).toISOString();

    // Pega só Telegram (única plataforma com sendMessage hoje). Pega
    // todas as conversas que cruzaram o cutoff e ainda não receberam
    // re-engajamento desde a última mensagem.
    const { data: candidates, error } = await this.supabase.client
      .from('ai_conversations')
      .select('id, platform, external_chat_id, last_message_at, last_reengagement_sent_at')
      .eq('platform', 'telegram')
      .lt('last_message_at', cutoff)
      .limit(50);

    if (error) {
      this.logger.error('Failed to query reengagement candidates', error);
      return;
    }
    if (!candidates?.length) return;

    const eligible = candidates.filter((c: any) => {
      if (!c.last_reengagement_sent_at) return true;
      // Já enviou re-engajamento DEPOIS da última mensagem do cliente:
      // não enviar de novo até cliente falar e ficar quieto outra vez.
      return new Date(c.last_reengagement_sent_at) < new Date(c.last_message_at);
    });

    if (!eligible.length) return;

    this.logger.log(
      `ReengagementService: enviando template para ${eligible.length} conversa(s) frias.`,
    );

    let sent = 0;
    for (const conv of eligible) {
      const chatId = parseInt(conv.external_chat_id, 10);
      if (Number.isNaN(chatId)) continue;
      try {
        await this.telegramsService.sendMessage(chatId, REENGAGEMENT_TEMPLATE);
        // Persiste a mensagem no histórico como role='system' pra
        // aparecer no painel admin com etiqueta clara (não confunde
        // com mensagem da IA ou do admin).
        await this.supabase.client.from('ai_messages').insert({
          conversation_id: conv.id,
          role: 'system',
          content: REENGAGEMENT_TEMPLATE,
        });
        await this.supabase.client
          .from('ai_conversations')
          .update({ last_reengagement_sent_at: new Date().toISOString() })
          .eq('id', conv.id);
        sent++;
      } catch (err: any) {
        this.logger.warn(
          `Reengagement send failed for chat ${chatId}: ${err.message}`,
        );
      }
    }

    this.logger.log(`ReengagementService: ${sent}/${eligible.length} enviados.`);
  }
}
