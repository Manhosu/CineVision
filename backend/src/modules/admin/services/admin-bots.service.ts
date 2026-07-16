import { Injectable, Logger, BadRequestException, NotFoundException, Inject, forwardRef, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { SupabaseService } from '../../../config/supabase.service';
import { TelegramsEnhancedService } from '../../telegrams/telegrams-enhanced.service';

/**
 * Igor (07/06): CRUD dos bots do Telegram cadastrados em telegram_bots.
 *
 * Operações principais:
 * - listBots() — lista pro painel
 * - createBot(token) — valida via getMe, cria registro, opcionalmente configura webhook
 * - updateBot(id, patch) — edita papéis, status, weight, etc.
 * - setupWebhook(id) — chama Telegram setWebhook apontando pra /webhook/:botId
 * - healthcheck(id) — chama getMe, atualiza last_seen_ok_at
 * - setDefaultAttendance(id) — define qual bot é o default (limpa outros)
 */
@Injectable()
export class AdminBotsService {
  private readonly logger = new Logger(AdminBotsService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
    @Optional()
    @Inject(forwardRef(() => TelegramsEnhancedService))
    private readonly telegrams?: TelegramsEnhancedService,
  ) {}

  private getBackendBaseUrl(): string {
    return (
      this.configService.get<string>('BACKEND_URL') ||
      this.configService.get<string>('API_URL') ||
      'https://cinevisionn.onrender.com'
    );
  }

  async listBots(type?: 'official' | 'promotional' | 'all') {
    // Igor (04/07): filtro por tipo pro painel novo separar aba
    // "Oficiais" x "Promocionais". Default = official (compat com UI antiga).
    // Igor (13/07): adiciona webhook_configured_at, webhook_url_reported,
    // last_webhook_check_at pra painel mostrar indicador visual de saúde.
    const effectiveType = type ?? 'official';
    let query = this.supabaseService.client
      .from('telegram_bots')
      .select('id, username, display_name, custom_display_name, roles, status, is_default_attendance, attendance_weight, users_count, last_seen_ok_at, webhook_configured_at, webhook_url_reported, last_webhook_check_at, created_at, is_promotional, promotional_content_id, promotional_target_url, promotional_start_count, notes, consecutive_getme_failures, last_failure_at, last_failure_reason, webhook_pending_count, webhook_last_error_date, webhook_last_error_message, last_update_received_at, auto_quarantined_at')
      .order('created_at', { ascending: true });

    if (effectiveType === 'official') query = query.eq('is_promotional', false);
    else if (effectiveType === 'promotional') query = query.eq('is_promotional', true);
    // 'all' → sem filtro

    const { data, error } = await query;
    if (error) throw new Error(`Failed to list bots: ${error.message}`);
    return data || [];
  }

  /** Valida token via getMe antes de salvar — falha se token inválido. */
  async createBot(input: {
    token: string;
    display_name?: string;
    roles?: string[];
    // Igor (04/07): flags de bot promocional
    is_promotional?: boolean;
    promotional_content_id?: string;
    promotional_target_url?: string;
    custom_display_name?: string;
    notes?: string;
  }) {
    const token = (input.token || '').trim();
    if (!token || !/^\d+:[A-Za-z0-9_-]+$/.test(token)) {
      throw new BadRequestException('Token inválido. Formato esperado: <id>:<secret>.');
    }

    // getMe pra validar e pegar username/display.
    let me: any;
    try {
      const resp = await axios.get(`https://api.telegram.org/bot${token}/getMe`, { timeout: 10000 });
      if (!resp.data?.ok) {
        throw new BadRequestException(`Telegram getMe retornou erro: ${resp.data?.description || 'desconhecido'}`);
      }
      me = resp.data.result;
    } catch (err: any) {
      const desc = err?.response?.data?.description || err.message;
      throw new BadRequestException(`Token rejeitado pelo Telegram: ${desc}`);
    }

    const username = me.username;
    const display_name = input.display_name || me.first_name || username;
    const isPromotional = !!input.is_promotional;
    // Bot promocional NÃO tem role attendance (constraint SQL blinda também).
    const defaultRoles = isPromotional ? ['delivery'] : ['attendance', 'delivery'];
    const roles = input.roles && input.roles.length ? input.roles : defaultRoles;
    if (isPromotional && roles.includes('attendance')) {
      throw new BadRequestException('Bot promocional não pode ter role "attendance".');
    }

    const { data, error } = await this.supabaseService.client
      .from('telegram_bots')
      .insert({
        username,
        token,
        display_name,
        custom_display_name: input.custom_display_name || null,
        roles,
        status: 'active',
        is_default_attendance: false,
        attendance_weight: 0,
        last_seen_ok_at: new Date().toISOString(),
        is_promotional: isPromotional,
        promotional_content_id: input.promotional_content_id || null,
        promotional_target_url: input.promotional_target_url || null,
        notes: input.notes || null,
      })
      .select()
      .single();
    if (error) {
      if (/duplicate|unique/i.test(error.message)) {
        // Já existe — atualiza token e display, mantém o resto.
        const { data: upd, error: updErr } = await this.supabaseService.client
          .from('telegram_bots')
          .update({ token, display_name, last_seen_ok_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('username', username)
          .select()
          .single();
        if (updErr) throw new Error(`Failed to upsert bot: ${updErr.message}`);
        this.telegrams?.invalidateBotCache(upd.id);
        return { ...upd, _replaced: true };
      }
      throw new Error(`Failed to create bot: ${error.message}`);
    }

    this.telegrams?.invalidateBotCache(data.id);

    // Igor (13/07): setupWebhook automático. Antes dependia de confirm()
    // do browser; se admin clicava Cancelar OU o popup era bloqueado,
    // o bot ficava cadastrado sem webhook → não recebia updates →
    // /start não respondia → contador zerado. Agora chamamos aqui
    // dentro do createBot. Se falhar, gravamos aviso em notes mas
    // NÃO derrubamos criação — admin pode reconfigurar depois.
    let webhookOk = false;
    let webhookError: string | null = null;
    try {
      await this.setupWebhook(data.id);
      webhookOk = true;
    } catch (err: any) {
      webhookError = err?.message || 'unknown error';
      this.logger.warn(`[createBot] setupWebhook failed for ${username}: ${webhookError}`);
      // Grava aviso em notes sem sobrescrever o que já tinha
      const notePrefix = `⚠️ webhook setup failed: ${webhookError}`;
      const combinedNote = input.notes ? `${notePrefix}\n${input.notes}` : notePrefix;
      await this.supabaseService.client
        .from('telegram_bots')
        .update({ notes: combinedNote })
        .eq('id', data.id);
    }

    return { ...data, webhook_ok: webhookOk, webhook_error: webhookError };
  }

  async updateBot(id: string, patch: Partial<{
    display_name: string;
    custom_display_name: string;
    roles: string[];
    status: string;
    attendance_weight: number;
    is_default_attendance: boolean;
    // Igor (04/07): campos de bot promocional
    promotional_content_id: string | null;
    promotional_target_url: string | null;
    notes: string | null;
    is_promotional: boolean;
  }>) {
    // Atomicidade do default: se está marcando este como default, desmarca os outros antes.
    if (patch.is_default_attendance === true) {
      await this.supabaseService.client
        .from('telegram_bots')
        .update({ is_default_attendance: false })
        .neq('id', id);
    }

    // Igor (11/07): guard — bot com status banido/desativado NÃO pode
    // virar promocional. Corrige o bug do bot @CineVisionApp_rbot que
    // ficou marcado como promocional por acidente (SQL de fix já rodado,
    // guard aqui previne recorrência via UI).
    if (patch.is_promotional === true) {
      const { data: current } = await this.supabaseService.client
        .from('telegram_bots')
        .select('status')
        .eq('id', id)
        .maybeSingle();
      if (current && ['banned_br', 'disabled'].includes(current.status)) {
        throw new BadRequestException(
          `Bot com status '${current.status}' não pode ser promocional. Reative-o primeiro.`,
        );
      }
    }
    // Eduardo (16/07): quando admin muda status pra banned_br/disabled,
    // aplicar cleanup (zerar peso + tirar role attendance + tirar default).
    // Antes o bot ficava com attendance_weight>0 mesmo desativado — a
    // query de rotação filtra por status='active' então funciona, mas
    // esses valores stale causavam falsos-positivos em outros lugares
    // (ex: computeBotHealth). Sanitize aqui centraliza o estado.
    const finalPatch: any = { ...patch, updated_at: new Date().toISOString() };
    if (patch.status && ['banned_br', 'disabled'].includes(patch.status)) {
      finalPatch.attendance_weight = 0;
      finalPatch.is_default_attendance = false;
      // Preserva roles não-attendance
      if (!patch.roles) {
        const { data: current } = await this.supabaseService.client
          .from('telegram_bots')
          .select('roles')
          .eq('id', id)
          .maybeSingle();
        finalPatch.roles = Array.isArray(current?.roles)
          ? current.roles.filter((r: string) => r !== 'attendance')
          : [];
      }
    }

    const { data, error } = await this.supabaseService.client
      .from('telegram_bots')
      .update(finalPatch)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(`Failed to update bot: ${error.message}`);
    this.telegrams?.invalidateBotCache(id);
    return data;
  }

  /** Configura webhook do bot apontando pra /webhook/:botId. */
  async setupWebhook(id: string) {
    const { data: bot, error } = await this.supabaseService.client
      .from('telegram_bots')
      .select('id, username, token')
      .eq('id', id)
      .single();
    if (error || !bot) throw new NotFoundException(`Bot ${id} not found`);
    if (!bot.token) throw new BadRequestException('Bot sem token cadastrado.');

    const backendUrl = this.getBackendBaseUrl();
    const webhookUrl = `${backendUrl}/api/v1/telegrams/webhook/${bot.id}`;

    try {
      const resp = await axios.post(`https://api.telegram.org/bot${bot.token}/setWebhook`, {
        url: webhookUrl,
        allowed_updates: [
          'message',
          'callback_query',
          'my_chat_member',
          'chat_member',
          'business_connection',
          'business_message',
          'edited_business_message',
        ],
        drop_pending_updates: false,
      }, { timeout: 10000 });
      if (!resp.data?.ok) {
        throw new BadRequestException(`Telegram setWebhook erro: ${resp.data?.description}`);
      }
      // Igor (13/07): grava webhook_configured_at pra rastreio no painel
      await this.supabaseService.client
        .from('telegram_bots')
        .update({ webhook_configured_at: new Date().toISOString() })
        .eq('id', bot.id);
      this.logger.log(`[admin-bots] webhook set for ${bot.username} → ${webhookUrl}`);
      return { ok: true, webhook_url: webhookUrl, bot_username: bot.username };
    } catch (err: any) {
      const desc = err?.response?.data?.description || err.message;
      throw new BadRequestException(`Falha ao configurar webhook: ${desc}`);
    }
  }

  async healthcheck(id: string) {
    const { data: bot } = await this.supabaseService.client
      .from('telegram_bots')
      .select('id, username, token')
      .eq('id', id)
      .single();
    if (!bot) throw new NotFoundException(`Bot ${id} not found`);
    if (!bot.token) return { ok: false, reason: 'no_token' };

    try {
      const resp = await axios.get(`https://api.telegram.org/bot${bot.token}/getMe`, { timeout: 8000 });
      if (resp.data?.ok) {
        await this.supabaseService.client
          .from('telegram_bots')
          .update({ last_seen_ok_at: new Date().toISOString() })
          .eq('id', id);
        return { ok: true, result: resp.data.result };
      }
      return { ok: false, description: resp.data?.description };
    } catch (err: any) {
      return { ok: false, error: err?.response?.data?.description || err.message };
    }
  }

  /**
   * Igor (13/07): healthcheck REAL — valida getMe + getWebhookInfo.
   *
   * O healthcheck simples (só getMe) só verifica o token do bot, não
   * detecta se o webhook está configurado apontando pra URL certa.
   * Um bot pode ter getMe:ok e ainda estar "morto" no fluxo (foi o
   * cenário dos 5 bots novos que Igor criou).
   *
   * Aqui:
   *   1. getMe → valida token
   *   2. getWebhookInfo → pega URL configurada no Telegram
   *   3. Compara URL retornada com a esperada (${BACKEND}/api/v1/.../webhook/${id})
   *   4. Grava last_webhook_check_at + webhook_url_reported no banco
   *   5. Retorna { ok, getMe_ok, webhook_ok, webhook_mismatch, expected_url, reported_url }
   *
   * Se webhook_mismatch=true, indicador visual do painel vira vermelho.
   * Igor pode clicar "🔗 Configurar TODOS" pra reconfigurar em massa.
   */
  async healthcheckDeep(id: string) {
    const { data: bot } = await this.supabaseService.client
      .from('telegram_bots')
      .select('id, username, token, consecutive_getme_failures, auto_quarantined_at, roles, is_promotional, users_count, last_update_received_at')
      .eq('id', id)
      .single();
    if (!bot) throw new NotFoundException(`Bot ${id} not found`);
    if (!bot.token) return { ok: false, reason: 'no_token' };

    const backendUrl = this.getBackendBaseUrl();
    const expectedUrl = `${backendUrl}/api/v1/telegrams/webhook/${bot.id}`;
    const nowIso = new Date().toISOString();
    const nowSec = Math.floor(Date.now() / 1000);
    let getMeOk = false;
    let webhookOk = false;
    let webhookMismatch = false;
    let reportedUrl: string | null = null;
    let error: string | null = null;
    // Eduardo (16/07): distinguir TIMEOUT/network (intermitente, NÃO conta
    // como bot morto — só reduz confiabilidade da medição) de resposta
    // HTTP definitiva do Telegram (401/403 = bot banido/token revogado).
    // ANTES qualquer catch marcava getMe como falha → 3 blips seguidos
    // quarantinou o CineVisionVip mesmo saudável. Bug corrigido.
    let getMeNetworkError = false;
    let webhookInfo: {
      pending_update_count?: number;
      last_error_date?: number;
      last_error_message?: string;
    } | null = null;

    // 1) getMe — valida token
    try {
      const meResp = await axios.get(`https://api.telegram.org/bot${bot.token}/getMe`, { timeout: 5000 });
      getMeOk = !!meResp.data?.ok;
      if (!getMeOk) error = meResp.data?.description || 'getMe returned not ok';
    } catch (err: any) {
      // Se veio response do Telegram (4xx/5xx), é sinal definitivo de bot morto.
      // Se não veio (timeout, ECONNRESET, ENOTFOUND, etc), é rede — não punir.
      if (err?.response?.data) {
        error = err.response.data.description || `HTTP ${err.response.status}`;
      } else {
        error = err.message;
        getMeNetworkError = true;
      }
    }

    // 2) getWebhookInfo — valida URL configurada + coleta sinais de saúde
    if (getMeOk) {
      try {
        const whResp = await axios.get(`https://api.telegram.org/bot${bot.token}/getWebhookInfo`, { timeout: 5000 });
        if (whResp.data?.ok) {
          const result = whResp.data.result || {};
          reportedUrl = result.url || '';
          webhookInfo = {
            pending_update_count: result.pending_update_count,
            last_error_date: result.last_error_date,
            last_error_message: result.last_error_message,
          };
          if (reportedUrl && reportedUrl === expectedUrl) {
            webhookOk = true;
          } else if (reportedUrl) {
            webhookMismatch = true;
          } // reportedUrl vazio = webhook NUNCA foi setado; webhookOk=false, mismatch=false
        }
      } catch (err: any) {
        error = err?.response?.data?.description || err.message;
      }
    }

    // Eduardo (16/07): detecta "morto de verdade" — 5 sinais.
    // NÃO conta timeout/network error como morto (intermitência).
    // Novo sinal (Eduardo 16/07 revisão): last_update_received_at velho
    // em bot com histórico de tráfego (users_count > 50) = shadow block.
    // Foi o cenário CineVisionTV_bot: 1320 users grudados, getMe:ok,
    // webhook URL correta, ZERO updates recebidos.
    const errorDateAgeSec = webhookInfo?.last_error_date
      ? nowSec - webhookInfo.last_error_date
      : Number.POSITIVE_INFINITY;
    // Eduardo (16/07 v3): se last_update_received_at é NULL, NÃO sabemos.
    // A coluna foi criada agora — bots antigos têm NULL até serem stampados
    // pelo próximo update recebido. Falha do v2 foi tratar NULL como Infinity
    // → marcava TUDO como "shadow block" no primeiro cron pós-deploy.
    // Regra correta: só considera silenciosoLong se a stamp EXISTE E é velha.
    // Bots realmente mortos ficam sem stamp mesmo depois de horas — pega
    // eles via consecutive failures + pending_count + webhook error.
    const hoursSinceLastUpdate = bot.last_update_received_at
      ? (Date.now() - new Date(bot.last_update_received_at).getTime()) / (60 * 60 * 1000)
      : null;
    const silenciosoLong = (bot.users_count || 0) > 50
      && hoursSinceLastUpdate !== null
      && hoursSinceLastUpdate > 48;

    const isTrulyDead =
      // Resposta definitiva do Telegram (não é network error)
      (!getMeOk && !getMeNetworkError) ||
      webhookMismatch ||
      (errorDateAgeSec < 600) || // erro no webhook < 10min
      ((webhookInfo?.pending_update_count ?? 0) > 100) ||
      silenciosoLong;

    let failureReason: string | null = null;
    if (isTrulyDead) {
      if (!getMeOk && !getMeNetworkError) failureReason = `getMe respondeu: ${error || 'unknown'}`;
      else if (webhookMismatch) failureReason = `webhook URL mismatch (reported: ${reportedUrl})`;
      else if (errorDateAgeSec < 600) failureReason = `webhook error ${Math.round(errorDateAgeSec / 60)}min ago: ${webhookInfo?.last_error_message || 'unknown'}`;
      else if ((webhookInfo?.pending_update_count ?? 0) > 100) failureReason = `${webhookInfo?.pending_update_count} pending updates (Telegram não conseguiu entregar)`;
      else if (silenciosoLong) failureReason = `${bot.users_count} users grudados mas ZERO updates há ${Math.round(hoursSinceLastUpdate!)}h (shadow block regional)`;
    }

    // 3) Grava resultado no banco
    const patch: any = { last_webhook_check_at: nowIso };
    if (getMeOk) patch.last_seen_ok_at = nowIso;
    if (reportedUrl !== null) patch.webhook_url_reported = reportedUrl;
    if (webhookInfo) {
      patch.webhook_pending_count = webhookInfo.pending_update_count ?? null;
      patch.webhook_last_error_date = webhookInfo.last_error_date
        ? new Date(webhookInfo.last_error_date * 1000).toISOString()
        : null;
      patch.webhook_last_error_message = webhookInfo.last_error_message ?? null;
    }

    let shouldNotify = false;
    if (isTrulyDead) {
      const failures = (bot.consecutive_getme_failures || 0) + 1;
      patch.consecutive_getme_failures = failures;
      patch.last_failure_at = nowIso;
      patch.last_failure_reason = failureReason;

      // Auto-quarantine em 3 falhas seguidas — zera peso da rotação
      // e tira role de atendimento. NÃO muda status pra banned_br
      // automaticamente (deixa admin ver o rastro no painel + decidir
      // migração WhatsApp). Só é idempotente via auto_quarantined_at.
      if (failures >= 3 && !bot.auto_quarantined_at) {
        patch.attendance_weight = 0;
        patch.is_default_attendance = false;
        patch.roles = Array.isArray(bot.roles)
          ? bot.roles.filter((r: string) => r !== 'attendance')
          : [];
        patch.auto_quarantined_at = nowIso;
        shouldNotify = true;
      }
    } else if (getMeNetworkError) {
      // Blip de rede — não incrementa contador, não reseta. Mantém como estava.
      this.logger.debug?.(`[healthcheck] ${bot.username} network blip ignored`);
    } else if ((bot.consecutive_getme_failures || 0) > 0 || bot.auto_quarantined_at) {
      // Eduardo (16/07): AUTO-RECOVERY. Bot voltou a responder saudável.
      // Reseta contador de falhas E se estava quarantined, restaura peso
      // + role attendance (assume default weight=1). Anti-flapping: só
      // sai da quarantine se ficou pelo menos 15min quarantined
      // (evita loop de quarantine/recover em bot borderline).
      patch.consecutive_getme_failures = 0;
      if (bot.auto_quarantined_at) {
        const quarAgeMs = Date.now() - new Date(bot.auto_quarantined_at).getTime();
        if (quarAgeMs > 15 * 60 * 1000) {
          patch.auto_quarantined_at = null;
          patch.attendance_weight = 1; // default; admin ajusta se quiser mais
          const currentRoles = Array.isArray(bot.roles) ? bot.roles : [];
          if (!currentRoles.includes('attendance')) {
            patch.roles = [...currentRoles, 'attendance'];
          }
          this.logger.log(`[auto-recovery] ${bot.username} saiu da quarentena (${Math.round(quarAgeMs / 60000)}min quarantined)`);
        }
      }
    }

    await this.supabaseService.client
      .from('telegram_bots')
      .update(patch)
      .eq('id', bot.id);

    return {
      ok: getMeOk && webhookOk && !isTrulyDead,
      getMe_ok: getMeOk,
      webhook_ok: webhookOk,
      webhook_mismatch: webhookMismatch,
      is_truly_dead: isTrulyDead,
      failure_reason: failureReason,
      pending_update_count: webhookInfo?.pending_update_count ?? null,
      webhook_last_error_message: webhookInfo?.last_error_message ?? null,
      consecutive_failures: patch.consecutive_getme_failures ?? bot.consecutive_getme_failures ?? 0,
      should_notify: shouldNotify,
      bot_username: bot.username,
      expected_url: expectedUrl,
      reported_url: reportedUrl,
      error,
    };
  }

  /**
   * Eduardo (16/07): notifica o admin via bot MASTER quando bot cai.
   * Anti-spam: só envia se `dead_alert_sent_at` > 6h atrás.
   * Chamado pelo cron pingOfficialBotsDeep quando healthcheckDeep marca
   * shouldNotify=true (auto-quarantine acabou de rodar).
   */
  async notifyBotDead(botId: string, reason: string): Promise<void> {
    if (!this.telegrams) return;
    const { data: bot } = await this.supabaseService.client
      .from('telegram_bots')
      .select('id, username, custom_display_name, dead_alert_sent_at, webhook_pending_count, webhook_last_error_message, users_count')
      .eq('id', botId)
      .single();
    if (!bot) return;

    // Anti-spam: 6h desde último alerta
    if (bot.dead_alert_sent_at) {
      const ageMs = Date.now() - new Date(bot.dead_alert_sent_at).getTime();
      if (ageMs < 6 * 60 * 60 * 1000) return;
    }

    const adminChatId = this.configService.get<string>('ADMIN_TELEGRAM_CHAT_ID');
    if (!adminChatId) {
      this.logger.warn(`[notifyBotDead] ADMIN_TELEGRAM_CHAT_ID not set — skipping notify for ${bot.username}`);
      return;
    }

    const display = bot.custom_display_name || `@${bot.username}`;
    const pending = bot.webhook_pending_count != null ? `\n📥 ${bot.webhook_pending_count} mensagens acumuladas` : '';
    const lastErr = bot.webhook_last_error_message ? `\n⚠️ Último erro: ${bot.webhook_last_error_message}` : '';
    const users = bot.users_count ? `\n👥 ${bot.users_count} usuários grudados nele` : '';

    const text =
      `🚨 *Bot offline detectado*\n\n` +
      `${display}\n` +
      `📛 ${reason}${pending}${lastErr}${users}\n\n` +
      `✅ Já tirei ele da rotação de atendimento automaticamente.\n` +
      `👉 Abra /admin/bots e clique 🚨 no card dele pra disparar migração WhatsApp dos usuários que estavam nele.`;

    try {
      await this.telegrams.sendMessage(parseInt(adminChatId, 10), text, {
        admin_notify: true, // força bot master (não usa ALS)
        parse_mode: 'Markdown',
      });
      await this.supabaseService.client
        .from('telegram_bots')
        .update({ dead_alert_sent_at: new Date().toISOString() })
        .eq('id', botId);
      this.logger.log(`[notifyBotDead] alerta enviado pro admin sobre ${bot.username}: ${reason}`);
    } catch (err: any) {
      this.logger.warn(`[notifyBotDead] falhou pra ${bot.username}: ${err.message}`);
    }
  }

  /**
   * Igor (13/07): reconfigura webhook em MASSA (todos ou por tipo).
   *
   * Uso: Igor cria 10 bots no BotFather, cadastra todos pelo /admin/bots.
   * Em vez de precisar clicar em cada 🔗 individualmente, chama este método.
   * Idempotente pelo lado do Telegram — chamar 2x setWebhook não quebra.
   *
   * Filtro: se filterPromo passado, filtra por is_promotional. Default: todos.
   * Retorna { ok: [{id, username}], failed: [{id, username, error}] }.
   */
  async setupWebhookAll(filterPromo?: boolean) {
    let query = this.supabaseService.client
      .from('telegram_bots')
      .select('id, username')
      .eq('status', 'active');
    if (filterPromo !== undefined) query = query.eq('is_promotional', filterPromo);

    const { data: bots, error } = await query;
    if (error) throw new Error(`Failed to list bots: ${error.message}`);
    if (!bots?.length) return { ok: [], failed: [] };

    const results = await Promise.allSettled(
      bots.map(async (b: any) => {
        try {
          await this.setupWebhook(b.id);
          return { id: b.id, username: b.username };
        } catch (err: any) {
          throw { id: b.id, username: b.username, error: err?.message || 'unknown' };
        }
      }),
    );

    const ok: any[] = [];
    const failed: any[] = [];
    for (const r of results) {
      if (r.status === 'fulfilled') ok.push(r.value);
      else failed.push(r.reason);
    }
    this.logger.log(`[setupWebhookAll] ${ok.length} ok / ${failed.length} failed`);
    return { ok, failed };
  }

  /**
   * Igor (13/07): healthcheckDeep em massa. Usado pelo painel visual
   * (botão "Testar TODOS") e pelo cron OfficialBotsPingService.
   */
  async healthcheckAll(filterPromo?: boolean) {
    let query = this.supabaseService.client
      .from('telegram_bots')
      .select('id, username, is_promotional')
      .eq('status', 'active');
    if (filterPromo !== undefined) query = query.eq('is_promotional', filterPromo);

    const { data: bots, error } = await query;
    if (error) throw new Error(`Failed to list bots: ${error.message}`);
    if (!bots?.length) return { results: [] };

    const results = await Promise.allSettled(
      bots.map(async (b: any) => {
        try {
          const r = await this.healthcheckDeep(b.id);
          return { id: b.id, username: b.username, ...r };
        } catch (err: any) {
          return { id: b.id, username: b.username, ok: false, error: err?.message };
        }
      }),
    );

    return {
      results: results.map((r) =>
        r.status === 'fulfilled' ? r.value : { ok: false, error: 'promise rejected' },
      ),
    };
  }

  async getUserStats() {
    // Igor (11/07): "Usuários por Bot Oficial" — só oficiais na seção
    // global. Bots promocionais têm métrica própria em /admin/bots
    // aba Promocionais (cards com starts/24h/daily breakdown).
    const [{ data: bots }, { data: perBot }, { data: uniqueRow }] = await Promise.all([
      this.supabaseService.client
        .from('telegram_bots')
        .select('id, username, display_name, status, users_count')
        .eq('is_promotional', false)
        .order('created_at', { ascending: true }),
      this.supabaseService.client.rpc('count_users_per_bot').select(),
      // Únicos reais: DISTINCT telegram_chat_id entre usuários com bot rastreado
      this.supabaseService.client.rpc('count_unique_tracked_users').select().single(),
    ]);

    const countByUsername = new Map<string, number>();
    for (const row of perBot || []) {
      countByUsername.set(row.bot_username, Number(row.user_count));
    }

    const botsWithStats = (bots || []).map((b: any) => ({
      id: b.id,
      username: b.username,
      display_name: b.display_name,
      status: b.status,
      users_count: countByUsername.get(b.username) ?? b.users_count ?? 0,
    }));

    // Total apenas dos bots ativos (exclui banidos do somatório)
    const totalAll = botsWithStats
      .filter((b: any) => b.status !== 'banned_br' && b.status !== 'disabled')
      .reduce((s: number, b: any) => s + b.users_count, 0);

    return {
      bots: botsWithStats,
      total_all: totalAll,
      total_unique: (uniqueRow as any)?.count ?? 0,
    };
  }

  /**
   * Igor (04/07): renomeação de bot promocional.
   *
   * Cenário: Igor cria bot @SupermanFilme_bot, aluga por 3 meses. Público
   * cai. Igor renomeia no BotFather pra @TodoMundoPanico6_bot (mantém o
   * mesmo token e user_id do Telegram). Aqui atualizamos o display_name
   * pra bater com o novo, mantendo continuidade dos analytics e do
   * rastreamento na tabela.
   *
   * Refetcha o `getMe` pra pegar o novo username/display do Telegram.
   */
  async renameFromTelegram(id: string) {
    const { data: bot } = await this.supabaseService.client
      .from('telegram_bots')
      .select('id, token, username')
      .eq('id', id)
      .single();
    if (!bot) throw new NotFoundException(`Bot ${id} not found`);
    if (!bot.token) throw new BadRequestException('Bot sem token cadastrado.');

    let me: any;
    try {
      const resp = await axios.get(`https://api.telegram.org/bot${bot.token}/getMe`, { timeout: 10000 });
      if (!resp.data?.ok) {
        throw new BadRequestException(`getMe erro: ${resp.data?.description}`);
      }
      me = resp.data.result;
    } catch (err: any) {
      throw new BadRequestException(`getMe falhou: ${err?.response?.data?.description || err.message}`);
    }

    const patch: any = {
      display_name: me.first_name || me.username,
      last_seen_ok_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    // Só troca username se realmente mudou (evita conflito unique)
    if (me.username && me.username !== bot.username) {
      patch.username = me.username;
    }

    const { data, error } = await this.supabaseService.client
      .from('telegram_bots')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(`Failed to rename bot: ${error.message}`);
    this.telegrams?.invalidateBotCache(id);
    return {
      ok: true,
      old_username: bot.username,
      new_username: data.username,
      display_name: data.display_name,
    };
  }

  /**
   * Analytics agregado por bot promocional — starts / orders / revenue nos
   * últimos N dias. Feed do dashboard `/admin/bots/promotional/[id]/analytics`.
   */
  async getPromotionalAnalytics(days = 30) {
    const { data, error } = await this.supabaseService.client
      .rpc('promotional_bots_analytics', { days });
    if (error) throw new Error(`Failed to fetch promo analytics: ${error.message}`);
    return data || [];
  }

  /**
   * Igor (09/07): métricas detalhadas de UM bot promocional (total, 24h,
   * 7d, breakdown diário 14 dias). Alimenta o dashboard individual.
   */
  async getPromotionalBotMetrics(botId: string) {
    const { data, error } = await this.supabaseService.client
      .rpc('promotional_bot_metrics', { p_bot_id: botId });
    if (error) throw new Error(`Failed to fetch metrics: ${error.message}`);
    return data || {};
  }

  async deleteBot(id: string) {
    const { data: bot } = await this.supabaseService.client
      .from('telegram_bots')
      .select('id, is_default_attendance')
      .eq('id', id)
      .single();
    if (!bot) throw new NotFoundException(`Bot ${id} not found`);
    if (bot.is_default_attendance) {
      throw new BadRequestException('Não pode deletar o bot default. Defina outro como default antes.');
    }
    const { error } = await this.supabaseService.client
      .from('telegram_bots')
      .delete()
      .eq('id', id);
    if (error) throw new Error(`Failed to delete bot: ${error.message}`);
    this.telegrams?.invalidateBotCache(id);
    return { ok: true };
  }
}
