"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContentDeliveryService = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const security_service_1 = require("./security.service");
class ContentDeliveryService {
    constructor(bot) {
        this.bot = bot;
    }
    async deliverPurchasedContent(purchaseToken) {
        try {
            const purchase = await security_service_1.SecurityService.makeAuthenticatedRequest('GET', `${process.env.BACKEND_URL}/api/purchases/token/${purchaseToken}`);
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
            }
            else {
                await this.deliverTelegramFile(chatId, purchase);
            }
        }
        catch (error) {
            console.error('Error delivering content:', error);
        }
    }
    async deliverSiteAccess(chatId, purchase) {
        try {
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
            }
            else {
                await this.bot.sendMessage(chatId, message, {
                    parse_mode: 'Markdown',
                    reply_markup: keyboard
                });
            }
        }
        catch (error) {
            console.error('Error delivering site access:', error);
            await this.bot.sendMessage(chatId, '❌ Erro ao gerar link de acesso. Tente novamente mais tarde.');
        }
    }
    async generateSignedWatchUrl(purchase) {
        try {
            const response = await security_service_1.SecurityService.makeAuthenticatedRequest('POST', `${process.env.BACKEND_URL}/api/content/signed-url`, {
                purchase_id: purchase.id,
                content_id: purchase.content.id,
                expires_in: 24 * 60 * 60
            });
            return response.signed_url;
        }
        catch (error) {
            console.error('Error generating signed URL:', error);
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
            return `${frontendUrl}/watch/${purchase.content.id}?token=${purchase.access_token}`;
        }
    }
    async deliverTelegramFile(chatId, purchase) {
        try {
            const message = `✅ **Compra confirmada!**

🎥 **${purchase.content.title}**
💰 Valor: R$ ${(purchase.amount_cents / 100).toFixed(2)}

📁 **Download via Telegram:**
Preparando arquivo... Por favor, aguarde.

🎆 Bom filme!`;
            await this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
            try {
                const downloadUrl = await this.generatePresignedDownloadUrl(purchase);
                await this.sendDownloadLink(chatId, purchase, downloadUrl);
                return;
            }
            catch (error) {
                console.log('Presigned URL not available, trying other methods...');
            }
            if (purchase.content.storage_path && fs_1.default.existsSync(purchase.content.storage_path)) {
                await this.sendLocalFile(chatId, purchase);
            }
            else if (purchase.content.video_url) {
                await this.sendFileFromUrl(chatId, purchase);
            }
            else {
                await this.bot.sendMessage(chatId, `❌ **Arquivo temporariamente indisponível**

O arquivo do filme ainda está sendo processado. Você receberá o download em breve.

Enquanto isso, você pode assistir online através do nosso site.`, {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🎬 Assistir Online', callback_data: `watch_${purchase.id}` }]
                        ]
                    }
                });
            }
        }
        catch (error) {
            console.error('Error sending file via Telegram:', error);
            await this.bot.sendMessage(chatId, `❌ **Erro no envio do arquivo**

Houve um problema ao enviar o arquivo. Nossa equipe foi notificada e resolverá em breve.

Enquanto isso, você pode assistir online através do nosso site.`, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🎬 Assistir Online', callback_data: `watch_${purchase.id}` }]
                    ]
                }
            });
        }
    }
    async generatePresignedDownloadUrl(purchase) {
        try {
            const response = await security_service_1.SecurityService.makeAuthenticatedRequest('POST', `${process.env.BACKEND_URL}/api/content/presigned-download`, {
                purchase_id: purchase.id,
                content_id: purchase.content.id,
                expires_in: 24 * 60 * 60
            });
            return response.download_url;
        }
        catch (error) {
            console.error('Error generating presigned download URL:', error);
            throw error;
        }
    }
    async sendDownloadLink(chatId, purchase, downloadUrl) {
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
    async sendLocalFile(chatId, purchase) {
        const filePath = purchase.content.storage_path;
        const fileName = path_1.default.basename(filePath);
        const stats = fs_1.default.statSync(filePath);
        const fileSizeMB = stats.size / (1024 * 1024);
        if (fileSizeMB > 50) {
            await this.bot.sendMessage(chatId, `📁 **Arquivo muito grande para envio direto**

O filme "${purchase.content.title}" (${fileSizeMB.toFixed(1)}MB) excede o limite do Telegram.

**Opções disponíveis:**
• Assistir online no site
• Baixar diretamente pelo link que será enviado em breve`);
            return;
        }
        await this.bot.sendDocument(chatId, filePath, {
            caption: `🎥 ${purchase.content.title}\n\n✅ Download concluído!`
        });
    }
    async sendFileFromUrl(chatId, purchase) {
        try {
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
        }
        catch (error) {
            console.error('Error providing download link:', error);
            throw error;
        }
    }
    static async onPaymentConfirmed(bot, purchaseToken) {
        const deliveryService = new ContentDeliveryService(bot);
        await deliveryService.deliverPurchasedContent(purchaseToken);
    }
}
exports.ContentDeliveryService = ContentDeliveryService;
//# sourceMappingURL=content-delivery.service.js.map