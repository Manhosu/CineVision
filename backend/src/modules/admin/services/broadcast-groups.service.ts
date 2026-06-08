import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../../config/supabase.service';
import { TelegramsEnhancedService } from '../../telegrams/telegrams-enhanced.service';

/**
 * N31 (Igor 07/06): Broadcast para grupos Telegram onde os bots são admins.
 * Igor mandava mensagem manual em cada grupo (2-3h). Agora envia pra todos
 * de uma vez e pode apagar de todos com 1 clique.
 */
@Injectable()
export class BroadcastGroupsService {
  private readonly logger = new Logger(BroadcastGroupsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly telegrams: TelegramsEnhancedService,
  ) {}

  async listGroups() {
    const { data: groups, error } = await this.supabase.client
      .from('telegram_bot_groups')
      .select(`
        id, chat_id, title, member_count, is_active, last_sent_at, created_at,
        bot:telegram_bots(id, username, display_name, status)
      `)
      .order('created_at', { ascending: false });
    if (error) throw new Error(`listGroups failed: ${error.message}`);
    return groups || [];
  }

  async addGroup(botId: string, chatId: string, title?: string) {
    const { data, error } = await this.supabase.client
      .from('telegram_bot_groups')
      .upsert(
        { bot_id: botId, chat_id: chatId, title: title || '', is_active: true, updated_at: new Date().toISOString() },
        { onConflict: 'bot_id,chat_id' },
      )
      .select()
      .single();
    if (error) throw new Error(`addGroup failed: ${error.message}`);
    return data;
  }

