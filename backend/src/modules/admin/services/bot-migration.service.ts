import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../../../config/supabase.service';
import { WhatsappService } from '../../whatsapp/whatsapp.service';
import { pickBotMigrationTemplate } from './bot-migration-templates';

/**
 * Igor (07/06): Fase C — disparo WhatsApp pros usuários de um bot Telegram
 * que caiu. Marca status=banned_br, busca quem usava aquele bot, sorteia
 * template, manda pra cada um com throttle. Fire-and-forget — o endpoint
 * retorna o run_id e o processamento corre em background.
 *
 * Throttle: 1 msg cada 3s (≈100 msgs / 5min). Circuit-breaker: para se 5
 * sends consecutivos falharem (provável bloqueio do WhatsApp).
 */
@Injectable()
export class BotMigrationService {
  private readonly logger = new Logger(BotMigrationService.name);

  private readonly DELAY_MS = 3000;
  private readonly CIRCUIT_BREAK_THRESHOLD = 5;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly whatsappService: WhatsappService,
  ) {}

  private get sb() {
    return this.supabaseService.client;
  }

  /**
   * Inicia migração: marca bot como banned_br, cria run, dispara worker
   * em background. Retorna o run criado imediatamente.
   */
  async startMigration(botId: string, triggeredBy?: string) {
    const { data: bot, error: botErr } = await this.sb
      .from('telegram_bots')
      .select('id, username, status, roles')
      .eq('id', botId)
      .single();

    if (botErr || !bot) throw new NotFoundException(`Bot ${botId} não encontrado`);
    if (bot.status === 'banned_br') {
      throw new BadRequestException('Bot já está marcado como caído.');
    }

    if (!this.whatsappService.isConfigured()) {
      throw new BadRequestException('WhatsApp não configurado — não dá pra disparar migração.');
    }

    // Escolhe bot ativo de destino — preferência pelo default, depois maior peso.
    const { data: targetBot, error: targetErr } = await this.sb
      .from('telegram_bots')
      .select('id, username')
      .eq('status', 'active')
      .contains('roles', ['attendance'])
      .gt('attendance_weight', 0)
      .neq('id', botId)
      .order('is_default_attendance', { ascending: false })
      .order('attendance_weight', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (targetErr) throw new Error(`Falha ao buscar bot de destino: ${targetErr.message}`);
    if (!targetBot) {
      throw new BadRequestException(
        'Nenhum bot de atendimento ativo pra migrar usuários. Cadastre/ative outro bot antes.',
      );
    }

    // Conta candidatos.
    const { count: totalUsers } = await this.sb
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('bot_username', bot.username);

    const { count: noWhatsapp } = await this.sb
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('bot_username', bot.username)
      .or('whatsapp.is.null,whatsapp.eq.');

    // Marca o bot como caído ANTES de começar o disparo — pra não cair em
    // sorteio rotativo enquanto roda.
    const newRoles = (bot.roles || []).filter((r: string) => r !== 'attendance');
    await this.sb
      .from('telegram_bots')
      .update({
        status: 'banned_br',
        attendance_weight: 0,
        is_default_attendance: false,
        roles: newRoles.length ? newRoles : ['delivery'],
        updated_at: new Date().toISOString(),
      })
      .eq('id', botId);

    // Cria registro do run.
    const { data: run, error: runErr } = await this.sb
      .from('bot_migration_runs')
      .insert({
        bot_id: botId,
        triggered_by: triggeredBy || null,
        status: 'running',
        total_users: totalUsers || 0,
        no_whatsapp: noWhatsapp || 0,
      })
      .select()
      .single();

    if (runErr) throw new Error(`Falha ao criar run: ${runErr.message}`);

    // Fire-and-forget — não bloqueia a resposta do endpoint.
    this.processRun(run.id, bot.username, targetBot.username).catch(err => {
      this.logger.error(`Migração ${run.id} explodiu: ${err.message}`, err.stack);
    });

    this.logger.log(
      `[bot-migration] iniciada run=${run.id} bot=${bot.username} alvo=@${targetBot.username} total=${totalUsers}`,
    );

    return {
      run_id: run.id,
      total_users: totalUsers,
      no_whatsapp: noWhatsapp,
      target_bot: targetBot.username,
    };
  }

  /** Loop sequencial com throttle + circuit-breaker. */
  private async processRun(runId: string, fromBotUsername: string, targetBotUsername: string) {
    const targetUrl = `https://telegram.me/${targetBotUsername}`;
    const targetHandle = `@${targetBotUsername}`;

    const { data: users, error: usersErr } = await this.sb
      .from('users')
      .select('id, whatsapp')
      .eq('bot_username', fromBotUsername)
      .not('whatsapp', 'is', null)
      .neq('whatsapp', '');

    if (usersErr) {
      await this.markRunFailed(runId, `Falha ao listar users: ${usersErr.message}`);
      return;
    }

    let notified = 0;
    let failed = 0;
    let consecutiveFails = 0;
    let lastError: string | null = null;

    for (const user of users || []) {
      const message = pickBotMigrationTemplate(user.id, targetUrl, targetHandle);
      const ok = await this.whatsappService.sendText(user.whatsapp, message);

      if (ok) {
        notified++;
        consecutiveFails = 0;
      } else {
        failed++;
        consecutiveFails++;
        lastError = `WA send falhou pro user ${user.id}`;
      }

      // Atualiza progresso a cada 10 envios.
      if ((notified + failed) % 10 === 0) {
        await this.sb
          .from('bot_migration_runs')
          .update({ notified, failed, last_error: lastError })
          .eq('id', runId);
      }

      if (consecutiveFails >= this.CIRCUIT_BREAK_THRESHOLD) {
        this.logger.error(
          `[bot-migration] circuit-breaker disparou em ${runId} (${consecutiveFails} fails consecutivos)`,
        );
        await this.sb
          .from('bot_migration_runs')
          .update({
            status: 'failed',
            notified,
            failed,
            last_error: `Circuit-breaker: ${consecutiveFails} envios consecutivos falharam`,
            completed_at: new Date().toISOString(),
          })
          .eq('id', runId);
        return;
      }

      await new Promise(r => setTimeout(r, this.DELAY_MS));
    }

    await this.sb
      .from('bot_migration_runs')
      .update({
        status: 'completed',
        notified,
        failed,
        last_error: lastError,
        completed_at: new Date().toISOString(),
      })
      .eq('id', runId);

    this.logger.log(`[bot-migration] run=${runId} done: notified=${notified} failed=${failed}`);
  }

  private async markRunFailed(runId: string, error: string) {
    await this.sb
      .from('bot_migration_runs')
      .update({
        status: 'failed',
        last_error: error,
        completed_at: new Date().toISOString(),
      })
      .eq('id', runId);
  }

  async listRuns(botId?: string, limit = 20) {
    let q = this.sb
      .from('bot_migration_runs')
      .select('*, telegram_bots(username)')
      .order('started_at', { ascending: false })
      .limit(limit);
    if (botId) q = q.eq('bot_id', botId);
    const { data, error } = await q;
    if (error) throw new Error(`Falha ao listar runs: ${error.message}`);
    return data || [];
  }
}
