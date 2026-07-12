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
    const effectiveType = type ?? 'official';
    let query = this.supabaseService.client
      .from('telegram_bots')
      .select('id, username, display_name, custom_display_name, roles, status, is_default_attendance, attendance_weight, users_count, last_seen_ok_at, created_at, is_promotional, promotional_content_id, promotional_target_url, promotional_start_count, notes')
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
    return data;
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
    const { data, error } = await this.supabaseService.client
      .from('telegram_bots')
      .update({ ...patch, updated_at: new Date().toISOString() })
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
