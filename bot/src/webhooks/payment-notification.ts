import express from 'express';
import { ContentDeliveryService } from '../services/content-delivery.service';
import TelegramBot from 'node-telegram-bot-api';

export interface PaymentNotificationPayload {
  purchase_token: string;
  status: string;
  purchase_id: string;
  content_id: string;
  preferred_delivery: string;
}

export function setupPaymentWebhook(app: express.Application, bot: TelegramBot) {
  // Endpoint for backend to notify bot about payment confirmations
  app.post('/webhook/payment-confirmed', express.json(), async (req, res) => {
    try {
      const payload: PaymentNotificationPayload = req.body;

      // Verify webhook signature if needed
      const signature = req.headers['x-webhook-signature'] as string;
      if (!verifyWebhookSignature(signature, payload)) {
        return res.status(401).json({ error: 'Invalid signature' });
      }

      // Only process paid purchases
      if (payload.status === 'paid') {
        await ContentDeliveryService.onPaymentConfirmed(bot, payload.purchase_token);
      }

      res.json({ success: true, processed_at: new Date().toISOString() });
    } catch (error) {
      console.error('Error processing payment notification:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
}

function verifyWebhookSignature(signature: string, payload: PaymentNotificationPayload): boolean {
  // TODO: Implement proper signature verification
  // For now, just check if signature exists
  const webhookSecret = process.env.WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.warn('WEBHOOK_SECRET not set - skipping signature verification');
    return true; // Allow in development
  }

  // In production, implement HMAC verification:
  // const crypto = require('crypto');
  // const expectedSignature = crypto
  //   .createHmac('sha256', webhookSecret)
  //   .update(JSON.stringify(payload))
  //   .digest('hex');
  // return signature === `sha256=${expectedSignature}`;

  return signature !== undefined;
}