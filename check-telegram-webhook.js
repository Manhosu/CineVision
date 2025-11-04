const axios = require('axios');

/**
 * Script para verificar status do webhook do Telegram
 * Executa: node check-telegram-webhook.js
 */

// Pegar o token do bot das variáveis de ambiente ou usar o valor direto
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || 'seu_token_aqui';

async function checkWebhook() {
  try {
    console.log('🔍 Verificando status do webhook do Telegram...');
    console.log('');

    const response = await axios.get(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo`);

    const webhookInfo = response.data.result;

    console.log('📊 STATUS DO WEBHOOK:');
    console.log('═'.repeat(60));
    console.log(`URL configurada: ${webhookInfo.url || '(nenhuma)'}`);
    console.log(`Testado em: ${webhookInfo.last_error_date ? new Date(webhookInfo.last_error_date * 1000).toLocaleString() : 'Nunca'}`);
    console.log(`Último erro: ${webhookInfo.last_error_message || 'Nenhum'}`);
    console.log(`Updates pendentes: ${webhookInfo.pending_update_count || 0}`);
    console.log(`Máximo de conexões: ${webhookInfo.max_connections || 40}`);
    console.log(`Tipos permitidos: ${webhookInfo.allowed_updates ? webhookInfo.allowed_updates.join(', ') : 'todos'}`);
    console.log('═'.repeat(60));
    console.log('');

    if (webhookInfo.url && webhookInfo.url.includes('cinevisionn.onrender.com')) {
      console.log('✅ WEBHOOK CONFIGURADO CORRETAMENTE!');
      console.log('');

      if (webhookInfo.last_error_message) {
        console.log('⚠️  Mas há um erro recente:');
        console.log(`   ${webhookInfo.last_error_message}`);
        console.log('');
      } else {
        console.log('✅ Nenhum erro detectado');
        console.log('✅ Bot pronto para receber mensagens!');
        console.log('');
        console.log('📱 Teste agora enviando /start para o bot no Telegram');
      }

      if (webhookInfo.pending_update_count > 0) {
        console.log('');
        console.log(`ℹ️  Há ${webhookInfo.pending_update_count} mensagens pendentes de processamento`);
        console.log('   (Essas são mensagens enviadas enquanto o webhook não estava configurado)');
      }
    } else {
      console.log('❌ WEBHOOK NÃO CONFIGURADO ou URL incorreta');
      console.log('');
      console.log('Execute: node setup-telegram-webhook.js');
    }

  } catch (error) {
    console.error('❌ ERRO ao verificar webhook:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Dados:', error.response.data);
    } else {
      console.error('Erro:', error.message);
    }
    process.exit(1);
  }
}

// Executar
checkWebhook();
