import TelegramBotAPI from 'node-telegram-bot-api';
export declare class TelegramBot {
    private bot;
    private notificationService;
    private token;
    constructor(token?: string);
    private setupCommands;
    private setupCallbacks;
    private handlePurchase;
    private handleWatch;
    private handleDownload;
    private handlePaymentMethod;
    private handlePixPayment;
    private handleCardPayment;
    private handleCancelPurchase;
    sendMessage(chatId: number | string, text: string, options?: any): Promise<TelegramBotAPI.Message>;
    sendPhoto(chatId: number | string, photo: string, options?: any): Promise<TelegramBotAPI.Message>;
    sendDocument(chatId: number | string, document: string, options?: any): Promise<TelegramBotAPI.Message>;
    stop(): void;
    private showMainMenu;
    private handleDeliverySelection;
    private showPurchasesHandler;
    private handleMovieRequest;
    private getStatusEmoji;
    private getStatusText;
    private handleWatchCallback;
    getBot(): TelegramBotAPI;
}
//# sourceMappingURL=bot.d.ts.map