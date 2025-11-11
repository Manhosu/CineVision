import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { Content } from '../../content/entities/content.entity';
import { Purchase } from '../../purchases/entities/purchase.entity';
import { User } from '../../users/entities/user.entity';
import { CDNService } from '../../cdn/services/cdn.service';
import { SystemLog } from '../../logs/entities/system-log.entity';

export interface TelegramMessage {
  chat_id: string | number;
  text: string;
  parse_mode?: 'Markdown' | 'HTML';
  reply_markup?: any;
}

export interface TelegramDocument {
  chat_id: string | number;
  document: string; // file_id or URL
  caption?: string;
  parse_mode?: 'Markdown' | 'HTML';
}

@Injectable()
export class BotNotificationService {
  private readonly logger = new Logger(BotNotificationService.name);
  private readonly botToken: string;
  private readonly botApiUrl: string;
  private readonly maxMessagesPerSecond = 30; // Telegram limit
  private messageQueue: Array<() => Promise<any>> = [];
  private isProcessingQueue = false;

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(SystemLog)
    private systemLogRepository: Repository<SystemLog>,
    private cdnService: CDNService,
    private configService: ConfigService,
  ) {
    this.botToken = this.configService.get('TELEGRAM_BOT_TOKEN');
    this.botApiUrl = `https://api.telegram.org/bot${this.botToken}`;

    if (!this.botToken) {
      this.logger.warn('TELEGRAM_BOT_TOKEN not configured. Bot notifications will be disabled.');
    } else {
      this.logger.log('BotNotificationService initialized');
    }
  }



  /**
   * Notify all subscribers about new content (broadcast)
   */
  async notifyNewContent(content: Content, throttle = true): Promise<number> {
    if (!this.botToken) {
      this.logger.warn('Bot token not configured. Skipping broadcast.');
      return 0;
    }

    try {
      // Get all users with telegram_chat_id
      const subscribers = await this.userRepository.find({
        where: {
          telegram_chat_id: Not(IsNull()),
        },
        select: ['id', 'telegram_chat_id', 'email'],
      });

      if (subscribers.length === 0) {
        this.logger.log('No subscribers found for new content notification');
        return 0;
      }

      const message = this.buildNewContentMessage(content);
      const keyboard = this.buildNewContentKeyboard(content);

      let successCount = 0;

      for (const subscriber of subscribers) {
        if (!subscriber.telegram_chat_id) continue;

        try {
          if (throttle) {
            await this.queueMessage(async () => {
              await this.sendMessage({
                chat_id: subscriber.telegram_chat_id,
                text: message,
                parse_mode: 'Markdown',
                reply_markup: keyboard,
              });
            });
          } else {
            await this.sendMessage({
              chat_id: subscriber.telegram_chat_id,
              text: message,
              parse_mode: 'Markdown',
              reply_markup: keyboard,
            });
          }

          successCount++;
        } catch (error) {
          this.logger.error(
            `Failed to send notification to user ${subscriber.id}: ${error.message}`,
          );
        }
      }

      // Log broadcast
      await this.systemLogRepository.save({
        entity_type: 'content',
        entity_id: content.id,
        action: 'bot_broadcast_new_content',
        meta: {
          content_title: content.title,
          subscribers_count: subscribers.length,
          success_count: successCount,
        },
      });

      this.logger.log(
        `New content broadcast sent to ${successCount}/${subscribers.length} subscribers`,
      );

      return successCount;
    } catch (error) {
      this.logger.error(`Failed to broadcast new content: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Send custom notification to specific user
   */
  async sendCustomNotification(
    chatId: string | number,
    message: string,
    keyboard?: any,
  ): Promise<void> {
    await this.queueMessage(async () => {
      await this.sendMessage({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
    });
  }

  // Private helper methods

  private buildPurchaseMessage(content: Content, purchase: Purchase): string {
    return `✅ **Pagamento Confirmado!**

🎬 **${content.title}**
💰 Valor: R$ ${(purchase.amount_cents / 100).toFixed(2)}

${content.description || ''}

Seu conteúdo está pronto! Escolha como deseja assistir:`;
  }

  private async buildPurchaseKeyboard(content: Content, purchase: Purchase): Promise<any> {
    const buttons: any[][] = [];

    if (content.availability === 'site' || content.availability === 'both') {
      buttons.push([
        {
          text: '▶️ Assistir Online',
          callback_data: `watch_${content.id}`,
        },
      ]);
    }

    if (content.availability === 'telegram' || content.availability === 'both') {
      buttons.push([
        {
          text: '💾 Baixar Arquivo',
          callback_data: `download_${content.id}`,
        },
      ]);
    }

    buttons.push([
      {
        text: '📱 Minhas Compras',
        callback_data: 'my_purchases',
      },
      {
        text: '🎬 Ver Catálogo',
        callback_data: 'catalog',
      },
    ]);

    return { inline_keyboard: buttons };
  }

  private buildNewContentMessage(content: Content): string {
    const price = (content.price_cents / 100).toFixed(2);
    const genres = content.genres ? JSON.parse(content.genres).join(', ') : 'N/A';

    return `🆕 **Novo Lançamento!**

🎬 **${content.title}**
${content.imdb_rating ? `⭐ ${content.imdb_rating}/10` : ''}
🎭 ${genres}
${content.duration_minutes ? `⏱️ ${content.duration_minutes} min` : ''}

${content.description || content.synopsis || ''}

💰 **Por apenas R$ ${price}**

Não perca!`;
  }

  private buildNewContentKeyboard(content: Content): any {
    return {
      inline_keyboard: [
        [
          {
            text: '🛒 Comprar Agora',
            callback_data: `buy_${content.id}`,
          },
        ],
        [
          {
            text: '📖 Ver Detalhes',
            callback_data: `details_${content.id}`,
          },
          {
            text: '🎬 Ver Catálogo',
            callback_data: 'catalog',
          },
        ],
      ],
    };
  }

  // Telegram API methods

  private async sendMessage(params: TelegramMessage): Promise<any> {
    const url = `${this.botApiUrl}/sendMessage`;
    const response = await axios.post(url, params);
    return response.data;
  }

  // Queue management for rate limiting

  private async queueMessage(messageFn: () => Promise<any>): Promise<void> {
    this.messageQueue.push(messageFn);

    if (!this.isProcessingQueue) {
      this.processQueue();
    }
  }

  private async processQueue(): Promise<void> {
    this.isProcessingQueue = true;

    while (this.messageQueue.length > 0) {
      const messageFn = this.messageQueue.shift();

      try {
        await messageFn();
      } catch (error) {
        this.logger.error(`Queue message failed: ${error.message}`);
      }

      // Rate limit: 30 messages per second
      await this.sleep(1000 / this.maxMessagesPerSecond);
    }

    this.isProcessingQueue = false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: string; bot_configured: boolean }> {
    return {
      status: this.botToken ? 'healthy' : 'disabled',
      bot_configured: !!this.botToken,
    };
  }
}
