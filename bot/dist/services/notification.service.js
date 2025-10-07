"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = void 0;
const security_service_1 = require("./security.service");
class NotificationService {
    constructor(bot) {
        this.bot = bot;
    }
    async sendPaymentConfirmation(telegramId, purchaseToken) {
        try {
            const message = `✅ **Pagamento Confirmado!**

Seu pagamento foi processado com sucesso. 
Você receberá o link para assistir em instantes.

🎬 Use /minhas-compras para ver todos os seus filmes.`;
            await this.bot.sendMessage(telegramId, message, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🎬 Minhas Compras', callback_data: 'my_purchases' }]
                    ]
                }
            });
        }
        catch (error) {
            console.error('Error sending payment confirmation:', error);
        }
    }
    async broadcastNewRelease(movie) {
        try {
            const users = await this.getSubscribedUsers('new_releases');
            const message = `🎬 **Novo Lançamento!**

🎥 **${movie.title}**
${movie.description ? `\n📝 ${movie.description.substring(0, 200)}${movie.description.length > 200 ? '...' : ''}` : ''}
${movie.genre ? `\n🎭 Gênero: ${movie.genre}` : ''}
${movie.release_year ? `\n📅 Ano: ${movie.release_year}` : ''}

💰 **Preço: R$ ${(movie.price_cents / 100).toFixed(2)}**

🛒 Clique no botão abaixo para comprar!`;
            const keyboard = {
                inline_keyboard: [
                    [
                        { text: '🛒 Comprar Agora', callback_data: `buy_${movie.id}` }
                    ],
                    [
                        { text: '🎬 Ver Catálogo', callback_data: 'catalog_page_1' },
                        { text: '🔕 Desativar Notificações', callback_data: 'disable_notifications' }
                    ]
                ]
            };
            const promises = users.map(user => this.sendNewReleaseToUser(user, message, keyboard, movie.poster_url));
            await Promise.allSettled(promises);
            console.log(`New release broadcast sent to ${users.length} users for movie: ${movie.title}`);
        }
        catch (error) {
            console.error('Error broadcasting new release:', error);
        }
    }
    async sendNewReleaseToUser(user, message, keyboard, posterUrl) {
        try {
            if (posterUrl) {
                await this.bot.sendPhoto(user.telegram_id, posterUrl, {
                    caption: message,
                    parse_mode: 'Markdown',
                    reply_markup: keyboard
                });
            }
            else {
                await this.bot.sendMessage(user.telegram_id, message, {
                    parse_mode: 'Markdown',
                    reply_markup: keyboard
                });
            }
        }
        catch (error) {
            console.error(`Error sending new release to user ${user.telegram_id}:`, error);
            if (error.response?.statusCode === 403 || error.response?.statusCode === 400) {
                await this.markUserAsInactive(user.id);
            }
        }
    }
    async broadcastPromotion(title, description, discountPercent, validUntil) {
        try {
            const users = await this.getSubscribedUsers('promotions');
            let message = `🎉 **${title}**\n\n${description}`;
            if (discountPercent) {
                message += `\n\n💸 **${discountPercent}% de desconto!**`;
            }
            if (validUntil) {
                message += `\n⏰ **Válido até:** ${validUntil.toLocaleDateString('pt-BR')}`;
            }
            const keyboard = {
                inline_keyboard: [
                    [
                        { text: '🎬 Ver Catálogo', callback_data: 'catalog_page_1' }
                    ],
                    [
                        { text: '🔕 Desativar Promoções', callback_data: 'disable_promotions' }
                    ]
                ]
            };
            const promises = users.map(user => this.bot.sendMessage(user.telegram_id, message, {
                parse_mode: 'Markdown',
                reply_markup: keyboard
            }).catch(error => {
                console.error(`Error sending promotion to user ${user.telegram_id}:`, error);
                if (error.response?.statusCode === 403 || error.response?.statusCode === 400) {
                    this.markUserAsInactive(user.id);
                }
            }));
            await Promise.allSettled(promises);
            console.log(`Promotion broadcast sent to ${users.length} users: ${title}`);
        }
        catch (error) {
            console.error('Error broadcasting promotion:', error);
        }
    }
    async getSubscribedUsers(notificationType) {
        try {
            const users = await security_service_1.SecurityService.makeAuthenticatedRequest('GET', `${process.env.BACKEND_URL}/api/users/subscribed/${notificationType}`);
            return users || [];
        }
        catch (error) {
            console.error(`Error fetching subscribed users for ${notificationType}:`, error);
            return [];
        }
    }
    async markUserAsInactive(userId) {
        try {
            await security_service_1.SecurityService.makeAuthenticatedRequest('PUT', `${process.env.BACKEND_URL}/api/users/${userId}/inactive`, { reason: 'telegram_bot_blocked' });
        }
        catch (error) {
            console.error(`Error marking user ${userId} as inactive:`, error);
        }
    }
    async updateNotificationPreferences(telegramId, preferences) {
        try {
            await security_service_1.SecurityService.makeAuthenticatedRequest('PUT', `${process.env.BACKEND_URL}/api/users/telegram/${telegramId}/notifications`, preferences);
        }
        catch (error) {
            console.error('Error updating notification preferences:', error);
        }
    }
    async handleNotificationCallback(callbackQuery) {
        const chatId = callbackQuery.message?.chat.id;
        const telegramId = callbackQuery.from.id.toString();
        const data = callbackQuery.data;
        if (!chatId)
            return;
        try {
            switch (data) {
                case 'disable_notifications':
                    await this.updateNotificationPreferences(telegramId, { new_releases: false });
                    await this.bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: callbackQuery.message?.message_id });
                    await this.bot.sendMessage(chatId, '🔕 Notificações de novos lançamentos desativadas.');
                    break;
                case 'disable_promotions':
                    await this.updateNotificationPreferences(telegramId, { promotions: false });
                    await this.bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: callbackQuery.message?.message_id });
                    await this.bot.sendMessage(chatId, '🔕 Notificações de promoções desativadas.');
                    break;
                case 'enable_notifications':
                    await this.updateNotificationPreferences(telegramId, {
                        new_releases: true,
                        promotions: true
                    });
                    await this.bot.sendMessage(chatId, '🔔 Notificações ativadas! Você receberá avisos sobre novos filmes e promoções.');
                    break;
            }
            await this.bot.answerCallbackQuery(callbackQuery.id);
        }
        catch (error) {
            console.error('Error handling notification callback:', error);
            await this.bot.answerCallbackQuery(callbackQuery.id, {
                text: 'Erro ao atualizar preferências. Tente novamente.'
            });
        }
    }
}
exports.NotificationService = NotificationService;
//# sourceMappingURL=notification.service.js.map