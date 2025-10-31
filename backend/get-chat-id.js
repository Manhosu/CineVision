/**
 * Script para obter o Chat ID de grupos do Telegram
 * Útil para descobrir o Chat ID de grupos onde o bot é membro
 *
 * Run: node get-chat-id.js
 */

require('dotenv').config();
const axios = require('axios');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const botApiUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

async function getChatIds() {
  console.log('🔍 Buscando atualizações recentes do bot...\n');

  try {
    // Buscar últimas atualizações
    const response = await axios.get(`${botApiUrl}/getUpdates`);

    if (!response.data.ok) {
      console.error('❌ Erro ao buscar atualizações:', response.data.description);
      return;
    }

    const updates = response.data.result;

    if (updates.length === 0) {
      console.log('⚠️  Nenhuma atualização recente encontrada.');
      console.log('\n💡 Dica: Envie uma mensagem no grupo (ex: /start) e execute este script novamente.\n');
      return;
    }

    console.log(`✅ Encontradas ${updates.length} atualizações recentes:\n`);

    // Mapear chats únicos
    const chats = new Map();

    updates.forEach(update => {
      let chat = null;

      if (update.message) {
        chat = update.message.chat;
      } else if (update.channel_post) {
        chat = update.channel_post.chat;
      } else if (update.my_chat_member) {
        chat = update.my_chat_member.chat;
      }

      if (chat) {
        chats.set(chat.id, chat);
      }
    });

    // Exibir todos os chats encontrados
    console.log('📋 Chats/Grupos encontrados:\n');

    chats.forEach((chat, chatId) => {
      console.log('━'.repeat(60));
      console.log(`Chat ID: ${chatId}`);
      console.log(`Tipo: ${chat.type}`);
      console.log(`Título: ${chat.title || chat.first_name || 'N/A'}`);
      if (chat.username) {
        console.log(`Username: @${chat.username}`);
        console.log(`Link público: https://t.me/${chat.username}`);
      }
      console.log('');

      // Se for um grupo, mostrar como usar
      if (chat.type === 'group' || chat.type === 'supergroup') {
        console.log('✅ Para usar este grupo no sistema:');
        console.log(`   1. Copie o Chat ID: ${chatId}`);
        console.log(`   2. Cole no campo "Link do Grupo do Telegram" ao criar conteúdo`);
        console.log(`   3. Ou use o link público se houver: ${chat.username ? `https://t.me/${chat.username}` : 'N/A'}`);
        console.log('');
        console.log('⚠️  IMPORTANTE: O bot DEVE ser admin deste grupo com permissão de "Convidar usuários"');
      }
    });

    console.log('━'.repeat(60));
    console.log('\n💡 Dicas:');
    console.log('   • Se não encontrou seu grupo, envie uma mensagem nele e execute novamente');
    console.log('   • Chat ID negativo = grupo/canal');
    console.log('   • Chat ID positivo = usuário individual');
    console.log('   • Para limpar histórico: /deleteWebhook no BotFather\n');

  } catch (error) {
    console.error('❌ Erro ao buscar Chat IDs:', error.message);
    if (error.response) {
      console.error('Detalhes:', error.response.data);
    }
  }
}

// Verificar se bot token está configurado
if (!TELEGRAM_BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN não encontrado no .env');
  console.log('\n💡 Configure o token no arquivo .env:');
  console.log('   TELEGRAM_BOT_TOKEN=seu_token_aqui\n');
  process.exit(1);
}

getChatIds().catch(console.error);
