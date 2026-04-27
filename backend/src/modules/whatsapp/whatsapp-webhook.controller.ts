import { Body, Controller, Logger, Post, HttpCode } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AiChatService } from '../ai-chat/ai-chat.service';
import { WhatsappService } from './whatsapp.service';

interface EvolutionMessageEvent {
  event?: string;
  data?: {
    key?: { remoteJid?: string; fromMe?: boolean };
    message?: {
      conversation?: string;
      extendedTextMessage?: { text?: string };
    };
    pushName?: string;
  };
}

@ApiTags('whatsapp')
@Controller('webhooks/whatsapp')
export class WhatsappWebhookController {
  private readonly logger = new Logger(WhatsappWebhookController.name);

  constructor(
    private readonly aiChatService: AiChatService,
    private readonly whatsappService: WhatsappService,
  ) {}

  @Post()
  @HttpCode(200)
  async incoming(@Body() payload: EvolutionMessageEvent) {
    try {
      // We only handle inbound text messages
      if (payload?.data?.key?.fromMe) return { ignored: true };

      const remoteJid = payload?.data?.key?.remoteJid;
      if (!remoteJid) return { ignored: true };

      const text =
        payload?.data?.message?.conversation ||
        payload?.data?.message?.extendedTextMessage?.text ||
        '';

      if (!text.trim()) return { ignored: true };

      // remoteJid looks like "5511999999999@s.whatsapp.net"
      const chatId = remoteJid.split('@')[0];

      const reply = await this.aiChatService.processIncomingMessage({
        platform: 'whatsapp',
        externalChatId: chatId,
        messageText: text,
      });

      if (reply.paused || !reply.text) {
        return { ok: true, paused: true };
      }

      await this.whatsappService.sendText(chatId, reply.text);
      if (reply.paymentLink) {
        await this.whatsappService.sendText(
          chatId,
          `Finalize sua compra aqui: ${reply.paymentLink}`,
        );
      }
      return { ok: true };
    } catch (err: any) {
      this.logger.error(`WhatsApp webhook error: ${err.message}`);
      return { ok: false, error: err.message };
    }
  }
}