  async toggleGroup(id: string, is_active: boolean) {
    const { error } = await this.supabase.client
      .from('telegram_bot_groups')
      .update({ is_active, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw new Error(`toggleGroup failed: ${error.message}`);
    return { ok: true };
  }

  async removeGroup(id: string) {
    const { error } = await this.supabase.client
      .from('telegram_bot_groups')
      .delete()
      .eq('id', id);
    if (error) throw new Error(`removeGroup failed: ${error.message}`);
    return { ok: true };
  }

  async listBroadcasts() {
    const { data, error } = await this.supabase.client
      .from('group_broadcast_messages')
      .select('id, message_text, image_url, total_groups, successful_sends, failed_sends, status, sent_at')
      .order('sent_at', { ascending: false })
      .limit(50);
    if (error) throw new Error(`listBroadcasts failed: ${error.message}`);
    return data || [];
  }

  async sendBroadcast(params: {
    messageText: string;
    imageUrl?: string;
    adminId?: string;
  }) {
    const { messageText, imageUrl, adminId } = params;

    // Busca grupos ativos + bot de cada grupo
    const { data: groups, error: gErr } = await this.supabase.client
      .from('telegram_bot_groups')
      .select('id, chat_id, bot:telegram_bots(id, username, token, status)')
      .eq('is_active', true);
    if (gErr) throw new Error(`sendBroadcast: failed to fetch groups: ${gErr.message}`);
    if (!groups?.length) return { broadcast_id: null, total: 0, message: 'Nenhum grupo ativo cadastrado.' };

    // Cria registro do broadcast
    const { data: broadcast, error: bErr } = await this.supabase.client
      .from('group_broadcast_messages')
      .insert({
        message_text: messageText,
        image_url: imageUrl || null,
        total_groups: groups.length,
        status: 'sending',
        admin_id: adminId || null,
      })
      .select()
      .single();
    if (bErr) throw new Error(`sendBroadcast: failed to create broadcast record: ${bErr.message}`);

    // Fire-and-forget: envia em background para não travar o response HTTP
    this.sendToGroupsAsync(broadcast.id, groups, messageText, imageUrl).catch((err) =>
      this.logger.error(`sendBroadcast async error: ${err.message}`),
    );

    return { broadcast_id: broadcast.id, total: groups.length, status: 'sending' };
  }

  private async sendToGroupsAsync(
    broadcastId: string,
    groups: any[],
    messageText: string,
    imageUrl?: string,
  ) {
    let success = 0;
    let failed = 0;

    for (const group of groups) {
      const bot = Array.isArray(group.bot) ? group.bot[0] : group.bot;
      if (!bot || bot.status === 'disabled') {
        failed++;
        await this.insertEntry(broadcastId, group.id, null, 'Bot inativo/disabled');
        continue;
      }

      try {
        let msgId: string | null = null;
        if (imageUrl) {
          const res = await this.telegrams.sendPhotoToGroupWithBot(
            bot.token,
            group.chat_id,
            imageUrl,
            messageText,
          );
          msgId = res?.message_id ? String(res.message_id) : null;
        } else {
          const res = await this.telegrams.sendMessageToGroupWithBot(
            bot.token,
            group.chat_id,
            messageText,
          );
          msgId = res?.message_id ? String(res.message_id) : null;
        }
        await this.insertEntry(broadcastId, group.id, msgId, null);
        await this.supabase.client
          .from('telegram_bot_groups')
          .update({ last_sent_at: new Date().toISOString() })
          .eq('id', group.id);
        success++;
      } catch (err: any) {
        this.logger.warn(`sendToGroup ${group.chat_id} failed: ${err.message}`);
        await this.insertEntry(broadcastId, group.id, null, err.message);
        failed++;
      }

      // 1s entre mensagens para não exceder rate limit do Telegram
      await this.sleep(1000);
    }

    await this.supabase.client
      .from('group_broadcast_messages')
      .update({
        successful_sends: success,
        failed_sends: failed,
        status: failed === 0 ? 'completed' : success === 0 ? 'failed' : 'partial',
      })
      .eq('id', broadcastId);

    this.logger.log(`Broadcast ${broadcastId} concluído: ${success} OK / ${failed} falhas`);
  }

  async pinBroadcast(broadcastId: string) {
    const { data: entries, error } = await this.supabase.client
      .from('group_broadcast_entries')
      .select(`
        id, telegram_message_id,
        bot_group:telegram_bot_groups(chat_id, bot:telegram_bots(token))
      `)
      .eq('broadcast_id', broadcastId)
      .not('telegram_message_id', 'is', null)
      .is('deleted_at', null);

    if (error) throw new Error(`pinBroadcast fetch failed: ${error.message}`);

    let pinned = 0;
    let failed = 0;
    for (const entry of entries || []) {
      const group = Array.isArray(entry.bot_group) ? entry.bot_group[0] : entry.bot_group;
      const bot = group?.bot ? (Array.isArray(group.bot) ? group.bot[0] : group.bot) : null;
      if (!bot?.token || !group?.chat_id || !entry.telegram_message_id) continue;

      try {
        await this.telegrams.pinMessageInGroupWithBot(
          bot.token,
          group.chat_id,
          entry.telegram_message_id,
        );
        pinned++;
      } catch (err: any) {
        this.logger.warn(`pinMessage failed for entry ${entry.id}: ${err.message}`);
        failed++;
      }
      await this.sleep(500);
    }

    return { pinned, failed };
  }

  async deleteBroadcast(broadcastId: string) {
    const { data: entries, error } = await this.supabase.client
      .from('group_broadcast_entries')
      .select(`
        id, telegram_message_id, deleted_at,
        bot_group:telegram_bot_groups(chat_id, bot:telegram_bots(token))
      `)
      .eq('broadcast_id', broadcastId)
      .is('deleted_at', null)
      .not('telegram_message_id', 'is', null);

    if (error) throw new Error(`deleteBroadcast fetch failed: ${error.message}`);

    let deleted = 0;
    for (const entry of entries || []) {
      const group = Array.isArray(entry.bot_group) ? entry.bot_group[0] : entry.bot_group;
      const bot = group?.bot ? (Array.isArray(group.bot) ? group.bot[0] : group.bot) : null;
      if (!bot?.token || !group?.chat_id || !entry.telegram_message_id) continue;

      try {
        await this.telegrams.deleteMessageFromGroupWithBot(
          bot.token,
          group.chat_id,
          entry.telegram_message_id,
        );
        await this.supabase.client
          .from('group_broadcast_entries')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', entry.id);
        deleted++;
      } catch (err: any) {
        this.logger.warn(`deleteMessage failed for entry ${entry.id}: ${err.message}`);
      }
      await this.sleep(500);
    }

    return { deleted };
  }

  private async insertEntry(
    broadcastId: string,
    botGroupId: string,
    messageId: string | null,
    err: string | null,
  ) {
    await this.supabase.client.from('group_broadcast_entries').insert({
      broadcast_id: broadcastId,
      bot_group_id: botGroupId,
      telegram_message_id: messageId,
      error: err,
    });
  }

  private sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
  }
}
