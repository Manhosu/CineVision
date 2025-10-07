import TelegramBot from 'node-telegram-bot-api';
export declare function handlePixPayment(bot: TelegramBot, callbackQuery: TelegramBot.CallbackQuery, purchaseToken: string): Promise<void>;
export declare function handleCardPayment(bot: TelegramBot, callbackQuery: TelegramBot.CallbackQuery, purchaseToken: string): Promise<void>;
export declare function handleCheckPayment(bot: TelegramBot, callbackQuery: TelegramBot.CallbackQuery, purchaseId: string): Promise<void>;
export declare function handleCancelPayment(bot: TelegramBot, callbackQuery: TelegramBot.CallbackQuery, purchaseId: string): Promise<void>;
//# sourceMappingURL=payment-callback.handler.d.ts.map