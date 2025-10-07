"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleMyMoviesCallback = exports.showMyMovies = exports.myMoviesHandler = void 0;
const mockUserMovies = [
    {
        id: '1',
        title: 'Vingadores: Ultimato',
        purchaseDate: '2024-01-15',
        downloadLink: 'https://download.cinevision.com/avengers-endgame',
        streamingLink: 'https://cinevision.com/watch/abc123',
        status: 'active',
        thumbnail: 'https://example.com/avengers-thumb.jpg'
    },
    {
        id: '2',
        title: 'Pantera Negra 2',
        purchaseDate: '2024-01-10',
        downloadLink: 'https://download.cinevision.com/black-panther-2',
        streamingLink: 'https://cinevision.com/watch/def456',
        status: 'active'
    },
    {
        id: '3',
        title: 'Avatar 2',
        purchaseDate: '2024-01-05',
        downloadLink: 'https://download.cinevision.com/avatar-2',
        streamingLink: 'https://cinevision.com/watch/ghi789',
        status: 'active'
    }
];
const myMoviesHandler = async (bot, msg) => {
    const chatId = msg.chat.id;
    await (0, exports.showMyMovies)(bot, chatId);
};
exports.myMoviesHandler = myMoviesHandler;
const showMyMovies = async (bot, chatId) => {
    if (mockUserMovies.length === 0) {
        const message = `📱 **MEUS FILMES**

😔 Você ainda não tem filmes.

🎬 Que tal comprar seu primeiro filme?`;
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '🎬 Ver Catálogo', callback_data: 'catalog_menu' }
                ]
            ]
        };
        await bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
        return;
    }
    const message = `📱 **MEUS FILMES**

🎬 Você tem ${mockUserMovies.length} filmes:`;
    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    for (const movie of mockUserMovies) {
        await sendMovieCard(bot, chatId, movie);
    }
    const finalKeyboard = {
        inline_keyboard: [
            [
                { text: '🎬 Comprar Mais', callback_data: 'catalog_menu' },
                { text: '📊 Histórico Completo', callback_data: 'purchase_history' }
            ]
        ]
    };
    await bot.sendMessage(chatId, '👆 Seus filmes acima', {
        reply_markup: finalKeyboard
    });
};
exports.showMyMovies = showMyMovies;
const sendMovieCard = async (bot, chatId, movie) => {
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
    }
    else {
        await bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }
};
const handleMyMoviesCallback = async (bot, callbackQuery) => {
    const chatId = callbackQuery.message?.chat.id;
    const data = callbackQuery.data;
    if (!chatId || !data)
        return;
    try {
        if (data.startsWith('download_')) {
            const movieId = data.replace('download_', '');
            await handleDownload(bot, chatId, movieId);
        }
        else if (data.startsWith('watch_')) {
            const movieId = data.replace('watch_', '');
            await handleWatch(bot, chatId, movieId);
        }
        else if (data === 'purchase_history') {
            await showPurchaseHistory(bot, chatId);
        }
        await bot.answerCallbackQuery(callbackQuery.id);
    }
    catch (error) {
        console.error('Error handling my movies callback:', error);
        await bot.answerCallbackQuery(callbackQuery.id, {
            text: 'Erro temporário. Tente novamente.',
            show_alert: true
        });
    }
};
exports.handleMyMoviesCallback = handleMyMoviesCallback;
const handleDownload = async (bot, chatId, movieId) => {
    const movie = mockUserMovies.find(m => m.id === movieId);
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
};
const handleWatch = async (bot, chatId, movieId) => {
    const movie = mockUserMovies.find(m => m.id === movieId);
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
};
const showPurchaseHistory = async (bot, chatId) => {
    const message = `📊 **HISTÓRICO COMPLETO**

📱 **Resumo da sua conta:**

🎬 **Total de filmes:** ${mockUserMovies.length}
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
};
//# sourceMappingURL=my-movies.handler.js.map