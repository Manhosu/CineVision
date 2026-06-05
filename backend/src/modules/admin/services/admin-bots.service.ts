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

  async listBots() {
    const { data, error } = await this.supabaseService.client
      .from('telegram_bots')
      .select('id, username, display_name, roles, status, is_default_attendance, attendance_weight, users_count, last_seen_ok_at, created_at')
      .order('created_at', { ascending: true });
    if (error) throw new Error(`Failed to list bots: ${error.message}`);
    return data || [];
  }

  /** Valida token via getMe antes de salvar — falha se token inválido. */
  async createBot(input: { token: string; display_name?: string; roles?: string[] }) {
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
    const roles = input.roles && input.roles.length ? input.roles : ['attendance', 'delivery'];

    const { data, error } = await this.supabaseService.client
      .from('telegram_bots')
      .insert({
        username,
        token,
        display_name,
        roles,
        status: 'active',
        is_default_attendance: false,
        attendance_weight: 0,
        last_seen_ok_at: new Date().toISOString(),
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
    roles: string[];
    status: string;
    attendance_weight: number;
    is_default_attendance: boolean;
  }>) {
    // Atomicidade do default: se está marcando este como default, desmarca os outros antes.
    if (patch.is_default_attendance === true) {
      await this.supabaseService.client
        .from('telegram_bots')
        .update({ is_default_attendance: false })
        .neq('id', id);
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
