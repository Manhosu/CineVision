"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleHelpCallback = exports.showSupportMenu = exports.showFAQ = exports.showHelpMenu = exports.helpHandler = void 0;
const helpHandler = async (bot, msg) => {
    const chatId = msg.chat.id;
    await (0, exports.showHelpMenu)(bot, chatId);
};
exports.helpHandler = helpHandler;
const showHelpMenu = async (bot, chatId) => {
    const helpMessage = `🆘 **CENTRAL DE AJUDA**

🎬 **Como comprar:**
1️⃣ Envie /catalogo ou clique em "Ver Filmes"
2️⃣ Escolha um filme
3️⃣ Pague via PIX ou cartão
4️⃣ Receba aqui no Telegram!

📱 **Comandos úteis:**
/catalogo - Ver todos os filmes
/meus_filmes - Suas compras
/pedidos - Status dos pagamentos

💬 **Precisa de ajuda?**`;
    const keyboard = {
        inline_keyboard: [
            [
                { text: '💬 Falar com Suporte', callback_data: 'help_support' },
                { text: '❓ Perguntas Frequentes', callback_data: 'help_faq' }
            ],
            [
                { text: '🎬 Ver Catálogo', callback_data: 'catalog_menu' }
            ]
        ]
    };
    await bot.sendMessage(chatId, helpMessage, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
    });
};
exports.showHelpMenu = showHelpMenu;
const showFAQ = async (bot, chatId) => {
    const faqMessage = `❓ **PERGUNTAS FREQUENTES**

🎯 **Mais perguntadas:**

**🔹 Como baixar meu filme?**
Use /meus_filmes e clique em "Baixar"

**🔹 PIX não foi confirmado?**
Aguarde até 5 minutos. Se não chegar, fale conosco.

**🔹 Posso assistir offline?**
Sim! Filmes baixados funcionam sem internet.

**🔹 Quanto tempo tenho para assistir?**
Para sempre se baixar, 30 dias se for streaming.`;
    const keyboard = {
        inline_keyboard: [
            [
                { text: '💬 Não achei minha dúvida', callback_data: 'help_support' }
            ],
            [
                { text: '⬅️ Voltar', callback_data: 'help_menu' }
            ]
        ]
    };
    await bot.sendMessage(chatId, faqMessage, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
    });
};
exports.showFAQ = showFAQ;
const showSupportMenu = async (bot, chatId) => {
    const supportMessage = `💬 **SUPORTE CINE VISION**

🕐 **Horário de atendimento:**
Segunda a Sexta: 9h às 18h
Sábado: 9h às 14h

📞 **Como podemos ajudar?**`;
    const keyboard = {
        inline_keyboard: [
            [
                { text: '❓ Perguntas Frequentes', callback_data: 'help_faq' },
                { text: '💬 Chat ao Vivo', callback_data: 'help_live_chat' }
            ],
            [
                { text: '📞 Telefone', callback_data: 'help_phone' },
                { text: '📧 Email', callback_data: 'help_email' }
            ],
            [
                { text: '⬅️ Voltar', callback_data: 'help_menu' }
            ]
        ]
    };
    await bot.sendMessage(chatId, supportMessage, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
    });
};
exports.showSupportMenu = showSupportMenu;
const handleHelpCallback = async (bot, callbackQuery) => {
    const chatId = callbackQuery.message?.chat.id;
    const data = callbackQuery.data;
    if (!chatId || !data)
        return;
    try {
        switch (data) {
            case 'help_menu':
                await (0, exports.showHelpMenu)(bot, chatId);
                break;
            case 'help_faq':
                await (0, exports.showFAQ)(bot, chatId);
                break;
            case 'help_support':
                await (0, exports.showSupportMenu)(bot, chatId);
                break;
            case 'help_live_chat':
                await bot.sendMessage(chatId, `💬 **CHAT AO VIVO**

🔴 **Status:** Online

👨‍💻 **Atendimento humano**
Aguarde que um de nossos atendentes irá te responder em breve.

📝 **Descreva seu problema:**
Digite sua mensagem que nosso suporte receberá.`, {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: '⬅️ Voltar', callback_data: 'help_support' }
                            ]
                        ]
                    }
                });
                break;
            case 'help_phone':
                await bot.sendMessage(chatId, `📞 **TELEFONE**

📱 **(11) 9999-9999**

🕐 **Horários:**
Segunda a Sexta: 9h às 18h
Sábado: 9h às 14h

💡 **Dica:** Tenha em mãos seu nome e email cadastrado.`, {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: '⬅️ Voltar', callback_data: 'help_support' }
                            ]
                        ]
                    }
                });
                break;
            case 'help_email':
                await bot.sendMessage(chatId, `📧 **EMAIL**

✉️ **suporte@cinevision.com**

⏰ **Resposta em até 2 horas**

📝 **Ao enviar, inclua:**
• Seu nome completo
• Email cadastrado
• Descrição do problema`, {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: '⬅️ Voltar', callback_data: 'help_support' }
                            ]
                        ]
                    }
                });
                break;
        }
        await bot.answerCallbackQuery(callbackQuery.id);
    }
    catch (error) {
        console.error('Error handling help callback:', error);
        await bot.answerCallbackQuery(callbackQuery.id, {
            text: 'Erro temporário. Tente novamente.',
            show_alert: true
        });
    }
};
exports.handleHelpCallback = handleHelpCallback;
//# sourceMappingURL=help.handler.js.map