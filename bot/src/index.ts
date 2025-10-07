import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { TelegramBot } from './bot';
import { webhookHandler } from './handlers/webhook.handler';
import { setupPaymentWebhook } from './webhooks/payment-notification';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.BOT_PORT || 3003;

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Initialize Telegram Bot
const telegramBot = new TelegramBot();
const bot = telegramBot.getBot();

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'Cine Vision Telegram Bot', 
    version: '2.0.0',
    timestamp: new Date().toISOString() 
  });
});

// Webhook endpoint for Telegram
app.post('/webhook/telegram', webhookHandler);

// Setup payment webhook
setupPaymentWebhook(app, bot);

// Start server
app.listen(port, () => {
  console.log(`🤖 Cine Vision Telegram Bot running on port ${port}`);
  console.log(`📡 Webhook endpoint: http://localhost:${port}/webhook/telegram`);
});

// Handle graceful shutdown
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