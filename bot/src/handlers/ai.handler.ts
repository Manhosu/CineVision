import TelegramBotAPI from 'node-telegram-bot-api';
import axios from 'axios';

const BACKEND_URL = process.env.BACKEND_URL || process.env.BACKEND_API_URL || 'http://localhost:3001';
const API_TOKEN = process.env.API_TOKEN || '';

interface AiReply {
  text: string;
  paused?: boolean;
  paymentLink?: string;
  suggestedContentIds?: string[];
}

/**
 * Dispatch a raw user message to the AI service. Returns false if the bot should
 * NOT auto-reply (either paused or AI disabled for platform).
 */
export async function dispatchAiMessage(
  bot: TelegramBotAPI,
  msg: TelegramBotAPI.Message,
): Promise<boolean> {
  if (!msg.text || msg.text.startsWith('/')) return false;
  if (msg.chat.type !== 'private') return false;

  const chatId = msg.chat.id;

  try {
    const response = await axios.post<AiReply>(
      `${BACKEND_URL}/api/v1/ai-chat/message`,
      {
        platform: 'telegram',
        external_chat_id: String(chatId),
        message: msg.text,
      },
      {
        headers: API_TOKEN ? { Authorization: `Bearer ${API_TOKEN}` } : {},
        timeout: 30000,
      },
    );

    const reply = response.data;

    if (reply.paused) {
      return true; // consumed (we do not reply, admin took over)
    }

    if (!reply.text || !reply.text.trim()) {
      return false;
    }

    await bot.sendMessage(chatId, reply.text);

    if (reply.paymentLink) {
      await bot.sendMessage(chatId, `💳 Clique para pagar:\n${reply.paymentLink}`);
    }

    return true;
  } catch (err: any) {
    console.warn('[AI] dispatch failed:', err.message);
    return false;
  }
}
