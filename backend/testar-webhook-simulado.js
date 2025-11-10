const axios = require('axios');

async function testarWebhook() {
  console.log('🧪 Testando webhook com mensagem simulada de /start...\n');

  const webhookUrl = 'https://cinevisionn.onrender.com/api/v1/telegrams/webhook';

  // Simular uma mensagem do Telegram com o comando /start
  const fakeUpdate = {
    update_id: 123456789,
    message: {
      message_id: 1,
      from: {
        id: 999999999, // ID do usuário de teste
        is_bot: false,
        first_name: 'Test',
        username: 'testuser',
      },
      chat: {
        id: 999999999,
        first_name: 'Test',
        username: 'testuser',
        type: 'private',
      },
      date: Math.floor(Date.now() / 1000),
      text: '/start',
    },
  };

  try {
    console.log('📤 Enviando update simulado para:', webhookUrl);
    console.log('📦 Payload:', JSON.stringify(fakeUpdate, null, 2), '\n');

    const response = await axios.post(webhookUrl, fakeUpdate, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log('✅ Resposta do webhook:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('\nStatus:', response.status);

    if (response.data.status === 'processed') {
      console.log('\n✅ Webhook processou a mensagem com sucesso!');
      console.log('⚠️  IMPORTANTE: Verifique os logs do Render para ver se a mensagem foi enviada ao bot.');
      console.log('   O bot não enviará mensagem para o chat ID 999999999 (ID de teste).');
    }

  } catch (error) {
    console.error('❌ Erro ao testar webhook:', error.response?.data || error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Headers:', error.response.headers);
    }
  }
}

testarWebhook()
  .then(() => {
    console.log('\n✅ Teste concluído!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro:', error);
    process.exit(1);
  });
