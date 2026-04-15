import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';

export const paymentHandler = async (bot: TelegramBot, msg: TelegramBot.Message, match: RegExpExecArray | null) => {
  const chatId = msg.chat.id;
  const movieId = match?.[1];

  if (!movieId) {
    console.log(`Invalid payment command from chat ${chatId}`);
    return;
  }

  try {
    // Buscar detalhes do filme via API
    const response = await axios.get(`${process.env.BACKEND_URL}/api/v1/content/${movieId}`, {
      headers: {
        'Authorization': `Bearer ${process.env.API_TOKEN || ''}`
      }
    });

    const movie = response.data;

    if (!movie) {
      await bot.sendMessage(chatId, '❌ Filme não encontrado.');
      return;
    }

    const hasDiscount = movie.discounted_price_cents && movie.discounted_price_cents < movie.price_cents;
    const finalPrice = hasDiscount ? movie.discounted_price_cents : movie.price_cents;
    const priceText = hasDiscount
      ? `~R$ ${(movie.price_cents / 100).toFixed(2)}~ R$ ${(finalPrice / 100).toFixed(2)} (${movie.discount_percentage || ''}% OFF)`
      : `R$ ${(movie.price_cents / 100).toFixed(2)}`;

    const paymentMessage = `🎥 **${movie.title}**

Preço: ${priceText}

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

  } catch (error) {
    console.error('Erro ao buscar detalhes do filme:', error);
    await bot.sendMessage(chatId, '❌ Erro ao carregar informações do filme. Tente novamente mais tarde.');
  }
};