"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.webhookHandler = void 0;
const webhookHandler = async (req, res) => {
    try {
        const update = req.body;
        console.log('Telegram webhook received:', {
            updateId: update.update_id,
            type: update.message ? 'message' : update.callback_query ? 'callback_query' : 'unknown'
        });
        if (update.message) {
            await handleMessage(update.message);
        }
        else if (update.callback_query) {
            await handleCallbackQuery(update.callback_query);
        }
        res.json({ status: 'ok' });
    }
    catch (error) {
        console.error('Webhook handler error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.webhookHandler = webhookHandler;
const handleMessage = async (message) => {
    const { chat, text, from } = message;
    console.log(`Message from ${from.username || from.first_name}: ${text}`);
};
const handleCallbackQuery = async (callbackQuery) => {
    const { data, from, message } = callbackQuery;
    console.log(`Callback from ${from.username || from.first_name}: ${data}`);
};
//# sourceMappingURL=webhook.handler.js.map