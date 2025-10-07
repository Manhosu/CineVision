import TelegramBot from 'node-telegram-bot-api';
export declare const helpHandler: (bot: TelegramBot, msg: TelegramBot.Message) => Promise<void>;
export declare const showHelpMenu: (bot: TelegramBot, chatId: number) => Promise<void>;
export declare const showFAQ: (bot: TelegramBot, chatId: number) => Promise<void>;
export declare const showSupportMenu: (bot: TelegramBot, chatId: number) => Promise<void>;
export declare const handleHelpCallback: (bot: TelegramBot, callbackQuery: TelegramBot.CallbackQuery) => Promise<void>;
//# sourceMappingURL=help.handler.d.ts.map