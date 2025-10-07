import { Injectable, Logger } from '@nestjs/common';
import { createHmac } from 'crypto';
import axios from 'axios';

@Injectable()
export class TelegramsService {
  private readonly logger = new Logger(TelegramsService.name);
  private readonly botToken = process.env.TELEGRAM_BOT_TOKEN;
  private readonly webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  private readonly botApiUrl = `https://api.telegram.org/bot${this.botToken}`;

  constructor() {
    this.logger.log('TelegramsService initialized');
    this.logger.log(`Bot token configured: ${!!this.botToken}`);
    this.logger.log(`Webhook secret configured: ${!!this.webhookSecret}`);
  }

  async handleWebhook(webhookData: any, signature?: string) {
    try {
      // Validate webhook signature if provided
      if (signature && this.webhookSecret) {
        const isValid = this.validateWebhookSignature(webhookData, signature);
        if (!isValid) {
          this.logger.warn('Invalid webhook signature');
          return { status: 'invalid_signature' };
        }
      }

      // Process different types of updates
      if (webhookData.message) {
        await this.processMessage(webhookData.message);
      } else if (webhookData.callback_query) {
        await this.processCallbackQuery(webhookData.callback_query);
      } else if (webhookData.pre_checkout_query) {
        await this.processPreCheckoutQuery(webhookData.pre_checkout_query);
      }

      return { status: 'processed' };
    } catch (error) {
      this.logger.error('Error processing webhook:', error);
      return { status: 'error', error: error.message };
    }
  }

  private validateWebhookSignature(data: any, signature: string): boolean {
    const secretKey = createHmac('sha256', 'WebAppData').update(this.webhookSecret).digest();
    const expectedSignature = createHmac('sha256', secretKey)
      .update(JSON.stringify(data))
      .digest('hex');
    
    return signature === expectedSignature;
  }

  private async processMessage(message: any) {
    const chatId = message.chat.id;
    const text = message.text;

    if (text?.startsWith('/start')) {
      await this.handleStartCommand(chatId, text);
    } else if (text === '/help' || text === '/ajuda') {
      await this.handleHelpCommand(chatId);
    } else if (text === '/minhas-compras' || text === '/my-purchases') {
      await this.handleMyPurchasesCommand(chatId, message.from.id);
    } else if (text?.startsWith('/pedir ')) {
      const movieTitle = text.substring(7);
      await this.handleMovieRequest(chatId, message.from.id, movieTitle);
    }
  }

  private async processCallbackQuery(callbackQuery: any) {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;
    const userId = callbackQuery.from.id;

    // Answer callback query to remove loading state
    await this.answerCallbackQuery(callbackQuery.id);

    if (data?.startsWith('pay_')) {
      await this.handlePaymentCallback(chatId, data);
    } else if (data?.startsWith('watch_')) {
      await this.handleWatchCallback(chatId, userId, data);
    } else if (data?.startsWith('download_')) {
      await this.handleDownloadCallback(chatId, userId, data);
    }
  }

  private async processPreCheckoutQuery(preCheckoutQuery: any) {
    // Always approve pre-checkout for now
    await this.answerPreCheckoutQuery(preCheckoutQuery.id, true);
  }

  private async handleStartCommand(chatId: number, text: string) {
    const parts = text.split(' ');
    if (parts.length > 1) {
      const purchaseToken = parts[1];
      await this.showPurchaseSummary(chatId, purchaseToken);
    } else {
      await this.showWelcomeMessage(chatId);
    }
  }

