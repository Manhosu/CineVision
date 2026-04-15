import TelegramBotAPI from 'node-telegram-bot-api';
import axios from 'axios';
import { startHandler } from './handlers/start.handler';
import { helpHandler, handleHelpCallback } from './handlers/help.handler';
import { loginHandler } from './handlers/login.handler';
import { paymentHandler } from './handlers/payment.handler';
import { catalogHandler, handleCatalogCallback } from './handlers/catalog.handler';
import { myMoviesHandler, handleMyMoviesCallback } from './handlers/my-movies.handler';
import { handleNotificationsCallback } from './handlers/notifications.handler';
import { handlePixPayment, handleCardPayment, handleCheckPayment, handleCancelPayment } from './handlers/payment-callback.handler';
import { ContentDeliveryService } from './services/content-delivery.service';
import { SecurityService } from './services/security.service';
import { NotificationService } from './services/notification.service';

export class TelegramBot {
  private bot: TelegramBotAPI;
  private notificationService: NotificationService;
  private token: string;

  constructor(token?: string) {
    this.token = token || process.env.TELEGRAM_BOT_TOKEN!;
    
    if (!this.token) {
      throw new Error('TELEGRAM_BOT_TOKEN is required');
    }

    // Determine bot mode: polling (development) or webhook (production)
    const botMode = process.env.BOT_MODE || 'webhook';
    const isPolling = botMode === 'polling';

    if (isPolling) {
      // Polling mode for development
      console.log('Bot starting in POLLING mode (development)');
      this.bot = new TelegramBotAPI(this.token, {
        polling: true
      });
    } else {
      // Webhook mode for production
      console.log('Bot starting in WEBHOOK mode (production)');
      this.bot = new TelegramBotAPI(this.token, {
        polling: false,
        webHook: {
          port: parseInt(process.env.BOT_PORT || '3003')
        }
      });
    }

    this.notificationService = new NotificationService(this.bot);
    this.setupCommands();
    this.setupCallbacks();
  }

  private setupCommands() {
    // Basic commands - pass bot instance to handlers
    this.bot.onText(/\/start(.*)/, (msg, match) => startHandler(this.bot, msg, match));
    this.bot.onText(/\/help/, (msg) => helpHandler(this.bot, msg));
    this.bot.onText(/\/ajuda/, (msg) => helpHandler(this.bot, msg));
    this.bot.onText(/\/login(.*)/, (msg, match) => loginHandler(this.bot, msg, match));

    // Movie and catalog commands
    this.bot.onText(/\/catalogo/, (msg) => catalogHandler(this.bot, msg));
    this.bot.onText(/\/catalog/, (msg) => catalogHandler(this.bot, msg));
    this.bot.onText(/\/meus_filmes/, (msg) => myMoviesHandler(this.bot, msg));
    this.bot.onText(/\/my_movies/, (msg) => myMoviesHandler(this.bot, msg));
    this.bot.onText(/\/minhas-compras/, (msg) => this.showPurchasesHandler(this.bot, msg));
    this.bot.onText(/\/my-purchases/, (msg) => this.showPurchasesHandler(this.bot, msg));
    
    // Movie request command
    this.bot.onText(/\/pedir (.+)/, (msg, match) => this.handleMovieRequest(this.bot, msg, match));

    // Payment related commands
    this.bot.onText(/\/buy_(.+)/, (msg, match) => paymentHandler(this.bot, msg, match));
  }

