import TelegramBotAPI from 'node-telegram-bot-api';
export declare class ContentDeliveryService {
    private bot;
    constructor(bot: TelegramBotAPI);
    deliverPurchasedContent(purchaseToken: string): Promise<void>;
    private deliverSiteAccess;
    private generateSignedWatchUrl;
    private deliverTelegramFile;
    private generatePresignedDownloadUrl;
    private sendDownloadLink;
    private sendLocalFile;
    private sendFileFromUrl;
    static onPaymentConfirmed(bot: TelegramBotAPI, purchaseToken: string): Promise<void>;
}
//# sourceMappingURL=content-delivery.service.d.ts.map