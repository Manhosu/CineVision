"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentHandler = void 0;
const axios_1 = __importDefault(require("axios"));
const paymentHandler = async (bot, msg, match) => {
    const chatId = msg.chat.id;
    const movieId = match?.[1];
    if (!movieId) {
        console.log(`Invalid payment command from chat ${chatId}`);
        return;
    }
    try {
        const response = await axios_1.default.get(`${process.env.BACKEND_URL}/api/v1/content/${movieId}`, {
            headers: {
                'Authorization': `Bearer ${process.env.API_TOKEN || ''}`
            }
        });
        const movie = response.data;
        if (!movie) {
            await bot.sendMessage(chatId, '❌ Filme não encontrado.');
            return;
        }
        const paymentMessage = `🎥 **${movie.title}**

Preço: R$ ${(movie.price_cents / 100).toFixed(2)}

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
    }
    catch (error) {
        console.error('Erro ao buscar detalhes do filme:', error);
        await bot.sendMessage(chatId, '❌ Erro ao carregar informações do filme. Tente novamente mais tarde.');
    }
};
exports.paymentHandler = paymentHandler;
//# sourceMappingURL=payment.handler.js.map