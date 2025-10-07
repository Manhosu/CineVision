import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';

interface UserMovie {
  id: string;
  title: string;
  purchaseDate: string;
  downloadLink?: string;
  streamingLink?: string;
  expiresAt?: string;
  status: 'active' | 'expired' | 'pending';
  thumbnail?: string;
}



export const myMoviesHandler = async (bot: TelegramBot, msg: TelegramBot.Message) => {
  const chatId = msg.chat.id;
  await showMyMovies(bot, chatId);
};

export const showMyMovies = async (bot: TelegramBot, chatId: number) => {
  try {
    // Buscar filmes do usuário via API
    const response = await axios.get(`${process.env.BACKEND_URL}/api/v1/purchases/user/${chatId}`, {
      headers: {
        'Authorization': `Bearer ${process.env.API_TOKEN || ''}`
      }
    });

    const userMovies: UserMovie[] = response.data.purchases || [];

    if (userMovies.length === 0) {
      await bot.sendMessage(chatId, `🎬 **Meus Filmes**

📭 Você ainda não possui filmes comprados.

🛒 Para comprar filmes, use o comando /catalogo`, {
        parse_mode: 'Markdown'
      });
      return;
    }

    const message = `🎬 **Meus Filmes**

🎬 Você tem ${userMovies.length} filmes:`;

    const keyboard = {
      inline_keyboard: [] as any[][]
    };

    for (const movie of userMovies) {
      const statusEmoji = movie.status === 'active' ? '✅' : 
                         movie.status === 'expired' ? '⏰' : '⏳';
      
      const movieButton = [{
        text: `${statusEmoji} ${movie.title}`,
        callback_data: `movie_details_${movie.id}`
      }];
      
      keyboard.inline_keyboard.push(movieButton);
    }

    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  } catch (error) {
    console.error('Erro ao buscar filmes do usuário:', error);
    await bot.sendMessage(chatId, '❌ Erro ao carregar seus filmes. Tente novamente mais tarde.');
  }
};

const sendMovieCard = async (bot: TelegramBot, chatId: number, movie: UserMovie) => {
  const formattedDate = new Date(movie.purchaseDate).toLocaleDateString('pt-BR');

  const statusEmoji = movie.status === 'active' ? '✅' : movie.status === 'expired' ? '⏰' : '⏳';

  const message = `${statusEmoji} **${movie.title}**
Comprado em ${formattedDate}`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: '📥 Baixar', callback_data: `download_${movie.id}` },
        { text: '▶️ Assistir', callback_data: `watch_${movie.id}` }
      ]
    ]
  };

  if (movie.thumbnail) {
    await bot.sendPhoto(chatId, movie.thumbnail, {
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

export const handleMyMoviesCallback = async (bot: TelegramBot, callbackQuery: TelegramBot.CallbackQuery) => {
  const chatId = callbackQuery.message?.chat.id;
  const data = callbackQuery.data;

  if (!chatId || !data) return;

  try {
    if (data.startsWith('download_')) {
      const movieId = data.replace('download_', '');
      await handleDownload(bot, chatId, movieId);
    } else if (data.startsWith('watch_')) {
      const movieId = data.replace('watch_', '');
      await handleWatch(bot, chatId, movieId);
    } else if (data === 'purchase_history') {
      await showPurchaseHistory(bot, chatId);
    }

    await bot.answerCallbackQuery(callbackQuery.id);
  } catch (error) {
    console.error('Error handling my movies callback:', error);
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: 'Erro temporário. Tente novamente.',
      show_alert: true
    });
  }
};

const handleDownload = async (bot: TelegramBot, chatId: number, movieId: string) => {
  try {
    const response = await axios.get(`${process.env.BACKEND_URL}/api/v1/purchases/user/${chatId}`, {
      headers: {
        'Authorization': `Bearer ${process.env.API_TOKEN || ''}`
      }
    });

    const userMovies: UserMovie[] = response.data.purchases || [];
    const movie = userMovies.find(m => m.id === movieId);

  if (!movie) {
    await bot.sendMessage(chatId, '❌ Filme não encontrado.');
    return;
  }

  if (movie.status !== 'active') {
    await bot.sendMessage(chatId, `❌ **DOWNLOAD INDISPONÍVEL**

🎬 **${movie.title}**

⏰ Este filme expirou ou não está mais disponível.

💬 Entre em contato com o suporte se precisar de ajuda.`, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '💬 Suporte', callback_data: 'help_support' }
          ]
        ]
      }
    });
    return;
  }

  const message = `📥 **DOWNLOAD INICIADO**

🎬 **${movie.title}**

⬇️ **Iniciando download...**
Qualidade: Full HD
Tamanho: ~2.1 GB

📱 **O arquivo chegará em instantes!**

💡 **Lembre-se:**
• Link válido por 48 horas
• Filme é seu para sempre
• Pode assistir offline`;

  await bot.sendMessage(chatId, message, {
    parse_mode: 'Markdown'
  });

  // Simular envio do arquivo (em produção seria o arquivo real)
  setTimeout(async () => {
    await bot.sendMessage(chatId, `🎬 **${movie.title}** - Download Completo!

*[Arquivo do filme seria enviado aqui]*

✅ **Download concluído!**
Bom filme! 🍿`, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '⭐ Avaliar Filme', callback_data: `rate_${movieId}` },
            { text: '🎬 Ver Mais Filmes', callback_data: 'catalog_menu' }
          ]
        ]
      }
    });
  }, 3000);
  } catch (error) {
    console.error('Erro ao buscar filme para download:', error);
    await bot.sendMessage(chatId, '❌ Erro ao processar download. Tente novamente mais tarde.');
  }
};

