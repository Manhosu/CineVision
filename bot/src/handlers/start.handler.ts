import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';
import { handleOrderDeepLink } from './order-payment.handler';

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
  created_at: Date;
}

async function handleContentRequest(
  bot: TelegramBot,
  chatId: number,
  firstName: string
) {
  const requestMessage = `🎬 Olá ${firstName}!

📝 **Solicitar Conteúdo**

Não encontrou o filme ou série que procura? Sem problemas!

Para solicitar um conteúdo, use o comando:

\`/pedir Nome do Filme\`

**Exemplos:**
• \`/pedir Vingadores: Ultimato\`
• \`/pedir Breaking Bad\`
• \`/pedir Interestelar\`

Nossa equipe irá analisar seu pedido e você receberá uma notificação quando o conteúdo estiver disponível! 🔔`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: '🎬 Ver Catálogo', callback_data: 'catalog_menu' }
      ]
    ]
  };

  await bot.sendMessage(chatId, requestMessage, {
    parse_mode: 'Markdown',
    reply_markup: keyboard
  });
}

export const startHandler = async (
  bot: TelegramBot,
  msg: TelegramBot.Message,
  match: RegExpExecArray | null
) => {
  const chatId = msg.chat.id;
  const firstName = msg.from?.first_name || 'Usuário';
  const startParam = match?.[1]?.trim();

  // Check if user wants to request content
  if (startParam === 'request_content') {
    await handleContentRequest(bot, chatId, firstName);
  }
  // Order deep-link: /start order_<uuid>
  else if (startParam && startParam.startsWith('order_')) {
    const orderToken = startParam.slice('order_'.length);
    await handleOrderDeepLink(bot, chatId, orderToken);
  }
  // Check if there's a purchase token in the start parameter
  else if (startParam && startParam.length > 10) {
    await handlePurchaseFlow(bot, chatId, firstName, startParam);
  } else {
    await handleNormalStart(bot, chatId, firstName);
  }
};

async function handlePurchaseFlow(
  bot: TelegramBot,
  chatId: number,
  firstName: string,
  purchaseToken: string
) {
  try {
    // Fetch purchase details from API
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    const response = await axios.get(`${backendUrl}/api/purchases/token/${purchaseToken}`);
    const purchase: Purchase = response.data;

    if (purchase.status !== 'pending') {
      await bot.sendMessage(
        chatId,
        `❌ Esta compra já foi processada!\n\nStatus: ${purchase.status.toUpperCase()}`
      );
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

    // Send purchase image if available
    if (purchase.content.poster_url) {
      await bot.sendPhoto(chatId, purchase.content.poster_url, {
        caption: purchaseMessage,
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
    } else {
      await bot.sendMessage(chatId, purchaseMessage, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
    }

  } catch (error) {
    console.error('Error fetching purchase:', error);
    await bot.sendMessage(
      chatId,
      `❌ Não foi possível processar sua compra. Por favor, tente novamente ou entre em contato com o suporte.`
    );
  }
}

async function handleNormalStart(
  bot: TelegramBot,
  chatId: number,
  firstName: string
) {
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
