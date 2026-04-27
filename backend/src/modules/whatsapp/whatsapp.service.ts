import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(private readonly configService: ConfigService) {}

  private get config() {
    return {
      provider: this.configService.get<string>('WHATSAPP_PROVIDER') || 'evolution',
      apiUrl: this.configService.get<string>('WHATSAPP_API_URL'),
      apiKey: this.configService.get<string>('WHATSAPP_API_KEY'),
      instance: this.configService.get<string>('WHATSAPP_INSTANCE') || 'cinevision',
    };
  }

  async sendText(to: string, text: string): Promise<boolean> {
    const { apiUrl, apiKey, instance, provider } = this.config;

    if (!apiUrl || !apiKey) {
      this.logger.warn('WhatsApp not configured — skipping send');
      return false;
    }

    try {
      if (provider === 'evolution') {
        await axios.post(
          `${apiUrl}/message/sendText/${instance}`,
          { number: to, text },
          {
            headers: { apikey: apiKey },
            timeout: 10000,
          },
        );
        return true;
      }

      // fallback generic
      await axios.post(
        apiUrl,
        { to, text },
        { headers: { Authorization: `Bearer ${apiKey}` }, timeout: 10000 },
      );
      return true;
    } catch (err: any) {
      this.logger.warn(`WhatsApp send failed to ${to}: ${err.message}`);
      return false;
    }
  }

  isConfigured(): boolean {
    const { apiUrl, apiKey } = this.config;
    return !!(apiUrl && apiKey);
  }
}