const handleWatch = async (bot: TelegramBot, chatId: number, movieId: string) => {
  try {
    const response = await axios.get(`${process.env.BACKEND_URL}/api/v1/purchases/user/${chatId}`, {
      headers: {
        'Authorization': `Bearer ${process.env.API_TOKEN || ''}`
      }
    });

    const userMovies: UserMovie[] = response.data.purchases || [];
    const movie = userMovies.find(m => m.id === movieId);

  if (!movie) {
    await bot.sendMessage(chatId, '❌ Filme não encontrado.');
    return;
  }

  if (movie.status !== 'active') {
    await bot.sendMessage(chatId, `❌ **ACESSO EXPIRADO**

🎬 **${movie.title}**

⏰ Seu acesso a este filme expirou.

💬 Entre em contato com o suporte para renovar.`, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '💬 Suporte', callback_data: 'help_support' }
          ]
        ]
      }
    });
    return;
  }

  const message = `▶️ **ASSISTIR AGORA**

🎬 **${movie.title}**

🔗 **Link para assistir:**
${movie.streamingLink}

✅ **Seu acesso:**
• Válido por 30 dias
• Assista quantas vezes quiser
• Qualidade até 4K

🍿 Bom filme!`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: '▶️ ASSISTIR AGORA', url: movie.streamingLink || 'https://cinevision.com' }
      ],
      [
        { text: '📱 Ver no App', callback_data: `app_${movieId}` },
        { text: '⭐ Avaliar', callback_data: `rate_${movieId}` }
      ]
    ]
  };

  await bot.sendMessage(chatId, message, {
    parse_mode: 'Markdown',
    reply_markup: keyboard
  });
  } catch (error) {
    console.error('Erro ao buscar filme para assistir:', error);
    await bot.sendMessage(chatId, '❌ Erro ao carregar filme. Tente novamente mais tarde.');
  }
};

const showPurchaseHistory = async (bot: TelegramBot, chatId: number) => {
  try {
    const response = await axios.get(`${process.env.BACKEND_URL}/api/v1/purchases/user/${chatId}`, {
      headers: {
        'Authorization': `Bearer ${process.env.API_TOKEN || ''}`
      }
    });

    const userMovies: UserMovie[] = response.data.purchases || [];
    
    const message = `📊 **HISTÓRICO COMPLETO**

📱 **Resumo da sua conta:**

🎬 **Total de filmes:** ${userMovies.length}
💰 **Total gasto:** R$ 56,70
📅 **Cliente desde:** Janeiro 2024

📈 **Suas estatísticas:**
• Filme mais assistido: Vingadores: Ultimato
• Gênero favorito: Ação
• Última compra: 15/01/2024

🎯 **Conquistas:**
🥉 Primeira compra
🎬 Colecionador (3+ filmes)`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: '🎬 Comprar Mais', callback_data: 'catalog_menu' }
      ],
      [
        { text: '⬅️ Voltar', callback_data: 'my_movies' }
      ]
    ]
  };

  await bot.sendMessage(chatId, message, {
    parse_mode: 'Markdown',
    reply_markup: keyboard
  });
  } catch (error) {
    console.error('Erro ao buscar histórico de compras:', error);
    await bot.sendMessage(chatId, '❌ Erro ao carregar histórico. Tente novamente mais tarde.');
  }
};