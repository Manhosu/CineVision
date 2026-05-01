import TelegramBotAPI from 'node-telegram-bot-api';
import axios from 'axios';
import { trackEphemeral, cleanupPrevious } from '../services/ephemeral-messages.service';

const BACKEND_URL = process.env.BACKEND_URL || process.env.BACKEND_API_URL || 'http://localhost:3001';

interface OrderPurchase {
  id: string;
  content_id: string;
  amount_cents: number;
  content: { id: string; title: string; poster_url?: string };
}

interface OrderResponse {
  id: string;
  order_token: string;
  status: string;
  total_cents: number;
  discount_percent: number;
  total_items: number;
  purchases: OrderPurchase[];
  payment?: {
    provider_meta?: {
      qr_code?: string;
      qr_code_base64?: string;
    };
    status: string;
  };
}

const fmt = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export async function handleOrderDeepLink(
  bot: TelegramBotAPI,
  chatId: number,
  orderToken: string,
): Promise<void> {
  await cleanupPrevious(bot, chatId);

  try {
    const res = await axios.get<OrderResponse>(
      `${BACKEND_URL}/api/v1/orders/token/${orderToken}`,
      { timeout: 10000 },
    );
    const order = res.data;

    if (!order) {
      await bot.sendMessage(chatId, '❌ Pedido não encontrado.');
      return;
    }

    if (order.status === 'paid') {
      await bot.sendMessage(
        chatId,
        `✅ Esse pedido já foi pago!\n\nUse /minhascompras para acessar seus conteúdos.`,
      );
      return;
    }

    const qr = order.payment?.provider_meta?.qr_code;
    const qrB64 = order.payment?.provider_meta?.qr_code_base64;

    const itemList = order.purchases
      .map((p, i) => `${i + 1}. ${p.content.title}`)
      .join('\n');

    const discountLine = order.discount_percent > 0
      ? `\n🎁 Desconto aplicado: ${order.discount_percent}%`
      : '';

    const header =
      `🛒 *Seu pedido*\n\n${itemList}${discountLine}\n\n💰 Total: *R$ ${fmt(order.total_cents)}*\n\n` +
      `📱 Pague com PIX:`;

    if (qrB64) {
      // send the QR image
      const buf = Buffer.from(
        qrB64.startsWith('data:') ? qrB64.split(',')[1] : qrB64,
        'base64',
      );
      const qrMsg = await bot.sendPhoto(chatId, buf, {
        caption: header,
        parse_mode: 'Markdown',
      });
      await trackEphemeral(chatId, qrMsg.message_id, 'order_qr');
    } else {
      const msg = await bot.sendMessage(chatId, header, { parse_mode: 'Markdown' });
      await trackEphemeral(chatId, msg.message_id, 'order_header');
    }

    if (qr) {
      const codeMsg = await bot.sendMessage(
        chatId,
        `*Código copia-e-cola:*\n\`${qr}\``,
        { parse_mode: 'Markdown' },
      );
      await trackEphemeral(chatId, codeMsg.message_id, 'order_code');
    }

    const statusMsg = await bot.sendMessage(chatId, '⏳ Aguardando pagamento...', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔄 Já paguei', callback_data: `order_check_${orderToken}` }],
          [{ text: '❌ Cancelar', callback_data: `order_cancel_${orderToken}` }],
        ],
      },
    });
    await trackEphemeral(chatId, statusMsg.message_id, 'order_status');
  } catch (err: any) {
    console.error('Order deep-link error', err.message);
    await bot.sendMessage(
      chatId,
      `❌ Não foi possível processar seu pedido. Tente novamente em instantes.`,
    );
  }
}

export async function handleOrderCheck(
  bot: TelegramBotAPI,
  chatId: number,
  orderToken: string,
): Promise<void> {
  try {
    const res = await axios.get<OrderResponse>(
      `${BACKEND_URL}/api/v1/orders/token/${orderToken}`,
      { timeout: 10000 },
    );
    const order = res.data;
    if (order?.status === 'paid') {
      await cleanupPrevious(bot, chatId);
      const fixedMsg = await bot.sendMessage(
        chatId,
        `✅ *Pagamento confirmado!*\n\nVocê recebeu ${order.total_items} ${order.total_items === 1 ? 'item' : 'itens'}. Abrindo os links...\n\nDigite /start para iniciar o bot novamente.`,
        { parse_mode: 'Markdown' },
      );
      // Not tracked — this message is the fixed one mentioned in the scope
      return;
    }
    await bot.sendMessage(chatId, '⏳ Ainda não identificamos seu pagamento. Aguarde mais alguns segundos.');
  } catch (err: any) {
    await bot.sendMessage(chatId, `❌ Erro ao verificar pagamento: ${err.message}`);
  }
}
