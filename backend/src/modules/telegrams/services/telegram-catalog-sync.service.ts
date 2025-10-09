import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { TelegramsEnhancedService } from '../telegrams-enhanced.service';

interface ActiveUser {
  chat_id: number;
  telegram_user_id: number;
  last_interaction: Date;
}

@Injectable()
export class TelegramCatalogSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramCatalogSyncService.name);
  private readonly supabase: SupabaseClient;
  private realtimeChannel: RealtimeChannel;
  private activeUsers = new Map<number, ActiveUser>();

  constructor(
    private configService: ConfigService,
    private telegramsEnhancedService: TelegramsEnhancedService,
  ) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY') ||
                        this.configService.get<string>('SUPABASE_SERVICE_KEY') ||
                        this.configService.get<string>('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration missing for TelegramCatalogSyncService');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.logger.log('TelegramCatalogSyncService initialized');
  }

  async onModuleInit() {
    await this.setupRealtimeSubscription();
    this.logger.log('Realtime catalog sync started');
  }

  async onModuleDestroy() {
    if (this.realtimeChannel) {
      await this.supabase.removeChannel(this.realtimeChannel);
      this.logger.log('Realtime catalog sync stopped');
    }
  }

  /**
   * Setup Supabase Realtime subscription to content table changes
   */
  private async setupRealtimeSubscription() {
    this.realtimeChannel = this.supabase
      .channel('content-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'content',
          filter: 'status=eq.PUBLISHED',
        },
        (payload) => this.handleNewContent(payload.new),
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'content',
        },
        (payload) => this.handleContentUpdate(payload.new, payload.old),
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'content',
        },
        (payload) => this.handleContentDelete(payload.old),
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          this.logger.log('Successfully subscribed to content changes');
        } else if (status === 'CHANNEL_ERROR') {
          this.logger.error('Error subscribing to content changes');
        }
      });
  }

  /**
   * Handle new content being added
   */
  private async handleNewContent(content: any) {
    if (content.content_type !== 'movie') return;

    this.logger.log(`New movie published: ${content.title}`);

    const message = `🎬 **NOVO LANÇAMENTO!**

📽️ **${content.title}**
${content.description || ''}

💰 **Preço:** R$ ${(content.price_cents / 100).toFixed(2)}
${content.release_year ? `📅 **Ano:** ${content.release_year}` : ''}
${content.imdb_rating ? `⭐ **IMDB:** ${content.imdb_rating}/10` : ''}

🛒 Use /catalogo para ver e comprar!`;

    await this.broadcastToActiveUsers(message, {
      inline_keyboard: [
        [{ text: '🎬 Ver Catálogo', callback_data: 'catalog' }],
        [{ text: `🛒 Comprar ${content.title}`, callback_data: `buy_${content.id}` }],
      ],
    });
  }

  /**
   * Handle content being updated
   */
  private async handleContentUpdate(newContent: any, oldContent: any) {
    if (newContent.content_type !== 'movie') return;

    // Check if status changed to PUBLISHED
    if (oldContent.status !== 'PUBLISHED' && newContent.status === 'PUBLISHED') {
      await this.handleNewContent(newContent);
      return;
    }

    // Check if status changed to unpublished
    if (oldContent.status === 'PUBLISHED' && newContent.status !== 'PUBLISHED') {
      this.logger.log(`Movie unpublished: ${newContent.title}`);
      // Optionally notify users about removal
    }
  }

  /**
   * Handle content being deleted
   */
  private async handleContentDelete(content: any) {
    if (content.content_type !== 'movie') return;

    this.logger.log(`Movie deleted: ${content.title}`);

    const message = `🗑️ **Filme Removido**

O filme **${content.title}** foi removido do catálogo.

Use /catalogo para ver os filmes disponíveis.`;

    await this.broadcastToActiveUsers(message, {
      inline_keyboard: [
        [{ text: '🎬 Ver Catálogo Atualizado', callback_data: 'catalog' }],
      ],
    });
  }

  /**
   * Broadcast message to all active users
   */
  private async broadcastToActiveUsers(message: string, replyMarkup?: any) {
    const activeUsersList = Array.from(this.activeUsers.values());

    if (activeUsersList.length === 0) {
      this.logger.log('No active users to broadcast to');
      return;
    }

    this.logger.log(`Broadcasting to ${activeUsersList.length} active users`);

    for (const user of activeUsersList) {
      try {
        await this.telegramsEnhancedService.sendMessage(user.chat_id, message, {
          parse_mode: 'Markdown',
          reply_markup: replyMarkup,
        });
      } catch (error) {
        this.logger.error(`Failed to send message to user ${user.chat_id}:`, error);
        // Remove inactive user
        this.activeUsers.delete(user.chat_id);
      }
    }
  }

  /**
   * Register a user as active (called when they interact with the bot)
   */
  registerActiveUser(chatId: number, telegramUserId: number) {
    this.activeUsers.set(chatId, {
      chat_id: chatId,
      telegram_user_id: telegramUserId,
      last_interaction: new Date(),
    });

    this.logger.log(`Registered active user: ${chatId}`);

    // Clean up old users (not interacted in 30 days)
    this.cleanupInactiveUsers();
  }

  /**
   * Remove users who haven't interacted in 30 days
   */
  private cleanupInactiveUsers() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    for (const [chatId, user] of this.activeUsers.entries()) {
      if (user.last_interaction < thirtyDaysAgo) {
        this.activeUsers.delete(chatId);
        this.logger.log(`Removed inactive user: ${chatId}`);
      }
    }
  }

  /**
   * Get count of active users
   */
  getActiveUsersCount(): number {
    return this.activeUsers.size;
  }
}