  private setupCallbacks() {
    // Handle callback queries (inline keyboard buttons)
    this.bot.on('callback_query', async (callbackQuery) => {
      const { data, message } = callbackQuery;
      const chatId = message?.chat.id;

      if (!chatId || !data) return;

      try {
        // Parse callback data
        const [action, ...params] = data.split('_');

        // Route callbacks to appropriate handlers
        if (data.startsWith('catalog_') || data.startsWith('movie_') || data.startsWith('purchase_') || data.startsWith('trailer_') || data.startsWith('favorite_') || data.startsWith('delivery_')) {
          await handleCatalogCallback(this.bot, callbackQuery);
          return;
        }

        if (data.startsWith('help_')) {
          await handleHelpCallback(this.bot, callbackQuery);
          return;
        }

        if (data.startsWith('download_') || data.startsWith('watch_') || data.startsWith('rate_') || data.startsWith('app_') || data === 'purchase_history' || data === 'my_movies') {
          await handleMyMoviesCallback(this.bot, callbackQuery);
          return;
        }

        if (data.startsWith('notifications_') || data.startsWith('flash_promo_') || 
            data === 'disable_notifications' || 
            data === 'disable_promotions' || 
            data === 'enable_notifications') {
          await this.notificationService.handleNotificationCallback(callbackQuery);
          return;
        }

        if (data.startsWith('delivery_')) {
          await this.handleDeliverySelection(chatId, data);
          return;
        }

        if (data === 'my_purchases') {
          await this.showPurchasesHandler(this.bot, message!);
          return;
        }

        // Handle main menu navigation
        if (data === 'main_menu') {
          await this.showMainMenu(chatId);
          return;
        }

        // Handle payment callbacks
        if (data.startsWith('pay_pix_')) {
          const purchaseToken = data.replace('pay_pix_', '').replace('streaming_', '');
          await handlePixPayment(this.bot, callbackQuery, purchaseToken);
          return;
        }

        if (data.startsWith('pay_card_')) {
          const purchaseToken = data.replace('pay_card_', '').replace('streaming_', '');
          await handleCardPayment(this.bot, callbackQuery, purchaseToken);
          return;
        }

        if (data.startsWith('check_payment_')) {
          const purchaseId = data.replace('check_payment_', '');
          await handleCheckPayment(this.bot, callbackQuery, purchaseId);
          return;
        }

        if (data.startsWith('cancel_payment_')) {
          const purchaseId = data.replace('cancel_payment_', '');
          await handleCancelPayment(this.bot, callbackQuery, purchaseId);
          return;
        }

        switch (action) {
          case 'pay':
            // Handle payment method selection: pay_pix_token or pay_card_token (legacy)
            await this.handlePaymentMethod(chatId, params[0], params[1]);
            break;
          case 'cancel':
            // Handle purchase cancellation (legacy)
            await this.handleCancelPurchase(chatId, params[0]);
            break;
          case 'buy':
            // Handle movie purchase (legacy)
            await this.handlePurchase(chatId, params[0]);
            break;
          case 'watch':
            // Handle watch movie
            await this.handleWatchCallback(callbackQuery);
            break;
          case 'download':
            // Handle download movie
            await this.handleDownload(chatId, params[0]);
            break;
          default:
            console.log(`Unknown callback action: ${action}`);
        }
      } catch (error) {
        console.error('Error handling callback query:', error);
        await this.bot.sendMessage(
          chatId,
          '❌ Ocorreu um erro ao processar sua solicitação. Tente novamente.'
        );
      }

      // Answer callback query to remove loading state
      await this.bot.answerCallbackQuery(callbackQuery.id);
    });
  }

  private async handlePurchase(chatId: number, movieId: string) {
    // TODO: Implement purchase flow
    await this.bot.sendMessage(chatId, `Iniciando compra do filme ${movieId}...`);
  }

  private async handleWatch(chatId: number, movieId: string) {
    // TODO: Implement watch flow
    await this.bot.sendMessage(chatId, `Redirecionando para assistir filme ${movieId}...`);
  }

  private async handleDownload(chatId: number, movieId: string) {
    // TODO: Implement download flow
    await this.bot.sendMessage(chatId, `Preparando download do filme ${movieId}...`);
  }

  private async handlePaymentMethod(chatId: number, method: string, purchaseToken: string) {
    if (method === 'pix') {
      await this.handlePixPayment(chatId, purchaseToken);
    } else if (method === 'card') {
      await this.handleCardPayment(chatId, purchaseToken);
    }
  }

