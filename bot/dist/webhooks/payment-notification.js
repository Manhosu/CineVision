"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupPaymentWebhook = setupPaymentWebhook;
const express_1 = __importDefault(require("express"));
const content_delivery_service_1 = require("../services/content-delivery.service");
function setupPaymentWebhook(app, bot) {
    app.post('/webhook/payment-confirmed', express_1.default.json(), async (req, res) => {
        try {
            const payload = req.body;
            const signature = req.headers['x-webhook-signature'];
            if (!verifyWebhookSignature(signature, payload)) {
                return res.status(401).json({ error: 'Invalid signature' });
            }
            if (payload.status === 'paid') {
                await content_delivery_service_1.ContentDeliveryService.onPaymentConfirmed(bot, payload.purchase_token);
            }
            res.json({ success: true, processed_at: new Date().toISOString() });
        }
        catch (error) {
            console.error('Error processing payment notification:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });
}
function verifyWebhookSignature(signature, payload) {
    const webhookSecret = process.env.WEBHOOK_SECRET;
    if (!webhookSecret) {
        console.warn('WEBHOOK_SECRET not set - skipping signature verification');
        return true;
    }
    return signature !== undefined;
}
//# sourceMappingURL=payment-notification.js.map