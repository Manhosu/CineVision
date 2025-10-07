"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleCatalogCallback = exports.showMovieDetails = exports.showMoviesList = exports.showCatalogMenu = exports.catalogHandler = void 0;
const mockMovies = [
    {
        id: '1',
        title: 'Vingadores: Ultimato',
        price: 19.90,
        poster_url: 'https://example.com/avengers.jpg',
        description: 'O confronto final entre os Vingadores e Thanos.',
        year: 2019,
        genre: 'Ação, Aventura',
        rating: 9.2,
        duration: '3h 1min'
    },
    {
        id: '2',
        title: 'Pantera Negra 2',
        price: 16.90,
        description: 'O reino de Wakanda enfrenta novos desafios.',
        year: 2022,
        genre: 'Ação, Drama',
        rating: 8.5,
        duration: '2h 41min'
    },
    {
        id: '3',
        title: 'Avatar: O Caminho da Água',
        price: 21.90,
        description: 'Jake Sully e sua família enfrentam novos perigos.',
        year: 2022,
        genre: 'Aventura, Ficção',
        rating: 8.8,
        duration: '3h 12min'
    }
];
const catalogHandler = async (bot, msg) => {
    const chatId = msg.chat.id;
    await (0, exports.showCatalogMenu)(bot, chatId);
};
exports.catalogHandler = catalogHandler;
const showCatalogMenu = async (bot, chatId) => {
    const message = `🎬 CATÁLOGO CINE VISION

📁 Escolha uma categoria:`;
    const keyboard = {
        inline_keyboard: [
            [
                { text: '🔥 Lançamentos', callback_data: 'catalog_new_releases' },
                { text: '⭐ Mais Assistidos', callback_data: 'catalog_popular' }
            ],
            [
                { text: '🎭 Ação', callback_data: 'catalog_action' },
                { text: '😂 Comédia', callback_data: 'catalog_comedy' }
            ],
            [
                { text: '❤️ Romance', callback_data: 'catalog_romance' },
                { text: '👻 Terror', callback_data: 'catalog_horror' }
            ],
            [
                { text: '🔍 Buscar', callback_data: 'catalog_search' },
                { text: '⬅️ Voltar', callback_data: 'main_menu' }
            ]
        ]
    };
    await bot.sendMessage(chatId, message, {
        reply_markup: keyboard
    });
};
exports.showCatalogMenu = showCatalogMenu;
const showMoviesList = async (bot, chatId, category, page = 1) => {
    const itemsPerPage = 3;
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const moviesPage = mockMovies.slice(startIndex, endIndex);
    const totalPages = Math.ceil(mockMovies.length / itemsPerPage);
    const categoryNames = {
        'new_releases': '🔥 LANÇAMENTOS 2024',
        'popular': '⭐ MAIS ASSISTIDOS',
        'action': '🎭 FILMES DE AÇÃO',
        'comedy': '😂 COMÉDIAS',
        'romance': '❤️ ROMANCES',
        'horror': '👻 FILMES DE TERROR'
    };
    const message = `${categoryNames[category] || '🎬 FILMES'}

Página ${page} de ${totalPages}`;
    const keyboard = {
        inline_keyboard: [
            ...moviesPage.map(movie => [
                {
                    text: `🎬 ${movie.title} - R$ ${movie.price.toFixed(2).replace('.', ',')}`,
                    callback_data: `movie_details_${movie.id}`
                }
            ]),
            [
                ...(page > 1 ? [{ text: '⬅️ Anterior', callback_data: `catalog_${category}_${page - 1}` }] : []),
                ...(page < totalPages ? [{ text: '➡️ Próxima', callback_data: `catalog_${category}_${page + 1}` }] : [])
            ],
            [
                { text: '⬅️ Menu', callback_data: 'catalog_menu' }
            ]
        ]
    };
    await bot.sendMessage(chatId, message, {
        reply_markup: keyboard
    });
};
exports.showMoviesList = showMoviesList;
const showMovieDetails = async (bot, chatId, movieId) => {
    const movie = mockMovies.find(m => m.id === movieId);
    if (!movie) {
        await bot.sendMessage(chatId, '❌ Filme não encontrado.');
        return;
    }
    const message = `🎬 **${movie.title.toUpperCase()}**

⭐ ${movie.rating}/10 | 🕐 ${movie.duration} | 📅 ${movie.year}
🎭 ${movie.genre}

📝 **Sinopse:**
${movie.description}

💰 **Preço:** R$ ${movie.price.toFixed(2).replace('.', ',')}

👀 **Disponível em:**
• 📱 Download Telegram
• 💻 Streaming no site`;
    const keyboard = {
        inline_keyboard: [
            [
                { text: '💳 Comprar Agora', callback_data: `purchase_${movieId}` },
                { text: '🎬 Trailer', callback_data: `trailer_${movieId}` }
            ],
            [
                { text: '⬅️ Voltar', callback_data: 'catalog_new_releases' },
                { text: '❤️ Favoritar', callback_data: `favorite_${movieId}` }
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
exports.showMovieDetails = showMovieDetails;
const handleCatalogCallback = async (bot, callbackQuery) => {
    const chatId = callbackQuery.message?.chat.id;
    const data = callbackQuery.data;
    if (!chatId || !data)
        return;
    try {
        if (data === 'catalog_menu') {
            await (0, exports.showCatalogMenu)(bot, chatId);
        }
        else if (data.startsWith('catalog_')) {
            const parts = data.split('_');
            const category = parts[1];
            const page = parts[2] ? parseInt(parts[2]) : 1;
            await (0, exports.showMoviesList)(bot, chatId, category, page);
        }
        else if (data.startsWith('movie_details_')) {
            const movieId = data.replace('movie_details_', '');
            await (0, exports.showMovieDetails)(bot, chatId, movieId);
        }
        else if (data.startsWith('purchase_')) {
            const movieId = data.replace('purchase_', '');
            await startPurchaseFlow(bot, chatId, movieId);
        }
        else if (data.startsWith('trailer_')) {
            const movieId = data.replace('trailer_', '');
            await showTrailer(bot, chatId, movieId);
        }
        else if (data.startsWith('favorite_')) {
            const movieId = data.replace('favorite_', '');
            await toggleFavorite(bot, chatId, movieId);
        }
        await bot.answerCallbackQuery(callbackQuery.id);
    }
    catch (error) {
        console.error('Error handling catalog callback:', error);
        await bot.answerCallbackQuery(callbackQuery.id, {
            text: 'Erro temporário. Tente novamente.',
            show_alert: true
        });
    }
};
exports.handleCatalogCallback = handleCatalogCallback;
const startPurchaseFlow = async (bot, chatId, movieId) => {
    const movie = mockMovies.find(m => m.id === movieId);
    if (!movie) {
        await bot.sendMessage(chatId, '❌ Filme não encontrado.');
        return;
    }
    const message = `🛒 **CONFIRMAÇÃO DA COMPRA**

🎬 ${movie.title}
💰 R$ ${movie.price.toFixed(2).replace('.', ',')}

📦 Como você quer receber?`;
    const keyboard = {
        inline_keyboard: [
            [
                { text: '📱 Download Telegram', callback_data: `delivery_telegram_${movieId}` }
            ],
            [
                { text: '💻 Assistir Online', callback_data: `delivery_streaming_${movieId}` }
            ],
            [
                { text: '❌ Cancelar', callback_data: 'catalog_menu' }
            ]
        ]
    };
    await bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
    });
};
const showTrailer = async (bot, chatId, movieId) => {
    const movie = mockMovies.find(m => m.id === movieId);
    if (!movie)
        return;
    await bot.sendMessage(chatId, `🎬 **Trailer: ${movie.title}**

🎥 Aqui está o trailer do filme!

*[Vídeo do trailer seria enviado aqui]*

Gostou? Que tal assistir o filme completo?`, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '💳 Comprar Filme', callback_data: `purchase_${movieId}` }
                ],
                [
                    { text: '⬅️ Voltar', callback_data: `movie_details_${movieId}` }
                ]
            ]
        }
    });
};
const toggleFavorite = async (bot, chatId, movieId) => {
    const movie = mockMovies.find(m => m.id === movieId);
    if (!movie)
        return;
    await bot.sendMessage(chatId, `❤️ **${movie.title}** foi adicionado aos seus favoritos!

Use /meus_filmes para ver todos os seus favoritos.`, {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '⬅️ Voltar', callback_data: `movie_details_${movieId}` }
                ]
            ]
        }
    });
};
//# sourceMappingURL=catalog.handler.js.map