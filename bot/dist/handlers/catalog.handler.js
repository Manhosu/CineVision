"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toggleFavorite = exports.catalogService = exports.handleCatalogCallback = exports.showMovieDetails = exports.showMoviesList = exports.showCatalogMenu = exports.catalogHandler = void 0;
const catalog_service_1 = require("../services/catalog.service");
const catalogService = new catalog_service_1.CatalogService();
exports.catalogService = catalogService;
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
    try {
        const itemsPerPage = 5;
        const result = await catalogService.fetchMovies(category, page, itemsPerPage);
        if (result.movies.length === 0) {
            await bot.sendMessage(chatId, `📭 Nenhum filme encontrado nesta categoria.

Tente outra categoria ou volte mais tarde!`, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '⬅️ Menu', callback_data: 'catalog_menu' }]
                    ]
                }
            });
            return;
        }
        const categoryName = catalogService.getCategoryName(category);
        const message = `${categoryName}

📄 Página ${page} de ${result.totalPages}
📊 Total: ${result.total} filmes`;
        const keyboard = {
            inline_keyboard: [
                ...result.movies.map(movie => {
                    const formatted = catalogService.formatMovieForDisplay(movie);
                    return [{
                            text: `🎬 ${movie.title} - ${formatted.price}`,
                            callback_data: `movie_details_${movie.id}`
                        }];
                }),
                [
                    ...(page > 1 ? [{ text: '⬅️ Anterior', callback_data: `catalog_${category}_${page - 1}` }] : []),
                    ...(page < result.totalPages ? [{ text: '➡️ Próxima', callback_data: `catalog_${category}_${page + 1}` }] : [])
                ],
                [
                    { text: '⬅️ Menu', callback_data: 'catalog_menu' }
                ]
            ]
        };
        await bot.sendMessage(chatId, message, {
            reply_markup: keyboard
        });
    }
    catch (error) {
        console.error('Error showing movies list:', error);
        await bot.sendMessage(chatId, '❌ Erro ao carregar filmes. Tente novamente.');
    }
};
exports.showMoviesList = showMoviesList;
const showMovieDetails = async (bot, chatId, movieId) => {
    try {
        const movie = await catalogService.fetchMovieById(movieId);
        if (!movie) {
            await bot.sendMessage(chatId, '❌ Filme não encontrado.');
            return;
        }
        const formatted = catalogService.formatMovieForDisplay(movie);
        const genres = Array.isArray(movie.genres) ? movie.genres.join(', ') : (movie.genres || 'N/A');
        const rating = movie.imdb_rating ? `⭐ ${movie.imdb_rating}/10` : '';
        const duration = movie.duration_minutes ? `🕐 ${movie.duration_minutes} min` : '';
        const year = movie.release_year ? `📅 ${movie.release_year}` : '';
        const message = `🎬 **${movie.title.toUpperCase()}**

${[rating, duration, year].filter(Boolean).join(' | ')}
🎭 ${genres}

📝 **Sinopse:**
${formatted.description}

💰 **Preço:** ${formatted.price}

👀 **Disponível em:**
${movie.availability === 'telegram' ? '• 📱 Download Telegram' : ''}
${movie.availability === 'site' ? '• 💻 Streaming no site' : ''}
${movie.availability === 'both' || !movie.availability ? '• 📱 Download Telegram\n• 💻 Streaming no site' : ''}`;
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '💳 Comprar Agora', callback_data: `purchase_${movieId}` },
                    ...(movie.trailer_url ? [{ text: '🎬 Trailer', callback_data: `trailer_${movieId}` }] : [])
                ],
                [
                    { text: '⬅️ Voltar', callback_data: 'catalog_new_releases' },
                    { text: '❤️ Favoritar', callback_data: `favorite_${movieId}` }
                ]
            ]
        };
        if (formatted.poster) {
            try {
                await bot.sendPhoto(chatId, formatted.poster, {
                    caption: message,
                    parse_mode: 'Markdown',
                    reply_markup: keyboard
                });
            }
            catch (photoError) {
                await bot.sendMessage(chatId, message, {
                    parse_mode: 'Markdown',
                    reply_markup: keyboard
                });
            }
        }
        else {
            await bot.sendMessage(chatId, message, {
                parse_mode: 'Markdown',
                reply_markup: keyboard
            });
        }
    }
    catch (error) {
        console.error('Error showing movie details:', error);
        await bot.sendMessage(chatId, '❌ Erro ao carregar detalhes do filme.');
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
        else if (data === 'catalog_search') {
            await bot.sendMessage(chatId, `🔍 **Buscar Filmes**

Para buscar um filme, use o comando:
/buscar <nome do filme>

Exemplo: /buscar Vingadores`, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '⬅️ Menu', callback_data: 'catalog_menu' }]
                    ]
                }
            });
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
    try {
        const movie = await catalogService.fetchMovieById(movieId);
        if (!movie) {
            await bot.sendMessage(chatId, '❌ Filme não encontrado.');
            return;
        }
        const formatted = catalogService.formatMovieForDisplay(movie);
        const message = `🛒 **CONFIRMAÇÃO DA COMPRA**

🎬 ${movie.title}
💰 ${formatted.price}

📦 Como você quer receber?`;
        const keyboard = {
            inline_keyboard: [
                ...(movie.availability === 'telegram' || movie.availability === 'both' || !movie.availability
                    ? [[{ text: '📱 Download Telegram', callback_data: `delivery_telegram_${movieId}` }]]
                    : []),
                ...(movie.availability === 'site' || movie.availability === 'both' || !movie.availability
                    ? [[{ text: '💻 Assistir Online', callback_data: `delivery_streaming_${movieId}` }]]
                    : []),
                [
                    { text: '❌ Cancelar', callback_data: 'catalog_menu' }
                ]
            ]
        };
        await bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }
    catch (error) {
        console.error('Error starting purchase flow:', error);
        await bot.sendMessage(chatId, '❌ Erro ao processar compra. Tente novamente.');
    }
};
const showTrailer = async (bot, chatId, movieId) => {
    try {
        const movie = await catalogService.fetchMovieById(movieId);
        if (!movie)
            return;
        if (movie.trailer_url) {
            await bot.sendMessage(chatId, `🎬 **Trailer: ${movie.title}**

🎥 Assista ao trailer:
${movie.trailer_url}

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
        }
        else {
            await bot.sendMessage(chatId, '❌ Trailer não disponível para este filme.', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '⬅️ Voltar', callback_data: `movie_details_${movieId}` }]
                    ]
                }
            });
        }
    }
    catch (error) {
        console.error('Error showing trailer:', error);
    }
};
const toggleFavorite = async (bot, chatId, movieId) => {
    try {
        const movie = await catalogService.fetchMovieById(movieId);
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
    }
    catch (error) {
        console.error('Error toggling favorite:', error);
    }
};
exports.toggleFavorite = toggleFavorite;
//# sourceMappingURL=catalog.handler.js.map