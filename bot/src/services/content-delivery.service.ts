import TelegramBotAPI from 'node-telegram-bot-api';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { SecurityService } from './security.service';

interface Purchase {
  id: string;
  purchase_token: string;
  status: string;
  amount_cents: number;
  currency: string;
  preferred_delivery: string;
  access_token?: string;
  access_expires_at?: Date;
  content: {
    id: string;
    title: string;
    poster_url?: string;
    video_url?: string;
    storage_path?: string;
  };
  user?: {
    id: string;
    name: string;
    telegram_id?: string;
  };
  created_at: Date;
}

export class ContentDeliveryService {
  constructor(private bot: TelegramBotAPI) {}

  async deliverPurchasedContent(purchaseToken: string): Promise<void> {
    try {
      // Fetch purchase details using authenticated request
      const purchase: Purchase = await SecurityService.makeAuthenticatedRequest(
        'GET',
        `${process.env.BACKEND_URL}/api/purchases/token/${purchaseToken}`
      );

      if (purchase.status !== 'completed' && purchase.status !== 'paid') {
        console.log(`Cannot deliver content for purchase ${purchase.id} - status: ${purchase.status}`);
        return;
      }

      const chatId = purchase.user?.telegram_id;
      if (!chatId) {
        console.log(`No telegram_id found for purchase ${purchase.id}`);
        return;
      }

      if (purchase.preferred_delivery === 'site') {
        await this.deliverSiteAccess(chatId, purchase);
      } else {
        await this.deliverTelegramFile(chatId, purchase);
      }

    } catch (error) {
      console.error('Error delivering content:', error);
    }
  }

