import TelegramBot from 'node-telegram-bot-api';
export declare const notificationsHandler: (bot: TelegramBot, msg: TelegramBot.Message) => Promise<void>;
export declare const showNotificationSettings: (bot: TelegramBot, chatId: number) => Promise<void>;
export declare const handleNotificationCallback: (bot: TelegramBot, query: TelegramBot.CallbackQuery) => Promise<void>;
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
export declare const sendNewReleaseNotification: (bot: TelegramBot, chatId: number, movie: NewRelease) => Promise<void>;
export declare const sendFlashPromotion: (bot: TelegramBot, chatId: number) => Promise<void>;
export declare const handleNotificationsCallback: (bot: TelegramBot, callbackQuery: TelegramBot.CallbackQuery) => Promise<void>;
export declare const broadcastNewRelease: (bot: TelegramBot, movie: NewRelease, subscribers: number[]) => Promise<void>;
export {};
//# sourceMappingURL=notifications.handler.d.ts.map