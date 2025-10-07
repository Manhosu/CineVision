"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginHandler = void 0;
const loginHandler = async (bot, msg, match) => {
    const chatId = msg.chat.id;
    const token = match?.[1]?.trim();
    if (!token) {
        const loginMessage = `🔑 **Login no Cine Vision**

Para fazer login, você precisa de um token de acesso.

**Como obter o token:**
1. Acesse nosso site
2. Faça login na sua conta
3. Vá em "Integração Telegram"
4. Copie seu token
5. Use o comando: \`/login [seu_token]\`

**Exemplo:**
\`/login abc123def456\``;
        await bot.sendMessage(chatId, loginMessage, { parse_mode: 'Markdown' });
        return;
    }
    console.log(`Login attempt from chat ${chatId} with token: ${token.substring(0, 6)}...`);
    const successMessage = `✅ **Login realizado com sucesso!**

Sua conta foi vinculada a este chat do Telegram.

Agora você pode:
• Receber notificações de compras
• Acessar seus filmes diretamente
• Fazer download dos conteúdos

Use /purchases para ver suas compras!`;
    await bot.sendMessage(chatId, successMessage, { parse_mode: 'Markdown' });
};
exports.loginHandler = loginHandler;
//# sourceMappingURL=login.handler.js.map