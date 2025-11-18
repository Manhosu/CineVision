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
   * Get all users who have started the bot (have telegram_chat_id)
   */
  async getAllBotUsers(): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('id, telegram_id, telegram_chat_id, telegram_username, name')
        .not('telegram_chat_id', 'is', null)
        .limit(10000); // Set high limit to fetch all users (default is 1000)

      if (error) {
        this.logger.error('Error fetching bot users:', error);
        throw new Error('Failed to fetch users');
      }

      return data || [];
    } catch (error) {
      this.logger.error('Error in getAllBotUsers:', error);
      throw error;
    }
  }

  /**
   * Send a message to a single Telegram user
   */
  async sendMessageToUser(
    chatId: string,
    messageText: string,
    options?: {
      buttonText?: string;
      buttonUrl?: string;
      inlineButtons?: Array<{ text: string; url: string }>;
    },
  ): Promise<boolean> {
    const endpoint = `${this.telegramApiUrl}/sendMessage`;

    try {
      const payload: any = {
        chat_id: chatId,
        text: messageText,
        parse_mode: 'Markdown',
      };

      // Priority: use inline_buttons if provided, otherwise fall back to single button
      if (options?.inlineButtons && Array.isArray(options.inlineButtons) && options.inlineButtons.length > 0) {
        // Multiple inline buttons - each button is on its own row
        const inlineKeyboard = options.inlineButtons.map(button => [{
          text: button.text,
          url: button.url,
        }]);

        payload.reply_markup = {
          inline_keyboard: inlineKeyboard,
        };

        this.logger.log(`Sending message with ${options.inlineButtons.length} inline buttons`);
      } else if (options?.buttonText && options?.buttonUrl) {
        // Single button for backward compatibility
        const buttonText = typeof options.buttonText === 'string' ? options.buttonText.trim() : '';
        const buttonUrl = typeof options.buttonUrl === 'string' ? options.buttonUrl.trim() : '';

        if (buttonText && buttonUrl) {
          payload.reply_markup = {
            inline_keyboard: [[{ text: buttonText, url: buttonUrl }]],
          };
          this.logger.log(`Sending message with button: ${buttonText} -> ${buttonUrl}`);
        }
      }

      const response = await axios.post(endpoint, payload);

      if (response.data.ok) {
        return true;
      } else {
        this.logger.warn(`Failed to send message to ${chatId}:`, response.data);
        return false;
      }
    } catch (error) {
      this.logger.error(`Error sending message to ${chatId}:`, error.message);

      // Log full error details from Telegram API
      if (error.response?.data) {
        this.logger.error(`Telegram API error response:`, JSON.stringify(error.response.data));
      }

      // Log the payload that failed
      this.logger.error(`Failed payload:`, JSON.stringify({
        endpoint,
        chat_id: chatId,
        message_length: messageText?.length || 0,
        has_buttons: !!(options?.inlineButtons || (options?.buttonText && options?.buttonUrl)),
      }));

      return false;
    }
  }

  /**
   * Send broadcast to specific telegram IDs with rate limiting
   * Telegram allows ~30 messages per second, we'll use 25 to be safe
   */
  async sendBroadcast(
    adminId: string,
    broadcastData: SendBroadcastDto,
  ): Promise<{
    success: boolean;
    total_users: number;
    successful_sends: number;
    failed_sends: number;
    broadcast_id: string;
    successful_telegram_ids: string[];
    failed_telegram_ids: string[];
  }> {
    try {
      // Validate that telegram_ids is provided and not empty
      if (!broadcastData.telegram_ids || !Array.isArray(broadcastData.telegram_ids) || broadcastData.telegram_ids.length === 0) {
        throw new BadRequestException('telegram_ids é obrigatório e deve conter pelo menos um ID');
      }

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

      const users = data || [];

      if (users.length === 0) {
        throw new BadRequestException('Nenhum usuário encontrado com os IDs fornecidos. Certifique-se de que os usuários iniciaram conversa com o bot.');
      }

      // Log found users vs requested IDs
      const foundIds = users.map(u => String(u.telegram_id || ''));
      const notFoundIds = cleanedIds.filter(id => !foundIds.includes(id));
      if (notFoundIds.length > 0) {
        this.logger.warn(`Telegram IDs not found or without chat_id: ${notFoundIds.join(', ')}`);
      }

      this.logger.log(`Starting broadcast to ${users.length} users`);
      this.logger.log(`Users with telegram_chat_id: ${users.filter(u => u.telegram_chat_id).length}`);

      // Log user details for debugging
      users.forEach(user => {
        this.logger.log(`User ${user.telegram_id}: chat_id=${user.telegram_chat_id || 'MISSING'}, username=${user.telegram_username || 'none'}`);
      });

      let successCount = 0;
      let failCount = 0;
      const successfulTelegramIds: string[] = [];
      const failedTelegramIds: string[] = [];

      // Rate limiting: 25 messages per second
      const messagesPerSecond = 25;
      const delayMs = 1000 / messagesPerSecond; // ~40ms between messages

      // Send messages with rate limiting
      for (const user of users) {
        if (!user.telegram_chat_id) {
          this.logger.warn(`User ${user.telegram_id} has no telegram_chat_id`);
          failCount++;
          failedTelegramIds.push(String(user.telegram_id || 'unknown'));
          continue;
        }

        this.logger.log(`Sending message to user ${user.telegram_id} (chat_id: ${user.telegram_chat_id})`);

        const success = await this.sendMessageToUser(
          user.telegram_chat_id,
          broadcastData.message_text,
          {
            inlineButtons: broadcastData.inline_buttons,
            buttonText: broadcastData.button_text,
            buttonUrl: broadcastData.button_url,
          },
        );

        if (success) {
          successCount++;
          successfulTelegramIds.push(String(user.telegram_id));
          this.logger.log(`✅ Message sent successfully to ${user.telegram_id}`);
        } else {
          failCount++;
          failedTelegramIds.push(String(user.telegram_id));
          this.logger.error(`❌ Failed to send message to ${user.telegram_id}`);
        }

        // Wait before sending next message (rate limiting)
        await this.sleep(delayMs);
      }

      // Save broadcast record to database
      const { data: broadcast, error: broadcastError } = await this.supabase
        .from('broadcasts')
        .insert({
          admin_id: adminId,
          message_text: broadcastData.message_text,
          image_url: broadcastData.image_url || null,
          video_url: null,
          button_text: broadcastData.button_text || null,
          button_url: broadcastData.button_url || null,
          recipients_count: successCount,
          recipient_telegram_ids: successfulTelegramIds.length > 0 ? successfulTelegramIds.join(',') : null,
        })
        .select()
        .single();

      if (broadcastError) {
        this.logger.error('Error saving broadcast record:', broadcastError);
      }

      this.logger.log(
        `Broadcast completed: ${successCount} successful, ${failCount} failed out of ${users.length} users`,
      );
      this.logger.log(`Successful IDs: ${successfulTelegramIds.join(', ')}`);
      this.logger.log(`Failed IDs: ${failedTelegramIds.join(', ')}`);

      return {
        success: true,
        total_users: users.length,
        successful_sends: successCount,
        failed_sends: failCount,
        broadcast_id: broadcast?.id || '',
        successful_telegram_ids: successfulTelegramIds,
        failed_telegram_ids: failedTelegramIds,
      };
    } catch (error) {
      this.logger.error('Error in sendBroadcast:', error);
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
