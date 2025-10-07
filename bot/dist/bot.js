"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelegramBot = void 0;
const node_telegram_bot_api_1 = __importDefault(require("node-telegram-bot-api"));
const start_handler_1 = require("./handlers/start.handler");
const help_handler_1 = require("./handlers/help.handler");
const login_handler_1 = require("./handlers/login.handler");
const payment_handler_1 = require("./handlers/payment.handler");
const catalog_handler_1 = require("./handlers/catalog.handler");
const my_movies_handler_1 = require("./handlers/my-movies.handler");
const payment_callback_handler_1 = require("./handlers/payment-callback.handler");
const security_service_1 = require("./services/security.service");
const notification_service_1 = require("./services/notification.service");
class TelegramBot {
    constructor(token) {
        this.token = token || process.env.TELEGRAM_BOT_TOKEN;
        if (!this.token) {
            throw new Error('TELEGRAM_BOT_TOKEN is required');
        }
        const botMode = process.env.BOT_MODE || 'webhook';
        const isPolling = botMode === 'polling';
        if (isPolling) {
            console.log('Bot starting in POLLING mode (development)');
            this.bot = new node_telegram_bot_api_1.default(this.token, {
                polling: true
            });
        }
        else {
            console.log('Bot starting in WEBHOOK mode (production)');
            this.bot = new node_telegram_bot_api_1.default(this.token, {
                polling: false,
                webHook: {
                    port: parseInt(process.env.BOT_PORT || '3003')
                }
            });
        }
        this.notificationService = new notification_service_1.NotificationService(this.bot);
        this.setupCommands();
        this.setupCallbacks();
    }
    setupCommands() {
        this.bot.onText(/\/start(.*)/, (msg, match) => (0, start_handler_1.startHandler)(this.bot, msg, match));
        this.bot.onText(/\/help/, (msg) => (0, help_handler_1.helpHandler)(this.bot, msg));
        this.bot.onText(/\/ajuda/, (msg) => (0, help_handler_1.helpHandler)(this.bot, msg));
        this.bot.onText(/\/login(.*)/, (msg, match) => (0, login_handler_1.loginHandler)(this.bot, msg, match));
        this.bot.onText(/\/catalogo/, (msg) => (0, catalog_handler_1.catalogHandler)(this.bot, msg));
        this.bot.onText(/\/catalog/, (msg) => (0, catalog_handler_1.catalogHandler)(this.bot, msg));
        this.bot.onText(/\/meus_filmes/, (msg) => (0, my_movies_handler_1.myMoviesHandler)(this.bot, msg));
        this.bot.onText(/\/my_movies/, (msg) => (0, my_movies_handler_1.myMoviesHandler)(this.bot, msg));
        this.bot.onText(/\/minhas-compras/, (msg) => this.showPurchasesHandler(this.bot, msg));
        this.bot.onText(/\/my-purchases/, (msg) => this.showPurchasesHandler(this.bot, msg));
        this.bot.onText(/\/pedir (.+)/, (msg, match) => this.handleMovieRequest(this.bot, msg, match));
        this.bot.onText(/\/buy_(.+)/, (msg, match) => (0, payment_handler_1.paymentHandler)(this.bot, msg, match));
    }
    setupCallbacks() {
        this.bot.on('callback_query', async (callbackQuery) => {
            const { data, message } = callbackQuery;
            const chatId = message?.chat.id;
            if (!chatId || !data)
                return;
            try {
                const [action, ...params] = data.split('_');
                if (data.startsWith('catalog_') || data.startsWith('movie_') || data.startsWith('purchase_') || data.startsWith('trailer_') || data.startsWith('favorite_') || data.startsWith('delivery_')) {
                    await (0, catalog_handler_1.handleCatalogCallback)(this.bot, callbackQuery);
                    return;
                }
                if (data.startsWith('help_')) {
                    await (0, help_handler_1.handleHelpCallback)(this.bot, callbackQuery);
                    return;
                }
                if (data.startsWith('download_') || data.startsWith('watch_') || data.startsWith('rate_') || data.startsWith('app_') || data === 'purchase_history' || data === 'my_movies') {
                    await (0, my_movies_handler_1.handleMyMoviesCallback)(this.bot, callbackQuery);
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
                    await this.showPurchasesHandler(this.bot, message);
                    return;
                }
                if (data === 'main_menu') {
                    await this.showMainMenu(chatId);
                    return;
                }
                if (data.startsWith('pay_pix_')) {
                    const purchaseToken = data.replace('pay_pix_', '').replace('streaming_', '');
                    await (0, payment_callback_handler_1.handlePixPayment)(this.bot, callbackQuery, purchaseToken);
                    return;
                }
                if (data.startsWith('pay_card_')) {
                    const purchaseToken = data.replace('pay_card_', '').replace('streaming_', '');
                    await (0, payment_callback_handler_1.handleCardPayment)(this.bot, callbackQuery, purchaseToken);
                    return;
                }
                if (data.startsWith('check_payment_')) {
                    const purchaseId = data.replace('check_payment_', '');
                    await (0, payment_callback_handler_1.handleCheckPayment)(this.bot, callbackQuery, purchaseId);
                    return;
                }
                if (data.startsWith('cancel_payment_')) {
                    const purchaseId = data.replace('cancel_payment_', '');
                    await (0, payment_callback_handler_1.handleCancelPayment)(this.bot, callbackQuery, purchaseId);
                    return;
                }
                switch (action) {
                    case 'pay':
                        await this.handlePaymentMethod(chatId, params[0], params[1]);
                        break;
                    case 'cancel':
                        await this.handleCancelPurchase(chatId, params[0]);
                        break;
                    case 'buy':
                        await this.handlePurchase(chatId, params[0]);
                        break;
                    case 'watch':
                        await this.handleWatchCallback(callbackQuery);
                        break;
                    case 'download':
                        await this.handleDownload(chatId, params[0]);
                        break;
                    default:
                        console.log(`Unknown callback action: ${action}`);
                }
            }
            catch (error) {
                console.error('Error handling callback query:', error);
                await this.bot.sendMessage(chatId, '❌ Ocorreu um erro ao processar sua solicitação. Tente novamente.');
            }
            await this.bot.answerCallbackQuery(callbackQuery.id);
        });
    }
    async handlePurchase(chatId, movieId) {
        await this.bot.sendMessage(chatId, `Iniciando compra do filme ${movieId}...`);
    }
    async handleWatch(chatId, movieId) {
        await this.bot.sendMessage(chatId, `Redirecionando para assistir filme ${movieId}...`);
    }
    async handleDownload(chatId, movieId) {
        await this.bot.sendMessage(chatId, `Preparando download do filme ${movieId}...`);
    }
    async handlePaymentMethod(chatId, method, purchaseToken) {
        if (method === 'pix') {
            await this.handlePixPayment(chatId, purchaseToken);
        }
        else if (method === 'card') {
            await this.handleCardPayment(chatId, purchaseToken);
        }
    }
    async handlePixPayment(chatId, purchaseToken) {
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
    async handleCardPayment(chatId, purchaseToken) {
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
    async handleCancelPurchase(chatId, purchaseToken) {
        await this.bot.sendMessage(chatId, '❌ **Compra cancelada**\n\nVocê pode iniciar uma nova compra a qualquer momento através do nosso site.', { parse_mode: 'Markdown' });
    }
    async sendMessage(chatId, text, options) {
        return this.bot.sendMessage(chatId, text, options);
    }
    async sendPhoto(chatId, photo, options) {
        return this.bot.sendPhoto(chatId, photo, options);
    }
    async sendDocument(chatId, document, options) {
        return this.bot.sendDocument(chatId, document, options);
    }
    stop() {
        this.bot.stopPolling();
        console.log('Telegram Bot stopped');
    }
    async showMainMenu(chatId) {
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
    async handleDeliverySelection(chatId, data) {
        const parts = data.split('_');
        const deliveryType = parts[1];
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
        }
        else if (deliveryType === 'streaming') {
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
    async showPurchasesHandler(bot, msg) {
        const chatId = msg.chat.id;
        const telegramId = msg.from?.id;
        try {
            const purchases = await security_service_1.SecurityService.makeAuthenticatedRequest('GET', `${process.env.BACKEND_URL}/api/purchases/user/${telegramId}`);
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
            for (const purchase of purchases.slice(0, 5)) {
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
        }
        catch (error) {
            console.error('Error fetching purchases:', error);
            await bot.sendMessage(chatId, `❌ Erro ao buscar suas compras. Tente novamente mais tarde.`);
        }
    }
    async handleMovieRequest(bot, msg, match) {
        const chatId = msg.chat.id;
        const telegramId = msg.from?.id;
        const movieTitle = match?.[1]?.trim();
        if (!movieTitle) {
            await bot.sendMessage(chatId, `❌ Por favor, especifique o título do filme.\n\nExemplo: /pedir Vingadores Ultimato`);
            return;
        }
        try {
            const requestData = {
                title: movieTitle,
                telegram_id: telegramId,
                telegram_username: msg.from?.username,
                telegram_first_name: msg.from?.first_name
            };
            await security_service_1.SecurityService.makeAuthenticatedRequest('POST', `${process.env.BACKEND_URL}/api/requests`, requestData);
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
        }
        catch (error) {
            console.error('Error creating movie request:', error);
            await bot.sendMessage(chatId, `❌ Erro ao registrar seu pedido. Tente novamente mais tarde.`);
        }
    }
    getStatusEmoji(status) {
        switch (status) {
            case 'paid': return '✅';
            case 'pending': return '⏳';
            case 'failed': return '❌';
            case 'cancelled': return '🚫';
            default: return '❓';
        }
    }
    getStatusText(status) {
        switch (status) {
            case 'paid': return 'Pago';
            case 'pending': return 'Aguardando pagamento';
            case 'failed': return 'Falhou';
            case 'cancelled': return 'Cancelado';
            default: return 'Desconhecido';
        }
    }
    async handleWatchCallback(callbackQuery) {
        const chatId = callbackQuery.message?.chat.id;
        const data = callbackQuery.data;
        if (!chatId || !data)
            return;
        const purchaseId = data.split('_')[1];
        try {
            const purchase = await security_service_1.SecurityService.makeAuthenticatedRequest('GET', `${process.env.BACKEND_URL}/api/purchases/${purchaseId}`);
            if (!purchase || purchase.status !== 'paid') {
                await this.bot.sendMessage(chatId, '❌ Filme não encontrado ou pagamento pendente.');
                return;
            }
            const streamingUrl = `${process.env.STREAMING_URL}/watch/${purchase.content.id}?token=${purchase.access_token}`;
            const message = `🎬 **${purchase.content.title}**

✨ Seu filme está pronto para assistir!

🔗 Clique no botão abaixo para começar:`;
            const keyboard = {
                inline_keyboard: [
                    [
                        { text: '▶️ Assistir Agora', url: streamingUrl }
                    ],
                    [
                        { text: '📱 Baixar no Telegram', callback_data: `download_${purchaseId}` }
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
        }
        catch (error) {
            console.error('Error handling watch callback:', error);
            await this.bot.sendMessage(chatId, '❌ Erro ao acessar o filme. Tente novamente.');
        }
    }
    getBot() {
        return this.bot;
    }
}
exports.TelegramBot = TelegramBot;
//# sourceMappingURL=bot.js.map