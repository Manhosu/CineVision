"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const dotenv_1 = __importDefault(require("dotenv"));
const bot_1 = require("./bot");
const webhook_handler_1 = require("./handlers/webhook.handler");
const payment_notification_1 = require("./webhooks/payment-notification");
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = process.env.BOT_PORT || 3003;
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)());
app.use(express_1.default.json());
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 100,
});
app.use(limiter);
const telegramBot = new bot_1.TelegramBot();
const bot = telegramBot.getBot();
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        service: 'Cine Vision Telegram Bot',
        version: '2.0.0',
        timestamp: new Date().toISOString()
    });
});
app.post('/webhook/telegram', webhook_handler_1.webhookHandler);
(0, payment_notification_1.setupPaymentWebhook)(app, bot);
app.listen(port, () => {
    console.log(`🤖 Cine Vision Telegram Bot running on port ${port}`);
    console.log(`📡 Webhook endpoint: http://localhost:${port}/webhook/telegram`);
});
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down Telegram Bot...');
    telegramBot.stop();
    process.exit(0);
});
process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down Telegram Bot...');
    telegramBot.stop();
    process.exit(0);
});
//# sourceMappingURL=index.js.map