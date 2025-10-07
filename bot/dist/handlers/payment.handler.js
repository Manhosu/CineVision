"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentHandler = void 0;
const paymentHandler = async (bot, msg, match) => {
    const chatId = msg.chat.id;
    const movieId = match?.[1];
    if (!movieId) {
        console.log(`Invalid payment command from chat ${chatId}`);
        return;
    }
    const mockMovie = {
        id: movieId,
        title: 'Vingadores: Ultimato',
        price: 19.90,
        poster: 'https://example.com/poster.jpg'
    };
    const paymentMessage = `🎥 **${mockMovie.title}**

Preço: R$ ${mockMovie.price.toFixed(2)}

💳 **Opções de Pagamento:**

Escolha como deseja pagar:`;
    const keyboard = {
        inline_keyboard: [
            [
                { text: '📱 PIX (Instântaneo)', callback_data: `pay_pix_${movieId}` },
                { text: '💳 Cartão de Crédito', callback_data: `pay_card_${movieId}` }
            ],
            [
                { text: '❌ Cancelar', callback_data: 'cancel_payment' }
            ]
        ]
    };
    await bot.sendMessage(chatId, paymentMessage, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
    });
};
exports.paymentHandler = paymentHandler;
//# sourceMappingURL=payment.handler.js.map