"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startHandler = void 0;
const axios_1 = __importDefault(require("axios"));
const startHandler = async (bot, msg, match) => {
    const chatId = msg.chat.id;
    const firstName = msg.from?.first_name || 'Usuário';
    const startParam = match?.[1]?.trim();
    if (startParam && startParam.length > 10) {
        await handlePurchaseFlow(bot, chatId, firstName, startParam);
    }
    else {
        await handleNormalStart(bot, chatId, firstName);
    }
};
exports.startHandler = startHandler;
async function handlePurchaseFlow(bot, chatId, firstName, purchaseToken) {
    try {
        const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
        const response = await axios_1.default.get(`${backendUrl}/api/purchases/token/${purchaseToken}`);
        const purchase = response.data;
        if (purchase.status !== 'pending') {
            await bot.sendMessage(chatId, `❌ Esta compra já foi processada!\n\nStatus: ${purchase.status.toUpperCase()}`);
            return;
        }
        const priceFormatted = (purchase.amount_cents / 100).toFixed(2);
        const purchaseMessage = `🎥 **${purchase.content.title}**

💰 Preço: R$ ${priceFormatted}
📦 Entrega: ${purchase.preferred_delivery === 'site' ? 'Assistir Online' : 'Download pelo Telegram'}

💳 **Escolha sua forma de pagamento:**`;
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '📱 PIX (Instantâneo)', callback_data: `pay_pix_${purchaseToken}` },
                    { text: '💳 Cartão', callback_data: `pay_card_${purchaseToken}` }
                ],
                [
                    { text: '❌ Cancelar Compra', callback_data: `cancel_${purchaseToken}` }
                ]
            ]
        };
        if (purchase.content.poster_url) {
            await bot.sendPhoto(chatId, purchase.content.poster_url, {
                caption: purchaseMessage,
                parse_mode: 'Markdown',
                reply_markup: keyboard
            });
        }
        else {
            await bot.sendMessage(chatId, purchaseMessage, {
                parse_mode: 'Markdown',
                reply_markup: keyboard
            });
        }
    }
    catch (error) {
        console.error('Error fetching purchase:', error);
        await bot.sendMessage(chatId, `❌ Não foi possível processar sua compra. Por favor, tente novamente ou entre em contato com o suporte.`);
    }
}
async function handleNormalStart(bot, chatId, firstName) {
    const welcomeMessage = `🎬 Olá ${firstName}! Bem-vindo ao Cine Vision!

🍿 Aqui você assiste os melhores filmes:
• 📱 Direto no Telegram
• 💻 Ou no nosso site
• 💸 Preços que cabem no bolso

👇 O que você quer fazer?`;
    const keyboard = {
        inline_keyboard: [
            [
                { text: '🎬 Ver Filmes', callback_data: 'catalog_menu' },
                { text: '💳 Minhas Compras', callback_data: 'my_movies' }
            ],
            [
                { text: '🆘 Ajuda', callback_data: 'help_menu' }
            ]
        ]
    };
    await bot.sendMessage(chatId, welcomeMessage, {
        reply_markup: keyboard
    });
}
//# sourceMappingURL=start.handler.js.map