  private async deliverSiteAccess(chatId: string, purchase: Purchase): Promise<void> {
    try {
      // Generate signed URL for secure access
      const signedUrl = await this.generateSignedWatchUrl(purchase);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

      const message = `✅ **Compra confirmada!**

🎥 **${purchase.content.title}**
💰 Valor: R$ ${(purchase.amount_cents / 100).toFixed(2)}

🎬 **Assistir Online:**
Clique no botão abaixo para assistir

⏰ **Acesso válido por 24 horas**

🎆 Bom filme!`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: '🎬 Assistir Agora', url: signedUrl }
          ],
          [
            { text: '📱 Acessar Site', url: frontendUrl },
            { text: '💳 Minhas Compras', callback_data: 'my_purchases' }
          ]
        ]
      };

      if (purchase.content.poster_url) {
        await this.bot.sendPhoto(chatId, purchase.content.poster_url, {
          caption: message,
          parse_mode: 'Markdown',
          reply_markup: keyboard
        });
      } else {
        await this.bot.sendMessage(chatId, message, {
          parse_mode: 'Markdown',
          reply_markup: keyboard
        });
      }
    } catch (error) {
      console.error('Error delivering site access:', error);
      await this.bot.sendMessage(chatId, '❌ Erro ao gerar link de acesso. Tente novamente mais tarde.');
    }
  }

  private async generateSignedWatchUrl(purchase: Purchase): Promise<string> {
    try {
      // Request signed URL from backend
      const response = await SecurityService.makeAuthenticatedRequest(
        'POST',
        `${process.env.BACKEND_URL}/api/content/signed-url`,
        {
          purchase_id: purchase.id,
          content_id: purchase.content.id,
          expires_in: 24 * 60 * 60 // 24 hours in seconds
        }
      );

      return response.signed_url;
    } catch (error) {
      console.error('Error generating signed URL:', error);
      // Fallback to basic URL
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      return `${frontendUrl}/watch/${purchase.content.id}?token=${purchase.access_token}`;
    }
  }

  private async deliverTelegramFile(chatId: string, purchase: Purchase): Promise<void> {
    try {
      const message = `✅ **Compra confirmada!**

🎥 **${purchase.content.title}**
💰 Valor: R$ ${(purchase.amount_cents / 100).toFixed(2)}

📁 **Download via Telegram:**
Preparando arquivo... Por favor, aguarde.

🎆 Bom filme!`;

      await this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });

      // Try to get presigned download URL first
      try {
        const downloadUrl = await this.generatePresignedDownloadUrl(purchase);
        await this.sendDownloadLink(chatId, purchase, downloadUrl);
        return;
      } catch (error) {
        console.log('Presigned URL not available, trying other methods...');
      }

      // Check if file exists locally
      if (purchase.content.storage_path && fs.existsSync(purchase.content.storage_path)) {
        // Send local file
        await this.sendLocalFile(chatId, purchase);
      } else if (purchase.content.video_url) {
        // Send file from URL
        await this.sendFileFromUrl(chatId, purchase);
      } else {
        // No file available
        await this.bot.sendMessage(
          chatId,
          `❌ **Arquivo temporariamente indisponível**

O arquivo do filme ainda está sendo processado. Você receberá o download em breve.

Enquanto isso, você pode assistir online através do nosso site.`,
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: '🎬 Assistir Online', callback_data: `watch_${purchase.id}` }]
              ]
            }
          }
        );
      }

    } catch (error) {
      console.error('Error sending file via Telegram:', error);
      await this.bot.sendMessage(
        chatId,
        `❌ **Erro no envio do arquivo**

Houve um problema ao enviar o arquivo. Nossa equipe foi notificada e resolverá em breve.

Enquanto isso, você pode assistir online através do nosso site.`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🎬 Assistir Online', callback_data: `watch_${purchase.id}` }]
            ]
          }
        }
      );
    }
  }

  private async generatePresignedDownloadUrl(purchase: Purchase): Promise<string> {
    try {
      // Request presigned download URL from backend
      const response = await SecurityService.makeAuthenticatedRequest(
        'POST',
        `${process.env.BACKEND_URL}/api/content/presigned-download`,
        {
          purchase_id: purchase.id,
          content_id: purchase.content.id,
          expires_in: 24 * 60 * 60 // 24 hours in seconds
        }
      );

      return response.download_url;
    } catch (error) {
      console.error('Error generating presigned download URL:', error);
      throw error;
    }
  }

  private async sendDownloadLink(chatId: string, purchase: Purchase, downloadUrl: string): Promise<void> {
    const message = `📁 **Download Disponível**

🎥 **${purchase.content.title}**

🔗 **Link de Download Seguro:**
Clique no botão abaixo para baixar

⏰ **Link válido por 24 horas**
📱 **Compatível com todos os dispositivos**

✅ Aproveite seu filme!`;

    await this.bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📥 Baixar Filme', url: downloadUrl }
          ],
          [
            { text: '🎬 Assistir Online', callback_data: `watch_${purchase.id}` },
            { text: '💳 Minhas Compras', callback_data: 'my_purchases' }
          ]
        ]
      }
    });
  }

  private async sendLocalFile(chatId: string, purchase: Purchase): Promise<void> {
    const filePath = purchase.content.storage_path!;
    const fileName = path.basename(filePath);

    // Check file size (Telegram limit is ~50MB for bots)
    const stats = fs.statSync(filePath);
    const fileSizeMB = stats.size / (1024 * 1024);

    if (fileSizeMB > 50) {
      await this.bot.sendMessage(
        chatId,
        `📁 **Arquivo muito grande para envio direto**

O filme "${purchase.content.title}" (${fileSizeMB.toFixed(1)}MB) excede o limite do Telegram.

**Opções disponíveis:**
• Assistir online no site
• Baixar diretamente pelo link que será enviado em breve`
      );
      return;
    }

    // Send the file
    await this.bot.sendDocument(chatId, filePath, {
      caption: `🎥 ${purchase.content.title}\n\n✅ Download concluído!`
    });
  }

  private async sendFileFromUrl(chatId: string, purchase: Purchase): Promise<void> {
    try {
      // For URLs, we can either stream or provide download link
      const downloadMessage = `📁 **Link de Download**

🎥 **${purchase.content.title}**

🔗 **Link direto:** ${purchase.content.video_url}

⏰ **Link válido por 24 horas**

📋 **Instruções:**
1. Clique no link acima
2. O download iniciará automaticamente
3. Salve o arquivo em seu dispositivo

✅ Aproveite seu filme!`;

      await this.bot.sendMessage(chatId, downloadMessage, { parse_mode: 'Markdown' });

    } catch (error) {
      console.error('Error providing download link:', error);
      throw error;
    }
  }

  // Method to be called by webhook when payment is confirmed
  static async onPaymentConfirmed(bot: TelegramBotAPI, purchaseToken: string): Promise<void> {
    const deliveryService = new ContentDeliveryService(bot);
    await deliveryService.deliverPurchasedContent(purchaseToken);
  }
}