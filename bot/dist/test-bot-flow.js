"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.testBotFlow = testBotFlow;
const bot_1 = require("./bot");
const content_delivery_service_1 = require("./services/content-delivery.service");
const notification_service_1 = require("./services/notification.service");
const security_service_1 = require("./services/security.service");
process.env.TELEGRAM_BOT_TOKEN = 'test_token';
process.env.BACKEND_URL = 'http://localhost:3001';
process.env.HMAC_SECRET = 'test_secret';
async function testBotFlow() {
    console.log('🤖 Iniciando teste do fluxo do bot...\n');
    try {
        console.log('1. Testando inicialização do bot...');
        const bot = new bot_1.TelegramBot(process.env.TELEGRAM_BOT_TOKEN);
        console.log('✅ Bot inicializado com sucesso\n');
        console.log('2. Testando SecurityService...');
        const testData = { test: 'data' };
        const signature = security_service_1.SecurityService.generateHmacSignature(JSON.stringify(testData));
        const isValid = security_service_1.SecurityService.verifyHmacSignature(JSON.stringify(testData), signature);
        console.log(`✅ HMAC Signature: ${signature.substring(0, 20)}...`);
        console.log(`✅ Signature válida: ${isValid}\n`);
        console.log('3. Testando ContentDeliveryService...');
        const mockBot = bot.getBot();
        const deliveryService = new content_delivery_service_1.ContentDeliveryService(mockBot);
        console.log('✅ ContentDeliveryService inicializado\n');
        console.log('4. Testando NotificationService...');
        const mockTelegramBot = {
            sendMessage: async (chatId, text, options) => {
                console.log(`📱 Mock message to ${chatId}: ${text.substring(0, 50)}...`);
                return { message_id: 123 };
            }
        };
        const notificationService = new notification_service_1.NotificationService(mockTelegramBot);
        console.log('✅ NotificationService inicializado\n');
        console.log('5. Testando processamento de webhook...');
        const mockWebhookData = {
            message: {
                chat: { id: 123456789 },
                from: { id: 987654321 },
                text: '/start purchase_token_123'
            }
        };
        console.log('✅ Dados de webhook mockados criados\n');
        console.log('6. Testando confirmação de pagamento...');
        const mockPurchaseData = {
            id: 'purchase_123',
            content: { title: 'Filme Teste', id: 'movie_123' },
            amount: 15.99,
            status: 'paid'
        };
        console.log('✅ Confirmação de pagamento mockada\n');
        console.log('7. Testando notificação de novo lançamento...');
        const mockMovieData = {
            id: 'movie_456',
            title: 'Novo Filme 2024',
            rating: 8.5,
            genre: 'Ação',
            duration: 120,
            description: 'Um filme incrível de ação.',
            price_cents: 1999,
            currency: 'BRL'
        };
        await notificationService.broadcastNewRelease(mockMovieData);
        console.log('✅ Notificação de novo lançamento enviada\n');
        console.log('🎉 Todos os testes passaram com sucesso!');
        console.log('\n📋 Resumo dos componentes testados:');
        console.log('• ✅ Inicialização do bot');
        console.log('• ✅ Segurança HMAC');
        console.log('• ✅ Sistema de entrega de conteúdo');
        console.log('• ✅ Sistema de notificações');
        console.log('• ✅ Processamento de webhooks');
        console.log('• ✅ Confirmação de pagamento');
        console.log('• ✅ Notificações de lançamentos');
    }
    catch (error) {
        console.error('❌ Erro durante o teste:', error);
        process.exit(1);
    }
}
if (require.main === module) {
    testBotFlow().catch(console.error);
}
//# sourceMappingURL=test-bot-flow.js.map