import TelegramBotAPI from 'node-telegram-bot-api';
import axios from 'axios';

const BACKEND_URL = process.env.BACKEND_URL || process.env.BACKEND_API_URL || 'http://localhost:3001';
const API_TOKEN = process.env.API_TOKEN || '';

// In-memory LRU to reduce DB hits for the same chat
const memoryCache = new Map<string, Array<{ id: string; message_id: number; step?: string }>>();

function headers() {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (API_TOKEN) h.Authorization = `Bearer ${API_TOKEN}`;
  return h;
}

/**
 * Track a bot message as "ephemeral" - it will be deleted when the next step happens.
 * Best-effort: never throws.
 */
export async function trackEphemeral(chatId: string | number, messageId: number, step: string): Promise<void> {
  const key = String(chatId);
  try {
    const list = memoryCache.get(key) || [];
    list.push({ id: '', message_id: messageId, step });
    memoryCache.set(key, list);

    await axios.post(
      `${BACKEND_URL}/api/v1/bot/ephemeral-messages`,
      { chat_id: key, message_id: messageId, step },
      { headers: headers(), timeout: 3000 },
    );
  } catch {
    // silent fail — we still have the in-memory copy
  }
}

/**
 * Delete all previously tracked messages for this chat and clear the list.
 */
export async function cleanupPrevious(
  bot: TelegramBotAPI,
  chatId: string | number,
  keepStep?: string,
): Promise<void> {
  const key = String(chatId);

  let list = memoryCache.get(key) || [];

  // Also fetch from backend (in case server restarted)
  try {
    const response = await axios.get(
      `${BACKEND_URL}/api/v1/bot/ephemeral-messages?chat_id=${encodeURIComponent(key)}`,
      { headers: headers(), timeout: 3000 },
    );
    const remote: Array<{ id: string; message_id: number; step?: string }> = response.data || [];
    // merge unique by message_id
    const map = new Map<number, any>();
    for (const m of [...list, ...remote]) map.set(m.message_id, m);
    list = Array.from(map.values());
  } catch {
    // use memory only
  }

  const toDelete = keepStep ? list.filter((m) => m.step !== keepStep) : list;
  const toKeep = keepStep ? list.filter((m) => m.step === keepStep) : [];

  for (const msg of toDelete) {
    try {
      await bot.deleteMessage(chatId, msg.message_id);
    } catch {
      // Telegram won't allow deleting >48h messages; ignore
    }
  }

  memoryCache.set(key, toKeep);

  try {
    await axios.delete(
      `${BACKEND_URL}/api/v1/bot/ephemeral-messages?chat_id=${encodeURIComponent(key)}${
        keepStep ? `&keep_step=${encodeURIComponent(keepStep)}` : ''
      }`,
      { headers: headers(), timeout: 3000 },
    );
  } catch {
    // silent
  }
}
