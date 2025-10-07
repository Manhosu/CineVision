import express from 'express';
import TelegramBot from 'node-telegram-bot-api';
export interface PaymentNotificationPayload {
    purchase_token: string;
    status: string;
    purchase_id: string;
    content_id: string;
    preferred_delivery: string;
}
export declare function setupPaymentWebhook(app: express.Application, bot: TelegramBot): void;
//# sourceMappingURL=payment-notification.d.ts.map