import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';

const BACKEND_URL = process.env.BACKEND_URL || process.env.BACKEND_API_URL || 'http://localhost:3001';

interface Purchase {
  id: string;
  purchase_token: string;
  status: string;
  amount_cents: number;
  currency: string;
  preferred_delivery: string;
  content: {
    id: string;
    title: string;
    poster_url?: string;
  };
}

/**
 * Handle PIX payment callback
 */
export async function handlePixPayment(
  bot: TelegramBot,
  callbackQuery: TelegramBot.CallbackQuery,
  purchaseId: string,
) {
  const chatId = callbackQuery.message?.chat.id;
  if (!chatId) return;

  try {
    await bot.sendMessage(chatId, '\u23F3 Gerando QR Code PIX...');

    // Create PIX payment via backend
    const pixResponse = await axios.post(`${BACKEND_URL}/api/v1/payments/pix/create`, {
      purchase_id: purchaseId,
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000,
    });

    const pixData = pixResponse.data;

    // Send QR Code as photo if available
    if (pixData.qr_code_image) {
      try {
        // Handle base64 image (remove data:image/png;base64, prefix if present)
        let imageBase64 = pixData.qr_code_image;
        if (imageBase64.includes(',')) {
          imageBase64 = imageBase64.split(',')[1];
        }
        if (imageBase64.startsWith('data:')) {
          imageBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
        }

        const imageBuffer = Buffer.from(imageBase64, 'base64');

        const FormData = require('form-data');
        const form = new FormData();
        form.append('chat_id', chatId.toString());
        form.append('photo', imageBuffer, { filename: 'qrcode.png', contentType: 'image/png' });
        form.append('caption', `\uD83D\uDCB0 <b>Pagamento via PIX</b>\n\n\uD83D\uDCB5 Valor: R$ ${pixData.amount_brl}\n\uD83C\uDFAC Conte\u00FAdo: ${pixData.content_title || 'CineVision'}\n\u23F1\uFE0F V\u00E1lido por: 1 hora\n\n<b>Como pagar:</b>\n1. Abra seu app banc\u00E1rio\n2. Escaneie o QR Code acima\n3. Confirme o pagamento\n\nOu use o c\u00F3digo Pix Copia e Cola abaixo:`);
        form.append('parse_mode', 'HTML');

        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        await axios.post(`https://api.telegram.org/bot${botToken}/sendPhoto`, form, {
          headers: form.getHeaders(),
        });
      } catch (photoError) {
        console.error('Error sending QR Code photo:', photoError.message);
      }
    }

    // Send copyable PIX code
    const pixCode = pixData.qr_code_text || pixData.copy_paste_code;
    if (pixCode) {
      await bot.sendMessage(chatId, `<code>${pixCode}</code>`, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '\u2705 J\u00E1 paguei', callback_data: `check_payment_${purchaseId}` },
              { text: '\u274C Cancelar', callback_data: `cancel_payment_${purchaseId}` },
            ],
          ],
        },
      });
    }

    await bot.answerCallbackQuery(callbackQuery.id, {
      text: 'QR Code gerado! Escaneie para pagar.',
    });
  } catch (error: any) {
    console.error('Error handling PIX payment:', error.message);
    if (error.response?.data) {
      console.error('Backend error:', JSON.stringify(error.response.data));
    }
    await bot.sendMessage(chatId, '\u274C Erro ao gerar QR Code PIX. Por favor, tente novamente ou contate o suporte.');
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: 'Erro ao gerar PIX',
      show_alert: true,
    });
  }
}

/**
 * Handle credit card payment callback
 */
export async function handleCardPayment(
  bot: TelegramBot,
  callbackQuery: TelegramBot.CallbackQuery,
  purchaseId: string,
) {
  const chatId = callbackQuery.message?.chat.id;
  if (!chatId) return;

  try {
    // Create Stripe checkout session
    const checkoutResponse = await axios.post(`${BACKEND_URL}/api/v1/payments/create`, {
      purchase_id: purchaseId,
      payment_method: 'card',
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000,
    });

    const { checkout_url } = checkoutResponse.data;

    if (!checkout_url) {
      throw new Error('Checkout URL not returned');
    }

    await bot.sendMessage(chatId, `\uD83D\uDCB3 <b>Pagamento via Cart\u00E3o</b>\n\nClique no bot\u00E3o abaixo para pagar com seguran\u00E7a:`, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '\uD83D\uDCB3 Pagar com Cart\u00E3o', url: checkout_url }],
          [{ text: '\u274C Cancelar', callback_data: `cancel_payment_${purchaseId}` }],
        ],
      },
    });

    await bot.answerCallbackQuery(callbackQuery.id, {
      text: 'Abrindo p\u00E1gina de pagamento...',
    });
  } catch (error: any) {
    console.error('Error handling card payment:', error.message);
    await bot.sendMessage(chatId, '\u274C Erro ao processar pagamento. Tente novamente mais tarde.');
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: 'Erro ao processar pagamento',
      show_alert: true,
    });
  }
}

/**
 * Handle payment status check
 */
export async function handleCheckPayment(
  bot: TelegramBot,
  callbackQuery: TelegramBot.CallbackQuery,
  purchaseId: string,
) {
  const chatId = callbackQuery.message?.chat.id;
  if (!chatId) return;

  try {
    const response = await axios.get(`${BACKEND_URL}/api/v1/payments/status/${purchaseId}`, {
      timeout: 10000,
    });
    const data = response.data;

    if (data.status === 'completed' || data.status === 'paid' || data.status === 'PAID') {
      await bot.sendMessage(chatId, `\u2705 <b>Pagamento confirmado!</b>\n\n\uD83C\uDF89 Seu conte\u00FAdo est\u00E1 pronto!\nVoc\u00EA receber\u00E1 o acesso em breve.`, {
        parse_mode: 'HTML',
      });
      await bot.answerCallbackQuery(callbackQuery.id, { text: '\u2705 Pagamento confirmado!' });
    } else {
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: '\u23F3 Pagamento ainda pendente. Aguarde...',
        show_alert: true,
      });
    }
  } catch (error) {
    console.error('Error checking payment:', error);
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: '\u274C Erro ao verificar pagamento',
      show_alert: true,
    });
  }
}

/**
 * Handle payment cancellation
 */
export async function handleCancelPayment(
  bot: TelegramBot,
  callbackQuery: TelegramBot.CallbackQuery,
  purchaseId: string,
) {
  const chatId = callbackQuery.message?.chat.id;
  if (!chatId) return;

  try {
    await axios.post(`${BACKEND_URL}/api/v1/purchases/${purchaseId}/cancel`, {}, { timeout: 10000 });

    await bot.sendMessage(chatId, `\u274C <b>Compra cancelada</b>\n\nVoc\u00EA pode iniciar uma nova compra a qualquer momento!`, {
      parse_mode: 'HTML',
    });
    await bot.answerCallbackQuery(callbackQuery.id, { text: 'Compra cancelada' });
  } catch (error) {
    console.error('Error canceling payment:', error);
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: '\u274C Erro ao cancelar',
      show_alert: true,
    });
  }
}
