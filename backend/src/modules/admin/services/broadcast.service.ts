import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import axios from 'axios';
import { SendBroadcastDto } from '../dto/broadcast.dto';

@Injectable()
export class BroadcastService {
  private readonly logger = new Logger(BroadcastService.name);
  private supabase: SupabaseClient;
  private botToken: string;
  private telegramApiUrl: string;

  constructor(private configService: ConfigService) {
    this.supabase = createClient(
      this.configService.get<string>('SUPABASE_URL') || '',
      this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY') || '',
    );
    this.botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN') || '';
    this.telegramApiUrl = `https://api.telegram.org/bot${this.botToken}`;
  }

  /**
   * Fast count of users who can receive broadcasts (no data fetched)
   */
  async getBotUsersCount(): Promise<number> {
    try {
      const { count, error } = await this.supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .not('telegram_chat_id', 'is', null)
        .eq('blocked', false);

      if (error) {
        this.logger.error('Error counting bot users:', error);
        return 0;
      }

      return count || 0;
    } catch (error) {
      this.logger.error('Error in getBotUsersCount:', error);
      return 0;
    }
  }

  /**
   * Get all users who have started the bot (have telegram_chat_id)
   * Uses pagination to fetch ALL users (Supabase has max 1000 per request)
   */
  async getAllBotUsers(): Promise<any[]> {
    try {
      const allUsers: any[] = [];
      const pageSize = 1000;
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        const from = page * pageSize;
        const to = from + pageSize - 1;

        this.logger.log(`Fetching users page ${page + 1} (${from}-${to})...`);

        const { data, error, count } = await this.supabase
          .from('users')
          .select('id, telegram_id, telegram_chat_id, telegram_username, name', { count: 'exact' })
          .not('telegram_chat_id', 'is', null)
          .eq('blocked', false)
          .range(from, to);

        if (error) {
          this.logger.error('Error fetching bot users:', error);
          throw new Error('Failed to fetch users');
        }

        if (data && data.length > 0) {
          allUsers.push(...data);
          this.logger.log(`Fetched ${data.length} users (total so far: ${allUsers.length})`);
        }

        // Check if there are more pages
        hasMore = data && data.length === pageSize;
        page++;

        // Safety check: stop after 100 pages (100,000 users max)
        if (page >= 100) {
          this.logger.warn('Reached maximum pagination limit of 100 pages');
          break;
        }
      }

      this.logger.log(`Total users fetched: ${allUsers.length}`);
      return allUsers;
    } catch (error) {
      this.logger.error('Error in getAllBotUsers:', error);
      throw error;
    }
  }

  /**
   * Send a text message to a single Telegram user
   */
  async sendMessageToUser(
    chatId: string,
    messageText: string,
    options?: {
      buttonText?: string;
      buttonUrl?: string;
      inlineButtons?: Array<{ text: string; url: string }>;
    },
  ): Promise<{ success: boolean; blocked?: boolean }> {
    const endpoint = `${this.telegramApiUrl}/sendMessage`;

    try {
      const htmlText = messageText
        .replace(/\*([^*]+)\*/g, '<b>$1</b>')
        .replace(/_([^_]+)_/g, '<i>$1</i>');

      const payload: any = {
        chat_id: chatId,
        text: htmlText,
        parse_mode: 'HTML',
      };

      if (options?.inlineButtons && Array.isArray(options.inlineButtons) && options.inlineButtons.length > 0) {
        payload.reply_markup = {
          inline_keyboard: options.inlineButtons.map(button => [{ text: button.text, url: button.url }]),
        };
      } else if (options?.buttonText && options?.buttonUrl) {
        const buttonText = typeof options.buttonText === 'string' ? options.buttonText.trim() : '';
        const buttonUrl = typeof options.buttonUrl === 'string' ? options.buttonUrl.trim() : '';
        if (buttonText && buttonUrl) {
          payload.reply_markup = {
            inline_keyboard: [[{ text: buttonText, url: buttonUrl }]],
          };
        }
      }

      const response = await axios.post(endpoint, payload);
      return { success: response.data.ok === true };
    } catch (error) {
      const statusCode = error.response?.status;
      const errorCode = error.response?.data?.error_code;
      const blocked = statusCode === 403 || errorCode === 403 || statusCode === 400 || errorCode === 400;
      return { success: false, blocked };
    }
  }

  /**
   * Send a photo with optional caption to a single Telegram user
   */
  async sendPhotoToUser(
    chatId: string,
    photoUrl: string,
    caption?: string,
    options?: {
      buttonText?: string;
      buttonUrl?: string;
      inlineButtons?: Array<{ text: string; url: string }>;
    },
  ): Promise<{ success: boolean; blocked?: boolean }> {
    const endpoint = `${this.telegramApiUrl}/sendPhoto`;

    try {
      const htmlCaption = caption
        ? caption.replace(/\*([^*]+)\*/g, '<b>$1</b>').replace(/_([^_]+)_/g, '<i>$1</i>')
        : undefined;

      const payload: any = {
        chat_id: chatId,
        photo: photoUrl,
        parse_mode: 'HTML',
      };

      if (htmlCaption) {
        payload.caption = htmlCaption;
      }

      if (options?.inlineButtons && Array.isArray(options.inlineButtons) && options.inlineButtons.length > 0) {
        payload.reply_markup = {
          inline_keyboard: options.inlineButtons.map(button => [{ text: button.text, url: button.url }]),
        };
      } else if (options?.buttonText && options?.buttonUrl) {
        const buttonText = typeof options.buttonText === 'string' ? options.buttonText.trim() : '';
        const buttonUrl = typeof options.buttonUrl === 'string' ? options.buttonUrl.trim() : '';
        if (buttonText && buttonUrl) {
          payload.reply_markup = {
            inline_keyboard: [[{ text: buttonText, url: buttonUrl }]],
          };
        }
      }

      const response = await axios.post(endpoint, payload);
      return { success: response.data.ok === true };
    } catch (error) {
      const statusCode = error.response?.status;
      const errorCode = error.response?.data?.error_code;
      const blocked = statusCode === 403 || errorCode === 403 || statusCode === 400 || errorCode === 400;
      return { success: false, blocked };
    }
  }

  /**
   * Send broadcast to specific telegram IDs or all users.
   * Returns immediately with broadcast_id; sending continues in background.
   */
  async sendBroadcast(
    adminId: string,
    broadcastData: SendBroadcastDto,
  ): Promise<{
    success: boolean;
    broadcast_id: string;
    total_users: number;
    status: string;
    message: string;
  }> {
    try {
      // Validate that telegram_ids is provided and not empty
      if (!broadcastData.telegram_ids || !Array.isArray(broadcastData.telegram_ids) || broadcastData.telegram_ids.length === 0) {
        throw new BadRequestException('telegram_ids é obrigatório e deve conter pelo menos um ID');
      }

      let users: any[];

      // Support 'all' to send to every bot user
      if (broadcastData.telegram_ids.length === 1 && broadcastData.telegram_ids[0] === 'all') {
        this.logger.log('Broadcast target: ALL users');
        users = await this.getAllBotUsers();
      } else {
        // Ensure all telegram_ids are strings and trim them
        const cleanedIds = broadcastData.telegram_ids
          .map(id => String(id || '').trim())
          .filter(id => id);

        if (cleanedIds.length === 0) {
          throw new BadRequestException('Nenhum telegram_id válido foi fornecido');
        }

        this.logger.log(`Fetching users with specific telegram IDs: ${cleanedIds.join(', ')}`);

        // Fetch users by telegram IDs
        const { data, error } = await this.supabase
          .from('users')
          .select('id, telegram_id, telegram_chat_id, telegram_username, name')
          .in('telegram_id', cleanedIds)
          .not('telegram_chat_id', 'is', null);

        if (error) {
          this.logger.error('Error fetching specific users:', error);
          throw new Error('Falha ao buscar usuários específicos');
        }

        users = data || [];
      }

      if (users.length === 0) {
        throw new BadRequestException('Nenhum usuário encontrado com os IDs fornecidos. Certifique-se de que os usuários iniciaram conversa com o bot.');
      }

      // Filter users that have telegram_chat_id
      const validUsers = users.filter(u => u.telegram_chat_id);
      this.logger.log(`Starting broadcast to ${validUsers.length} users (${users.length} total, ${users.length - validUsers.length} without chat_id)`);

      // Create broadcast record with status 'sending'
      const { data: broadcast, error: broadcastError } = await this.supabase
        .from('broadcasts')
        .insert({
          admin_id: adminId,
          message_text: broadcastData.message_text,
          image_url: broadcastData.image_url || null,
          video_url: null,
          button_text: broadcastData.button_text || null,
          button_url: broadcastData.button_url || null,
          recipients_count: 0,
          recipient_telegram_ids: validUsers.map(u => String(u.telegram_id)).join(','),
          status: 'sending',
          total_users: validUsers.length,
          successful_sends: 0,
          failed_sends: 0,
          progress_percent: 0,
          failed_telegram_ids: null,
        })
        .select()
        .single();

      if (broadcastError || !broadcast) {
        this.logger.error('Error creating broadcast record:', broadcastError);
        throw new Error('Falha ao criar registro de broadcast');
      }

      const broadcastId = broadcast.id;

      // Fire-and-forget: start async processing in background
      this.processBroadcastAsync(broadcastId, validUsers, broadcastData).catch(err => {
        this.logger.error(`Background broadcast ${broadcastId} crashed:`, err.message);
      });

      return {
        success: true,
        broadcast_id: broadcastId,
        total_users: validUsers.length,
        status: 'sending',
        message: `Broadcast iniciado para ${validUsers.length} usuários. Acompanhe o progresso pelo ID.`,
      };
    } catch (error) {
      this.logger.error('Error in sendBroadcast:', error);
      throw error;
    }
  }

  /**
   * Process broadcast asynchronously in background with batched sending.
   * 20 users per batch, 10 seconds between batches.
   */
  private async processBroadcastAsync(
    broadcastId: string,
    users: any[],
    broadcastData: SendBroadcastDto,
  ): Promise<void> {
    // Telegram limits: max 30 msg/sec, we target ~25 msg/sec
    // 25 users sent IN PARALLEL per batch + 1s delay between batches
    // Each HTTP call takes ~200-400ms, but parallel = all finish in ~400ms
    // So: 25 msgs in ~400ms + 1000ms delay = ~1.4s per batch = ~18 msg/sec
    // For 93k users: ~1.5 hours
    const BATCH_SIZE = 25;
    const BATCH_DELAY_MS = 1000;

    let successCount = 0;
    let failCount = 0;
    const failedTelegramIds: string[] = [];
    const blockedUserIds: Array<{ chatId: string; telegramId: string }> = [];

    const totalUsers = users.length;
    const hasImage = !!broadcastData.image_url;
    const buttonOptions = {
      inlineButtons: broadcastData.inline_buttons,
      buttonText: broadcastData.button_text,
      buttonUrl: broadcastData.button_url,
    };

    this.logger.log(`[Broadcast ${broadcastId}] Starting PARALLEL processing for ${totalUsers} users (batch size: ${BATCH_SIZE}, delay: ${BATCH_DELAY_MS}ms)`);

    try {
      for (let i = 0; i < totalUsers; i += BATCH_SIZE) {
        const batch = users.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(totalUsers / BATCH_SIZE);

        // Send all messages in this batch IN PARALLEL
        const results = await Promise.allSettled(
          batch.map(async (user) => {
            if (!user.telegram_chat_id) {
              return { success: false, blocked: false, userId: user.telegram_id };
            }

            let result: { success: boolean; blocked?: boolean };
            if (hasImage) {
              result = await this.sendPhotoToUser(
                user.telegram_chat_id,
                broadcastData.image_url!,
                broadcastData.message_text,
                buttonOptions,
              );
            } else {
              result = await this.sendMessageToUser(
                user.telegram_chat_id,
                broadcastData.message_text,
                buttonOptions,
              );
            }

            return { ...result, chatId: user.telegram_chat_id, userId: user.telegram_id };
          })
        );

        // Process results
        for (let j = 0; j < results.length; j++) {
          const result = results[j];
          const user = batch[j];

          if (result.status === 'fulfilled' && result.value.success) {
            successCount++;
          } else {
            failCount++;
            failedTelegramIds.push(String(user.telegram_id || 'unknown'));

            // Collect blocked users to mark later (no extra API call)
            if (result.status === 'fulfilled' && result.value.blocked) {
              blockedUserIds.push({
                chatId: user.telegram_chat_id,
                telegramId: String(user.telegram_id),
              });
            }
          }
        }

        // Update progress in database after each batch
        const processed = Math.min(i + BATCH_SIZE, totalUsers);
        const progressPercent = Math.round((processed / totalUsers) * 100);

        await this.updateBroadcastProgress(broadcastId, {
          successful_sends: successCount,
          failed_sends: failCount,
          progress_percent: progressPercent,
          recipients_count: successCount,
          failed_telegram_ids: failedTelegramIds.length > 100 ? failedTelegramIds.slice(-100).join(',') : failedTelegramIds.join(','),
        });

        if (batchNum % 50 === 0 || batchNum === totalBatches) {
          this.logger.log(`[Broadcast ${broadcastId}] Batch ${batchNum}/${totalBatches}. Progress: ${progressPercent}% (success: ${successCount}, failed: ${failCount})`);
        }

        // Wait between batches (skip delay after last batch)
        if (i + BATCH_SIZE < totalUsers) {
          await this.sleep(BATCH_DELAY_MS);
        }
      }

      // Mark broadcast as completed
      await this.updateBroadcastProgress(broadcastId, {
        status: 'completed',
        successful_sends: successCount,
        failed_sends: failCount,
        progress_percent: 100,
        recipients_count: successCount,
        failed_telegram_ids: failedTelegramIds.length > 100 ? failedTelegramIds.slice(-100).join(',') : failedTelegramIds.join(','),
      });

      this.logger.log(`[Broadcast ${broadcastId}] Completed: ${successCount} successful, ${failCount} failed out of ${totalUsers} users`);

      // Mark blocked users in background (fire-and-forget, no extra API calls)
      if (blockedUserIds.length > 0) {
        this.logger.log(`[Broadcast ${broadcastId}] Marking ${blockedUserIds.length} blocked users...`);
        const telegramIds = blockedUserIds.map(u => u.telegramId);
        try {
          const { error: blockError } = await this.supabase
            .from('users')
            .update({ blocked: true })
            .in('telegram_id', telegramIds);
          if (blockError) this.logger.error('Error marking blocked users:', blockError);
          else this.logger.log(`Marked ${telegramIds.length} users as blocked`);
        } catch (err) {
          this.logger.error('Error in blocked users update:', err.message);
        }
      }
    } catch (error) {
      this.logger.error(`[Broadcast ${broadcastId}] Error during async processing:`, error.message);

      await this.updateBroadcastProgress(broadcastId, {
        status: 'failed',
        successful_sends: successCount,
        failed_sends: failCount,
        progress_percent: Math.round(((successCount + failCount) / totalUsers) * 100),
        failed_telegram_ids: failedTelegramIds.length > 100 ? failedTelegramIds.slice(-100).join(',') : failedTelegramIds.join(','),
      });
    }
  }

  /**
   * Update broadcast progress in the database
   */
  private async updateBroadcastProgress(
    broadcastId: string,
    updates: {
      status?: string;
      successful_sends?: number;
      failed_sends?: number;
      progress_percent?: number;
      recipients_count?: number;
      failed_telegram_ids?: string | null;
    },
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('broadcasts')
        .update(updates)
        .eq('id', broadcastId);

      if (error) {
        this.logger.error(`Error updating broadcast ${broadcastId} progress:`, error);
      }
    } catch (error) {
      this.logger.error(`Error in updateBroadcastProgress:`, error.message);
    }
  }

  /**
   * Check if a user has blocked the bot and mark them as inactive.
   * Called when a send fails - verifies with a getChat call.
   */
  private async handleBlockedUser(chatId: string, telegramId: string): Promise<void> {
    try {
      // Try getChat to verify if user blocked the bot
      const endpoint = `${this.telegramApiUrl}/getChat`;
      await axios.post(endpoint, { chat_id: chatId });
      // If getChat succeeds, user didn't block - failure was something else
    } catch (error) {
      const statusCode = error.response?.status;
      const errorCode = error.response?.data?.error_code;

      // 403 = bot blocked by user, 400 = chat not found / user deactivated
      if (statusCode === 403 || errorCode === 403 || statusCode === 400 || errorCode === 400) {
        this.logger.warn(`User ${telegramId} (chat: ${chatId}) appears to have blocked the bot or deactivated. Marking as inactive.`);

        try {
          const { error: updateError } = await this.supabase
            .from('users')
            .update({ blocked: true })
            .eq('telegram_id', telegramId);

          if (updateError) {
            this.logger.error(`Error marking user ${telegramId} as inactive:`, updateError);
          } else {
            this.logger.log(`User ${telegramId} marked as inactive`);
          }
        } catch (dbError) {
          this.logger.error(`Error updating user ${telegramId} inactive status:`, dbError.message);
        }
      }
    }
  }

  /**
   * Get broadcast progress by ID
   */
  async getBroadcastProgress(broadcastId: string): Promise<any> {
    try {
      const { data, error } = await this.supabase
        .from('broadcasts')
        .select('id, status, total_users, successful_sends, failed_sends, progress_percent, failed_telegram_ids, sent_at')
        .eq('id', broadcastId)
        .single();

      if (error) {
        this.logger.error('Error fetching broadcast progress:', error);
        throw new Error('Falha ao buscar progresso do broadcast');
      }

      return data;
    } catch (error) {
      this.logger.error('Error in getBroadcastProgress:', error);
      throw error;
    }
  }

  /**
   * Get broadcast history for admin
   */
  async getBroadcastHistory(adminId: string, limit: number = 20): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('broadcasts')
        .select('*')
        .eq('admin_id', adminId)
        .order('sent_at', { ascending: false })
        .limit(limit);

      if (error) {
        this.logger.error('Error fetching broadcast history:', error);
        throw new Error('Failed to fetch broadcast history');
      }

      return data || [];
    } catch (error) {
      this.logger.error('Error in getBroadcastHistory:', error);
      throw error;
    }
  }

  /**
   * Helper function to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
