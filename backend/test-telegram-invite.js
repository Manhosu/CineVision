/**
 * Script para testar criação de links de convite do Telegram
 * Run: node test-telegram-invite.js
 */

require('dotenv').config();
const axios = require('axios');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const botApiUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

async function testTelegramInviteCreation() {
  console.log('🧪 Testando criação de links de convite do Telegram\n');

  // Test Case 1: Verificar se o bot está online
  console.log('1️⃣  Verificando status do bot...');
  try {
    const response = await axios.get(`${botApiUrl}/getMe`);
    if (response.data.ok) {
      console.log(`✅ Bot conectado: @${response.data.result.username}`);
      console.log(`   Nome: ${response.data.result.first_name}`);
      console.log(`   ID: ${response.data.result.id}\n`);
    }
  } catch (error) {
    console.error('❌ Erro ao conectar com o bot:', error.message);
    process.exit(1);
  }

  // Test Case 2: Instruções para o admin
  console.log('2️⃣  Instruções para teste:\n');
  console.log('   Para testar a criação de links de convite, você precisa:');
  console.log('   a) Criar um grupo de teste no Telegram');
  console.log('   b) Adicionar o bot ao grupo');
  console.log('   c) Promover o bot a ADMIN com permissão de "Convidar usuários"\n');

  console.log('📋 Como adicionar o bot ao grupo:');
  console.log('   1. Abra o grupo no Telegram');
  console.log('   2. Clique em "Adicionar membros"');
  console.log(`   3. Procure por: @${process.env.TELEGRAM_BOT_USERNAME || 'seu_bot'}`);
  console.log('   4. Clique em "Administradores" → "Adicionar administrador"');
  console.log('   5. Selecione o bot e ative "Convidar usuários"\n');

  console.log('🔍 Como obter o Chat ID do grupo:');
  console.log('   Método 1 - Via API:');
  console.log('     1. Envie uma mensagem no grupo (ex: "/start")');
  console.log('     2. Execute: node get-chat-id.js');
  console.log('');
  console.log('   Método 2 - Via link:');
  console.log('     1. Se o grupo é PÚBLICO: https://t.me/nomegrupo');
  console.log('     2. Se o grupo é PRIVADO: Clique em "..." → "Convidar via link"\n');

  // Test Case 3: Exemplo de criação de link
  console.log('3️⃣  Exemplo de código para criar link de convite:\n');
  console.log('```javascript');
  console.log('const chatId = "-1001234567890"; // Substituir pelo ID real do grupo');
  console.log('const expireDate = Math.floor(Date.now() / 1000) + (24 * 60 * 60); // 24 horas');
  console.log('');
  console.log('const response = await axios.post(`${botApiUrl}/createChatInviteLink`, {');
  console.log('  chat_id: chatId,');
  console.log('  member_limit: 1,        // Link de uso único');
  console.log('  expire_date: expireDate, // Expira em 24 horas');
  console.log('  name: "Compra - Teste"   // Nome do link');
  console.log('});');
  console.log('');
  console.log('console.log("Link criado:", response.data.result.invite_link);');
  console.log('```\n');

  // Test Case 4: Verificar variáveis de ambiente
  console.log('4️⃣  Verificando variáveis de ambiente:');
  console.log(`   TELEGRAM_BOT_TOKEN: ${TELEGRAM_BOT_TOKEN ? '✅ Configurado' : '❌ Não encontrado'}`);
  console.log(`   TELEGRAM_BOT_USERNAME: ${process.env.TELEGRAM_BOT_USERNAME || '⚠️  Não configurado'}\n`);

  // Test Case 5: Métodos alternativos
  console.log('5️⃣  Métodos alternativos (caso o link de convite não funcione):\n');
  console.log('   Opção A - Aprovar solicitação de entrada:');
  console.log('   • Configure o grupo para "Aprovar novos membros"');
  console.log('   • Use o método approveChatJoinRequest quando usuário solicitar');
  console.log('');
  console.log('   Opção B - Link de convite permanente:');
  console.log('   • Crie um link sem member_limit');
  console.log('   • Envie o mesmo link para todos os compradores');
  console.log('   • Menos seguro, mas mais simples\n');

  console.log('📚 Documentação oficial:');
  console.log('   https://core.telegram.org/bots/api#createchatinvitelink\n');

  console.log('✅ Teste de configuração concluído!');
  console.log('\n💡 Próximos passos:');
  console.log('   1. Configure o grupo conforme instruções acima');
  console.log('   2. Teste criando um conteúdo com telegram_group_link no admin');
  console.log('   3. Faça uma compra teste e verifique se o link é criado');
  console.log('   4. Monitore os logs em system_logs (type=telegram_group)');
}

testTelegramInviteCreation().catch(console.error);
