const axios = require('axios');

/**
 * Script para configurar o webhook do Telegram
 * Executa: node setup-telegram-webhook.js
 */

const BACKEND_URL = 'https://cinevisionn.onrender.com';
const SETUP_WEBHOOK_URL = `${BACKEND_URL}/api/v1/telegrams/setup-webhook`;

async function setupWebhook() {
  try {
    console.log('🔧 Configurando webhook do Telegram...');
    console.log(`📍 Backend URL: ${BACKEND_URL}`);
    console.log(`📍 Webhook endpoint: ${SETUP_WEBHOOK_URL}`);
    console.log('');

    const response = await axios.get(SETUP_WEBHOOK_URL, {
      timeout: 30000
    });

    console.log('✅ Resposta do servidor:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');

    if (response.data && response.data.ok) {
      console.log('🎉 WEBHOOK CONFIGURADO COM SUCESSO!');
      console.log('');
      console.log('O bot agora deve responder aos comandos:');
      console.log('- /start');
      console.log('- /catalogo');
      console.log('- /meus_filmes');
      console.log('- etc.');
      console.log('');
      console.log('✅ Teste o bot no Telegram agora!');
    } else {
      console.error('❌ ERRO: Resposta inesperada do servidor');
      console.error(response.data);
    }

  } catch (error) {
    console.error('❌ ERRO ao configurar webhook:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Dados:', error.response.data);
    } else if (error.request) {
      console.error('Nenhuma resposta recebida do servidor');
      console.error('Verifique se o backend está rodando:', BACKEND_URL);
    } else {
      console.error('Erro:', error.message);
    }
    process.exit(1);
  }
}

// Executar
setupWebhook();
