const axios = require('axios');
require('dotenv').config();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function checkWebhookStatus() {
  console.log('🔍 Verificando status do webhook do Telegram...\n');

  if (!TELEGRAM_BOT_TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN não configurado no .env');
    return;
  }

  console.log(`🤖 Bot Token: ${TELEGRAM_BOT_TOKEN.substring(0, 10)}...${TELEGRAM_BOT_TOKEN.substring(TELEGRAM_BOT_TOKEN.length - 4)}\n`);

  try {
    // 1. Get webhook info
    const webhookUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo`;
    const response = await axios.get(webhookUrl);

    console.log('📡 Status do Webhook:\n');
    console.log(JSON.stringify(response.data.result, null, 2));
    console.log('');

    const webhookInfo = response.data.result;

    if (!webhookInfo.url || webhookInfo.url === '') {
      console.log('⚠️  WEBHOOK NÃO CONFIGURADO!');
      console.log('');
      console.log('Para configurar o webhook, execute:');
      console.log('');
      console.log('curl -X POST https://cinevisionn.onrender.com/api/v1/telegrams/setup-webhook');
      console.log('');
      console.log('Ou acesse no navegador:');
      console.log('https://cinevisionn.onrender.com/api/v1/telegrams/setup-webhook');
    } else {
      console.log('✅ Webhook está configurado!');
      console.log(`📍 URL: ${webhookInfo.url}`);
      console.log(`📊 Mensagens pendentes: ${webhookInfo.pending_update_count || 0}`);

      if (webhookInfo.last_error_date) {
        console.log(`❌ Último erro: ${new Date(webhookInfo.last_error_date * 1000).toLocaleString('pt-BR')}`);
        console.log(`   Mensagem: ${webhookInfo.last_error_message}`);
      }
    }

    // 2. Get bot info
    console.log('\n👤 Informações do Bot:\n');
    const botInfoUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe`;
    const botResponse = await axios.get(botInfoUrl);
    console.log(JSON.stringify(botResponse.data.result, null, 2));

  } catch (error) {
    console.error('❌ Erro ao verificar webhook:', error.response?.data || error.message);
  }
}

checkWebhookStatus()
  .then(() => {
    console.log('\n✅ Verificação concluída!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro:', error);
    process.exit(1);
  });
