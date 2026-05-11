const axios = require('axios');
require('dotenv').config();

/**
 * Script para enviar mensagem de confirmação de pagamento PIX
 * Executa: node enviar-confirmacao-pix.js
 */

async function enviarConfirmacao() {
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = '6543183277';
  const CONTENT_TITLE = 'Lilo & Stitch';
  const AMOUNT = 'R$ 6,98';
  const USER_ID = '8278c900-effd-40dd-b2bf-bcc6df0129e2';

  if (!TELEGRAM_BOT_TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN não encontrado no .env');
    process.exit(1);
  }

  // Gerar link de auto-login
  const DASHBOARD_URL = `https://cine-vision-murex.vercel.app/dashboard?userId=${USER_ID}`;

  const message = `🎉 *PAGAMENTO CONFIRMADO!*

✅ Seu pagamento PIX de ${AMOUNT} foi aprovado com sucesso!

🎬 *${CONTENT_TITLE}*

📺 *Como assistir:*
Clique no link abaixo para acessar o conteúdo:

${DASHBOARD_URL}

⚡ *Acesso liberado!*
Você já pode assistir agora mesmo.

Obrigado pela compra! 🍿`;

  try {
    console.log('📤 Enviando mensagem de confirmação...\n');
    console.log(`👤 Chat ID: ${CHAT_ID}`);
    console.log(`🎬 Conteúdo: ${CONTENT_TITLE}`);
    console.log(`💰 Valor: ${AMOUNT}\n`);

    const response = await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        chat_id: CHAT_ID,
        text: message,
        parse_mode: 'Markdown',
        disable_web_page_preview: false
      }
    );

    if (response.data.ok) {
      console.log('✅ Mensagem enviada com sucesso!');
      console.log(`📨 Message ID: ${response.data.result.message_id}`);
      console.log('\n✅ O comprador recebeu a confirmação de pagamento!\n');
    } else {
      console.error('❌ Erro ao enviar mensagem:', response.data);
    }
  } catch (error) {
    console.error('❌ Erro:', error.response?.data || error.message);
  }
}

enviarConfirmacao();
