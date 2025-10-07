"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handlePixPayment = handlePixPayment;
exports.handleCardPayment = handleCardPayment;
exports.handleCheckPayment = handleCheckPayment;
exports.handleCancelPayment = handleCancelPayment;
const axios_1 = __importDefault(require("axios"));
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
async function handlePixPayment(bot, callbackQuery, purchaseToken) {
    const chatId = callbackQuery.message?.chat.id;
    if (!chatId)
        return;
    try {
        const response = await axios_1.default.get(`${BACKEND_URL}/api/purchases/token/${purchaseToken}`);
        const purchase = response.data;
        const pixResponse = await axios_1.default.post(`${BACKEND_URL}/api/payments/pix/generate`, {
            purchase_id: purchase.id,
            amount_cents: purchase.amount_cents,
        });
        const { qrCode, qrCodeText, expiresAt } = pixResponse.data;
        const messageText = `💰 **Pagamento via PIX**

📱 **Escaneie o QR Code abaixo ou copie o código PIX:**

💵 Valor: R$ ${(purchase.amount_cents / 100).toFixed(2)}
🎥 Filme: ${purchase.content.title}

⏰ Expira em: ${new Date(expiresAt).toLocaleTimeString('pt-BR')}

Após o pagamento, você receberá o filme automaticamente!`;
        await bot.sendPhoto(chatId, Buffer.from(qrCode.split(',')[1], 'base64'), {
            caption: messageText,
            parse_mode: 'Markdown',
        });
        await bot.sendMessage(chatId, `\`${qrCodeText}\``, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '✅ Já paguei', callback_data: `check_payment_${purchase.id}` },
                        { text: '❌ Cancelar', callback_data: `cancel_payment_${purchase.id}` },
                    ],
                ],
            },
        });
        await bot.answerCallbackQuery(callbackQuery.id, {
            text: 'QR Code gerado! Escaneie para pagar.',
        });
    }
    catch (error) {
        console.error('Error handling PIX payment:', error);
        await bot.sendMessage(chatId, '❌ Erro ao gerar PIX. Tente novamente mais tarde.');
        await bot.answerCallbackQuery(callbackQuery.id, {
            text: 'Erro ao gerar PIX',
            show_alert: true,
        });
    }
}
async function handleCardPayment(bot, callbackQuery, purchaseToken) {
    const chatId = callbackQuery.message?.chat.id;
    if (!chatId)
        return;
    try {
        const response = await axios_1.default.get(`${BACKEND_URL}/api/purchases/token/${purchaseToken}`);
        const purchase = response.data;
        const checkoutResponse = await axios_1.default.post(`${BACKEND_URL}/api/payments/stripe/checkout`, {
            purchase_id: purchase.id,
            success_url: `https://t.me/${process.env.TELEGRAM_BOT_USERNAME}?start=payment_success_${purchase.id}`,
            cancel_url: `https://t.me/${process.env.TELEGRAM_BOT_USERNAME}?start=payment_cancel_${purchase.id}`,
        });
        const { checkout_url } = checkoutResponse.data;
        const messageText = `💳 **Pagamento via Cartão de Crédito**

💵 Valor: R$ ${(purchase.amount_cents / 100).toFixed(2)}
🎥 Filme: ${purchase.content.title}

Clique no botão abaixo para pagar com segurança via Stripe:`;
        await bot.sendMessage(chatId, messageText, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '💳 Pagar com Cartão', url: checkout_url },
                    ],
                    [
                        { text: '❌ Cancelar', callback_data: `cancel_payment_${purchase.id}` },
                    ],
                ],
            },
        });
        await bot.answerCallbackQuery(callbackQuery.id, {
            text: 'Abrindo página de pagamento...',
        });
    }
    catch (error) {
        console.error('Error handling card payment:', error);
        await bot.sendMessage(chatId, '❌ Erro ao processar pagamento. Tente novamente mais tarde.');
        await bot.answerCallbackQuery(callbackQuery.id, {
            text: 'Erro ao processar pagamento',
            show_alert: true,
        });
    }
}
async function handleCheckPayment(bot, callbackQuery, purchaseId) {
    const chatId = callbackQuery.message?.chat.id;
    if (!chatId)
        return;
    try {
        const response = await axios_1.default.get(`${BACKEND_URL}/api/purchases/${purchaseId}/status`);
        const { status, payment_status } = response.data;
        if (payment_status === 'completed' && status === 'paid') {
            await bot.sendMessage(chatId, `✅ **Pagamento confirmado!**

🎉 Seu filme está pronto para assistir!
Você receberá o link em breve.`, {
                parse_mode: 'Markdown',
            });
            await bot.answerCallbackQuery(callbackQuery.id, {
                text: '✅ Pagamento confirmado!',
            });
        }
        else if (payment_status === 'pending') {
            await bot.answerCallbackQuery(callbackQuery.id, {
                text: '⏳ Pagamento ainda pendente. Aguarde...',
                show_alert: true,
            });
        }
        else {
            await bot.answerCallbackQuery(callbackQuery.id, {
                text: '❌ Pagamento não confirmado ainda',
                show_alert: true,
            });
        }
    }
    catch (error) {
        console.error('Error checking payment:', error);
        await bot.answerCallbackQuery(callbackQuery.id, {
            text: '❌ Erro ao verificar pagamento',
            show_alert: true,
        });
    }
}
async function handleCancelPayment(bot, callbackQuery, purchaseId) {
    const chatId = callbackQuery.message?.chat.id;
    if (!chatId)
        return;
    try {
        await axios_1.default.post(`${BACKEND_URL}/api/purchases/${purchaseId}/cancel`);
        await bot.sendMessage(chatId, `❌ **Compra cancelada**

Você pode iniciar uma nova compra a qualquer momento!`, {
            parse_mode: 'Markdown',
        });
        await bot.answerCallbackQuery(callbackQuery.id, {
            text: 'Compra cancelada',
        });
    }
    catch (error) {
        console.error('Error canceling payment:', error);
        await bot.answerCallbackQuery(callbackQuery.id, {
            text: '❌ Erro ao cancelar',
            show_alert: true,
        });
    }
}
//# sourceMappingURL=payment-callback.handler.js.map