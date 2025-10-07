"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.broadcastNewRelease = exports.handleNotificationsCallback = exports.sendFlashPromotion = exports.sendNewReleaseNotification = void 0;
const sendNewReleaseNotification = async (bot, chatId, movie) => {
    const message = `🔥 **NOVO LANÇAMENTO!**

🎬 **${movie.title.toUpperCase()}**

⭐ ${movie.description}
🕐 ${movie.duration} | 🎭 ${movie.genre}

💰 **Promoção de lançamento:**
~~R$ ${movie.originalPrice.toFixed(2).replace('.', ',')}~~ **R$ ${movie.promoPrice.toFixed(2).replace('.', ',')}**

🎯 Primeiras 24 horas!`;
    const keyboard = {
        inline_keyboard: [
            [
                { text: '🛒 Comprar Agora', callback_data: `purchase_${movie.id}` },
                { text: '🎬 Ver Trailer', callback_data: `trailer_${movie.id}` }
            ],
            [
                { text: '🔕 Não quero mais avisos', callback_data: 'notifications_disable' }
            ]
        ]
    };
    if (movie.poster_url) {
        await bot.sendPhoto(chatId, movie.poster_url, {
            caption: message,
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }
    else {
        await bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }
};
exports.sendNewReleaseNotification = sendNewReleaseNotification;
const sendFlashPromotion = async (bot, chatId) => {
    const message = `⚡ **PROMOÇÃO RELÂMPAGO!**

🔥 24 HORAS APENAS!

🎬 **3 FILMES POR R$ 29,90**
(economize R$ 30!)

Filmes disponíveis:
• Vingadores: Ultimato
• Pantera Negra 2
• Doutor Estranho 2

⏰ Termina hoje às 23:59`;
    const keyboard = {
        inline_keyboard: [
            [
                { text: '🔥 APROVEITAR AGORA', callback_data: 'flash_promo_buy' }
            ],
            [
                { text: '⏰ Lembrar às 23h', callback_data: 'flash_promo_remind' }
            ]
        ]
    };
    await bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
    });
};
exports.sendFlashPromotion = sendFlashPromotion;
const handleNotificationsCallback = async (bot, callbackQuery) => {
    const chatId = callbackQuery.message?.chat.id;
    const data = callbackQuery.data;
    if (!chatId || !data)
        return;
    try {
        switch (data) {
            case 'notifications_disable':
                await bot.sendMessage(chatId, `🔕 **NOTIFICAÇÕES DESATIVADAS**

Você não receberá mais avisos de novos lançamentos.

💡 Para reativar, use /ajuda → Configurações`, {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: '🎬 Ver Catálogo', callback_data: 'catalog_menu' }
                            ]
                        ]
                    }
                });
                break;
            case 'flash_promo_buy':
                await bot.sendMessage(chatId, `🔥 **PROMOÇÃO CONFIRMADA!**

🎬 **3 Filmes Selecionados:**
• Vingadores: Ultimato
• Pantera Negra 2
• Doutor Estranho 2

💰 **Total:** R$ 29,90
💸 **Você economizou:** R$ 30,00

📦 Como você quer receber?`, {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: '📱 Download Telegram', callback_data: 'delivery_telegram_promo' }
                            ],
                            [
                                { text: '💻 Assistir Online', callback_data: 'delivery_streaming_promo' }
                            ],
                            [
                                { text: '❌ Cancelar', callback_data: 'catalog_menu' }
                            ]
                        ]
                    }
                });
                break;
            case 'flash_promo_remind':
                await bot.sendMessage(chatId, `⏰ **LEMBRETE ATIVADO!**

Vou te lembrar da promoção às 23:00.

🔥 **3 filmes por R$ 29,90**
⏰ Termina hoje às 23:59

💡 Você pode aproveitar agora se quiser!`, {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: '🔥 Aproveitar Agora', callback_data: 'flash_promo_buy' }
                            ]
                        ]
                    }
                });
                break;
        }
        await bot.answerCallbackQuery(callbackQuery.id);
    }
    catch (error) {
        console.error('Error handling notifications callback:', error);
        await bot.answerCallbackQuery(callbackQuery.id, {
            text: 'Erro temporário. Tente novamente.',
            show_alert: true
        });
    }
};
exports.handleNotificationsCallback = handleNotificationsCallback;
const broadcastNewRelease = async (bot, movie, subscribers) => {
    for (const chatId of subscribers) {
        try {
            await (0, exports.sendNewReleaseNotification)(bot, chatId, movie);
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        catch (error) {
            console.error(`Error sending notification to ${chatId}:`, error);
        }
    }
};
exports.broadcastNewRelease = broadcastNewRelease;
//# sourceMappingURL=notifications.handler.js.map