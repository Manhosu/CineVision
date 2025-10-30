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
        .not('telegram_chat_id', 'is', null);

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
      imageUrl?: string;
      buttonText?: string;
      buttonUrl?: string;
    },
  ): Promise<boolean> {
    try {
      let endpoint = `${this.telegramApiUrl}/sendMessage`;
      let payload: any = {
        chat_id: chatId,
        text: messageText,
        parse_mode: 'Markdown',
      };

      // Validate optional string fields
      const imageUrl = options?.imageUrl && typeof options.imageUrl === 'string' ? options.imageUrl.trim() : '';
      const buttonText = options?.buttonText && typeof options.buttonText === 'string' ? options.buttonText.trim() : '';
      const buttonUrl = options?.buttonUrl && typeof options.buttonUrl === 'string' ? options.buttonUrl.trim() : '';

      // Add inline keyboard if button is provided
      if (buttonText && buttonUrl) {
        payload.reply_markup = {
          inline_keyboard: [[{ text: buttonText, url: buttonUrl }]],
        };
      }

      // If image is provided, use sendPhoto
      if (imageUrl) {
        endpoint = `${this.telegramApiUrl}/sendPhoto`;
        payload = {
          chat_id: chatId,
          photo: imageUrl,
          caption: messageText,
          parse_mode: 'Markdown',
        };

        if (buttonText && buttonUrl) {
          payload.reply_markup = {
            inline_keyboard: [[{ text: buttonText, url: buttonUrl }]],
          };
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

      let successCount = 0;
      let failCount = 0;

      // Rate limiting: 25 messages per second
      const messagesPerSecond = 25;
      const delayMs = 1000 / messagesPerSecond; // ~40ms between messages

      // Send messages with rate limiting
      for (const user of users) {
        if (!user.telegram_chat_id) {
          failCount++;
          continue;
        }

        const success = await this.sendMessageToUser(
          user.telegram_chat_id,
          broadcastData.message_text,
          {
            imageUrl: broadcastData.image_url,
            buttonText: broadcastData.button_text,
            buttonUrl: broadcastData.button_url,
          },
        );

        if (success) {
          successCount++;
        } else {
          failCount++;
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
        })
        .select()
        .single();

      if (broadcastError) {
        this.logger.error('Error saving broadcast record:', broadcastError);
      }

      this.logger.log(
        `Broadcast completed: ${successCount} successful, ${failCount} failed out of ${users.length} users`,
      );

      return {
        success: true,
        total_users: users.length,
        successful_sends: successCount,
        failed_sends: failCount,
        broadcast_id: broadcast?.id || '',
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
