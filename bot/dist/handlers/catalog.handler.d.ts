import TelegramBot from 'node-telegram-bot-api';
export declare const catalogHandler: (bot: TelegramBot, msg: TelegramBot.Message) => Promise<void>;
export declare const showCatalogMenu: (bot: TelegramBot, chatId: number) => Promise<void>;
export declare const showMoviesList: (bot: TelegramBot, chatId: number, category: string, page?: number) => Promise<void>;
export declare const showMovieDetails: (bot: TelegramBot, chatId: number, movieId: string) => Promise<void>;
export declare const handleCatalogCallback: (bot: TelegramBot, callbackQuery: TelegramBot.CallbackQuery) => Promise<void>;
//# sourceMappingURL=catalog.handler.d.ts.map