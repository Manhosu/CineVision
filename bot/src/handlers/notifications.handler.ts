import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';

export const notificationsHandler = async (bot: TelegramBot, msg: TelegramBot.Message) => {
  const chatId = msg.chat.id;
  await showNotificationSettings(bot, chatId);
};

export const showNotificationSettings = async (bot: TelegramBot, chatId: number) => {
  const message = `🔔 **CONFIGURAÇÕES DE NOTIFICAÇÃO**

📱 **Suas preferências atuais:**

✅ Novos lançamentos
✅ Promoções especiais
❌ Lembretes de filmes salvos
✅ Atualizações de conta

🎯 **Tipos de notificação:**`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: '🎬 Novos Lançamentos', callback_data: 'toggle_new_releases' },
        { text: '🔥 Promoções', callback_data: 'toggle_promotions' }
      ],
      [
        { text: '💾 Lembretes', callback_data: 'toggle_reminders' },
        { text: '👤 Conta', callback_data: 'toggle_account' }
      ],
      [
        { text: '🔕 Desativar Todas', callback_data: 'disable_all_notifications' }
      ],
      [
        { text: '⬅️ Voltar', callback_data: 'main_menu' }
      ]
    ]
  };

  await bot.sendMessage(chatId, message, {
    parse_mode: 'Markdown',
    reply_markup: keyboard
  });
};

export const handleNotificationCallback = async (bot: TelegramBot, query: TelegramBot.CallbackQuery) => {
  const chatId = query.message?.chat.id;
  const data = query.data;

  if (!chatId || !data) return;

  try {
    switch (data) {
      case 'flash_promo':
        await bot.sendMessage(chatId, `🔥 **PROMOÇÃO RELÂMPAGO!**

🔥 24 HORAS APENAS!

🎬 **Filmes em Promoção**
(Consulte nosso catálogo para ofertas atuais)

⏰ Promoções limitadas disponíveis`, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '🔥 VER PROMOÇÕES', callback_data: 'catalog_menu' }
              ],
              [
                { text: '⏰ Lembrar mais tarde', callback_data: 'flash_promo_remind' }
              ]
            ]
          }
        });
        break;

      case 'flash_promo_buy':
        await bot.sendMessage(chatId, `🔥 **PROMOÇÃO CONFIRMADA!**

🎬 **Filmes Selecionados:**
(Consulte o catálogo para filmes disponíveis)

💰 **Ofertas especiais disponíveis**

📦 Como você quer receber?`, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '📱 Pelo App/Site', callback_data: 'delivery_app' },
                { text: '📧 Por Email', callback_data: 'delivery_email' }
              ]
            ]
          }
        });
        break;

      case 'flash_promo_remind':
        await bot.sendMessage(chatId, `⏰ **LEMBRETE CONFIGURADO!**

Vou te avisar 1 hora antes da promoção acabar.

🔔 Você receberá uma notificação às 22:00`, {
          parse_mode: 'Markdown'
        });
        break;

      case 'toggle_new_releases':
      case 'toggle_promotions':
      case 'toggle_reminders':
      case 'toggle_account':
        await bot.sendMessage(chatId, '✅ Configuração atualizada!');
        await showNotificationSettings(bot, chatId);
        break;

      case 'disable_all_notifications':
        await bot.sendMessage(chatId, `🔕 **NOTIFICAÇÕES DESATIVADAS**

Todas as notificações foram desativadas.

Você pode reativá-las a qualquer momento usando /notificacoes`, {
          parse_mode: 'Markdown'
        });
        break;
    }
  } catch (error) {
    console.error('Erro ao processar callback de notificação:', error);
    await bot.sendMessage(chatId, '❌ Erro ao processar solicitação. Tente novamente.');
  }

  await bot.answerCallbackQuery(query.id);
};

interface NewRelease {
  id: string;
  title: string;
  description: string;
  originalPrice: number;
  promoPrice: number;
  genre: string;
  duration: string;
  poster_url?: string;
}

export const sendNewReleaseNotification = async (
  bot: TelegramBot,
  chatId: number,
  movie: NewRelease
) => {
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
  } else {
    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }
};

export const sendFlashPromotion = async (bot: TelegramBot, chatId: number) => {
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

export const handleNotificationsCallback = async (
  bot: TelegramBot,
  callbackQuery: TelegramBot.CallbackQuery
) => {
  const chatId = callbackQuery.message?.chat.id;
  const data = callbackQuery.data;

  if (!chatId || !data) return;

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
  } catch (error) {
    console.error('Error handling notifications callback:', error);
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: 'Erro temporário. Tente novamente.',
      show_alert: true
    });
  }
};

// Function to broadcast new release to all subscribers
export const broadcastNewRelease = async (bot: TelegramBot, movie: NewRelease, subscribers: number[]) => {
  for (const chatId of subscribers) {
    try {
      await sendNewReleaseNotification(bot, chatId, movie);
      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`Error sending notification to ${chatId}:`, error);
    }
  }
};