  private async handleHelpCommand(chatId: number) {
    const helpMessage = `🤖 **Comandos Disponíveis:**

/start - Iniciar o bot
/minhas-compras - Ver suas compras
/ajuda - Mostrar esta ajuda
/pedir <título> - Solicitar um filme

💡 **Dicas:**
• Use os botões para navegar facilmente
• Receba notificações de novos lançamentos
• Assista online ou baixe seus filmes

🎬 Aproveite nosso catálogo!`;

    await this.sendMessage(chatId, helpMessage, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🎬 Ver Catálogo', callback_data: 'catalog' }],
          [{ text: '📱 Minhas Compras', callback_data: 'my_purchases' }]
        ]
      }
    });
  }

  private async showWelcomeMessage(chatId: number) {
    const welcomeMessage = `🎬 **Bem-vindo ao Cinema Bot!**

Aqui você pode:
• 🛒 Comprar filmes
• 📱 Assistir online
• 💾 Baixar para o Telegram
• 🔔 Receber notificações de lançamentos

Use /ajuda para ver todos os comandos.`;

    await this.sendMessage(chatId, welcomeMessage, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🎬 Ver Catálogo', callback_data: 'catalog' }],
          [{ text: '❓ Ajuda', callback_data: 'help' }]
        ]
      }
    });
  }

  async sendNotification(chatId: string, message: string) {
    try {
      await this.sendMessage(parseInt(chatId), message);
      return { status: 'sent' };
    } catch (error) {
      this.logger.error('Error sending notification:', error);
      return { status: 'error', error: error.message };
    }
  }

  async sendPaymentConfirmation(chatId: string, purchaseData: any) {
    try {
      const message = `✅ **Pagamento Confirmado!**

🎬 **${purchaseData.content.title}**
💰 Valor: R$ ${purchaseData.amount.toFixed(2)}

Seu filme está pronto! Escolha como assistir:`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: '▶️ Assistir Online', callback_data: `watch_${purchaseData.id}` },
            { text: '💾 Baixar', callback_data: `download_${purchaseData.id}` }
          ],
          [
            { text: '📱 Minhas Compras', callback_data: 'my_purchases' }
          ]
        ]
      };

      await this.sendMessage(parseInt(chatId), message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });

      return { status: 'sent' };
    } catch (error) {
      this.logger.error('Error sending payment confirmation:', error);
      return { status: 'error', error: error.message };
    }
  }

  async sendNewReleaseNotification(chatId: string, movieData: any) {
    try {
      const message = `🆕 **Novo Lançamento!**

🎬 **${movieData.title}**
⭐ ${movieData.rating}/10
🎭 ${movieData.genre}
⏱️ ${movieData.duration} min

${movieData.description}

💰 Por apenas R$ ${movieData.price.toFixed(2)}`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: '🛒 Comprar Agora', callback_data: `buy_${movieData.id}` }
          ],
          [
            { text: '🎬 Ver Catálogo', callback_data: 'catalog' },
            { text: '🔕 Desativar Notificações', callback_data: 'disable_notifications' }
          ]
        ]
      };

      await this.sendMessage(parseInt(chatId), message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });

      return { status: 'sent' };
    } catch (error) {
      this.logger.error('Error sending new release notification:', error);
      return { status: 'error', error: error.message };
    }
  }

  // Helper methods for Telegram Bot API calls
  private async sendMessage(chatId: number, text: string, options?: any) {
    const url = `${this.botApiUrl}/sendMessage`;
    const payload = {
      chat_id: chatId,
      text,
      ...options
    };

    const response = await axios.post(url, payload);
    return response.data;
  }

  private async answerCallbackQuery(callbackQueryId: string, text?: string) {
    const url = `${this.botApiUrl}/answerCallbackQuery`;
    const payload = {
      callback_query_id: callbackQueryId,
      text
    };

    const response = await axios.post(url, payload);
    return response.data;
  }

  private async answerPreCheckoutQuery(preCheckoutQueryId: string, ok: boolean, errorMessage?: string) {
    const url = `${this.botApiUrl}/answerPreCheckoutQuery`;
    const payload = {
      pre_checkout_query_id: preCheckoutQueryId,
      ok,
      error_message: errorMessage
    };

    const response = await axios.post(url, payload);
    return response.data;
  }

  // Placeholder methods for callback handlers
  private async handleMyPurchasesCommand(chatId: number, userId: number) {
    // This would integrate with the purchases service
    await this.sendMessage(chatId, '📱 Carregando suas compras...');
  }

  private async handleMovieRequest(chatId: number, userId: number, movieTitle: string) {
    // This would integrate with the requests service
    await this.sendMessage(chatId, `✅ Solicitação recebida: "${movieTitle}"\n\nVamos analisar e te avisar quando estiver disponível!`);
  }

  private async showPurchaseSummary(chatId: number, purchaseToken: string) {
    // This would integrate with the purchases service to show purchase details
    await this.sendMessage(chatId, '🛒 Carregando detalhes da compra...');
  }

  private async handlePaymentCallback(chatId: number, data: string) {
    await this.sendMessage(chatId, '💳 Processando pagamento...');
  }

  private async handleWatchCallback(chatId: number, userId: number, data: string) {
    await this.sendMessage(chatId, '▶️ Preparando link para assistir...');
  }

  private async handleDownloadCallback(chatId: number, userId: number, data: string) {
    await this.sendMessage(chatId, '💾 Preparando download...');
  }

  async setupWebhook(url: string, secretToken?: string) {
    try {
      const webhookUrl = `${this.botApiUrl}/setWebhook`;
      const payload: any = {
        url,
        allowed_updates: ['message', 'callback_query', 'pre_checkout_query']
      };

      if (secretToken) {
        payload.secret_token = secretToken;
      }

      const response = await axios.post(webhookUrl, payload);
      
      if (response.data.ok) {
        this.logger.log(`Webhook configured successfully: ${url}`);
        return { status: 'success', data: response.data };
      } else {
        this.logger.error('Failed to setup webhook:', response.data);
        return { status: 'error', error: response.data.description };
      }
    } catch (error) {
      this.logger.error('Error setting up webhook:', error);
      return { status: 'error', error: error.message };
    }
  }
}