  private async handlePixPayment(chatId: number, purchaseToken: string) {
    const pixMessage = `📱 **Pagamento via PIX**

🔸 **Chave PIX:** \`${process.env.PIX_KEY || 'pix@cinevision.com'}\`
🔸 **Valor:** R$ (Será atualizado automaticamente)

📋 **Instruções:**
1. Copie a chave PIX acima
2. Abra seu app do banco
3. Faça o pagamento para a chave copiada
4. ⏱️ O pagamento será confirmado automaticamente em até 5 minutos

❗ **Importante:** Não altere o valor do PIX, pois isso pode atrasar a confirmação.`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '📱 Copiar Chave PIX', callback_data: `copy_pix_${purchaseToken}` }
        ],
        [
          { text: '✅ Já Fiz o PIX', callback_data: `confirm_pix_${purchaseToken}` },
          { text: '❌ Cancelar', callback_data: `cancel_${purchaseToken}` }
        ]
      ]
    };

    await this.bot.sendMessage(chatId, pixMessage, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }

  private async handleCardPayment(chatId: number, purchaseToken: string) {
    const cardMessage = `💳 **Pagamento via Cartão**

🔸 Em breve você será redirecionado para o link de pagamento seguro
🔸 Aceitamos todas as bandeiras: Visa, MasterCard, Elo, etc.
🔸 Pagamento processado em até 2 minutos

🔒 **Segurança garantida** - Utilizamos criptografia SSL`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '💳 Pagar com Cartão', url: `${process.env.PAYMENT_GATEWAY_URL}/${purchaseToken}` }
        ],
        [
          { text: '❌ Cancelar', callback_data: `cancel_${purchaseToken}` }
        ]
      ]
    };

    await this.bot.sendMessage(chatId, cardMessage, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }

  private async handleCancelPurchase(chatId: number, purchaseToken: string) {
    await this.bot.sendMessage(
      chatId,
      '❌ **Compra cancelada**\n\nVocê pode iniciar uma nova compra a qualquer momento através do nosso site.',
      { parse_mode: 'Markdown' }
    );
  }

  public async sendMessage(chatId: number | string, text: string, options?: any) {
    return this.bot.sendMessage(chatId, text, options);
  }

  public async sendPhoto(chatId: number | string, photo: string, options?: any) {
    return this.bot.sendPhoto(chatId, photo, options);
  }

  public async sendDocument(chatId: number | string, document: string, options?: any) {
    return this.bot.sendDocument(chatId, document, options);
  }

  public stop() {
    this.bot.stopPolling();
    console.log('Telegram Bot stopped');
  }

  private async showMainMenu(chatId: number) {
    const message = `🎬 **CINE VISION** - Menu Principal

🍿 O que você quer fazer?`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '🎬 Ver Filmes', callback_data: 'catalog_menu' },
          { text: '📱 Meus Filmes', callback_data: 'my_movies' }
        ],
        [
          { text: '🆘 Ajuda', callback_data: 'help_menu' }
        ]
      ]
    };

    await this.bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }

  private async handleDeliverySelection(chatId: number, data: string) {
    const parts = data.split('_');
    const deliveryType = parts[1]; // telegram or streaming
    const movieId = parts[2] || 'unknown';

    if (deliveryType === 'telegram') {
      const message = `💳 **ESCOLHA COMO PAGAR**

🎬 Filme selecionado
💰 R$ 19,90
📦 Download Telegram

Selecione o pagamento:`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: '📱 PIX (Instantâneo)', callback_data: `pay_pix_${movieId}` }
          ],
          [
            { text: '💳 Cartão', callback_data: `pay_card_${movieId}` }
          ],
          [
            { text: '❌ Cancelar', callback_data: 'catalog_menu' }
          ]
        ]
      };

      await this.bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
    } else if (deliveryType === 'streaming') {
      const message = `💳 **ESCOLHA COMO PAGAR**

🎬 Filme selecionado
💰 R$ 19,90
📦 Assistir Online

Selecione o pagamento:`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: '📱 PIX (Instantâneo)', callback_data: `pay_pix_streaming_${movieId}` }
          ],
          [
            { text: '💳 Cartão', callback_data: `pay_card_streaming_${movieId}` }
          ],
          [
            { text: '❌ Cancelar', callback_data: 'catalog_menu' }
          ]
        ]
      };

      await this.bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
    }
  }

  private async showPurchasesHandler(bot: TelegramBotAPI, msg: TelegramBotAPI.Message) {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id;

    try {
      // Fetch user purchases from backend using authenticated request
      const purchases = await SecurityService.makeAuthenticatedRequest(
        'GET',
        `${process.env.BACKEND_URL}/api/purchases/user/${telegramId}`
      );

      if (!purchases || purchases.length === 0) {
        await bot.sendMessage(chatId, `📋 **MINHAS COMPRAS**

Você ainda não fez nenhuma compra.

🎬 Explore nosso catálogo e encontre filmes incríveis!`, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🎬 Ver Catálogo', callback_data: 'catalog_menu' }]
            ]
          }
        });
        return;
      }

      let message = `📋 **MINHAS COMPRAS**\n\n`;
      const keyboard = [];

      for (const purchase of purchases.slice(0, 5)) { // Show last 5 purchases
        const status = this.getStatusEmoji(purchase.status);
        const amount = (purchase.amount_cents / 100).toFixed(2);
        const date = new Date(purchase.created_at).toLocaleDateString('pt-BR');
        
        message += `${status} **${purchase.content.title}**\n`;
        message += `💰 R$ ${amount} | 📅 ${date}\n`;
        message += `Status: ${this.getStatusText(purchase.status)}\n\n`;

        if (purchase.status === 'paid') {
          keyboard.push([
            { text: `🎬 Assistir: ${purchase.content.title}`, callback_data: `watch_${purchase.id}` }
          ]);
        }
      }

      keyboard.push([{ text: '🎬 Ver Catálogo', callback_data: 'catalog_menu' }]);

      await bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      });

    } catch (error) {
      console.error('Error fetching purchases:', error);
      await bot.sendMessage(chatId, `❌ Erro ao buscar suas compras. Tente novamente mais tarde.`);
    }
  }

  private async handleMovieRequest(bot: TelegramBotAPI, msg: TelegramBotAPI.Message, match: RegExpExecArray | null) {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id;
    const movieTitle = match?.[1]?.trim();

    if (!movieTitle) {
      await bot.sendMessage(chatId, `❌ Por favor, especifique o título do filme.\n\nExemplo: /pedir Nome do Filme`);
      return;
    }

    try {
      // Send request to backend using authenticated request
      const requestData = {
        title: movieTitle,
        telegram_id: telegramId,
        telegram_username: msg.from?.username,
        telegram_first_name: msg.from?.first_name
      };

      await SecurityService.makeAuthenticatedRequest(
        'POST',
        `${process.env.BACKEND_URL}/api/requests`,
        requestData
      );

      await bot.sendMessage(chatId, `✅ **Pedido Registrado!**

🎬 **${movieTitle}**

Seu pedido foi registrado com sucesso! Nossa equipe irá analisar e, se possível, adicionar este filme ao catálogo.

📧 Você será notificado quando o filme estiver disponível.

Obrigado pela sugestão! 🙏`, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🎬 Ver Catálogo', callback_data: 'catalog_menu' }]
          ]
        }
      });

    } catch (error) {
      console.error('Error creating movie request:', error);
      await bot.sendMessage(chatId, `❌ Erro ao registrar seu pedido. Tente novamente mais tarde.`);
    }
  }

  private getStatusEmoji(status: string): string {
    switch (status) {
      case 'paid': return '✅';
      case 'pending': return '⏳';
      case 'failed': return '❌';
      case 'cancelled': return '🚫';
      default: return '❓';
    }
  }

  private getStatusText(status: string): string {
    switch (status) {
      case 'paid': return 'Pago';
      case 'pending': return 'Aguardando pagamento';
      case 'failed': return 'Falhou';
      case 'cancelled': return 'Cancelado';
      default: return 'Desconhecido';
    }
  }

  private async handleWatchCallback(callbackQuery: TelegramBotAPI.CallbackQuery) {
    const chatId = callbackQuery.message?.chat.id;
    const data = callbackQuery.data;
    
    if (!chatId || !data) return;
    
    const purchaseId = data.split('_')[1];
    
    try {
      // Get purchase details and streaming link
      const purchase = await SecurityService.makeAuthenticatedRequest(
        'GET',
        `${process.env.BACKEND_URL}/api/purchases/${purchaseId}`
      );
      
      if (!purchase || purchase.status !== 'paid') {
        await this.bot.sendMessage(chatId, '❌ Filme não encontrado ou pagamento pendente.');
        return;
      }
      
      const streamingUrl = `${process.env.STREAMING_URL}/watch/${purchase.content.id}?token=${purchase.access_token}`;
      
      const message = `🎬 **${purchase.content.title}**

✨ Seu filme está pronto para assistir!

🔗 Clique no botão abaixo para começar:`;
      
      const dashboardUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard`;
      const keyboard = {
        inline_keyboard: [
          [
            { text: '🎬 Assistir Agora', url: dashboardUrl }
          ],
          [
            { text: '🔙 Voltar', callback_data: 'my_movies' }
          ]
        ]
      };
      
      await this.bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
      
    } catch (error) {
      console.error('Error handling watch callback:', error);
      await this.bot.sendMessage(chatId, '❌ Erro ao acessar o filme. Tente novamente.');
    }
  }

  public getBot() {
    return this.bot;
  }
}