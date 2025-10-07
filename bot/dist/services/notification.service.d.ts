import TelegramBotAPI from 'node-telegram-bot-api';
interface User {
    id: string;
    telegram_id: string;
    name: string;
    email?: string;
    notification_preferences?: {
        new_releases: boolean;
        payment_confirmations: boolean;
        promotions: boolean;
    };
}
interface Movie {
    id: string;
    title: string;
    description: string;
    poster_url?: string;
    price_cents: number;
    currency: string;
    genre?: string;
    release_year?: number;
}
export declare class NotificationService {
    private bot;
    constructor(bot: TelegramBotAPI);
    sendPaymentConfirmation(telegramId: string, purchaseToken: string): Promise<void>;
    broadcastNewRelease(movie: Movie): Promise<void>;
    private sendNewReleaseToUser;
    broadcastPromotion(title: string, description: string, discountPercent?: number, validUntil?: Date): Promise<void>;
    private getSubscribedUsers;
    private markUserAsInactive;
    updateNotificationPreferences(telegramId: string, preferences: Partial<User['notification_preferences']>): Promise<void>;
    handleNotificationCallback(callbackQuery: TelegramBotAPI.CallbackQuery): Promise<void>;
}
export {};
//# sourceMappingURL=notification.service.d.ts.map