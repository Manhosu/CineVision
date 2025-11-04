/**
 * Verify Mercado Pago PIX is ready
 * Run this AFTER activating PIX in your Mercado Pago account
 *
 * Usage: node verify-mercadopago-pix.js
 */

const axios = require('axios');

const ACCESS_TOKEN = 'APP_USR-2790127687766077-110215-00693d48ca03833b472196039192a2eb-452973387';

async function verifyPixSetup() {
  console.log('\n🔍 Verificando configuração PIX do Mercado Pago...\n');

  try {
    // Step 1: Check account
    console.log('1️⃣ Verificando conta...');
    const account = await axios.get('https://api.mercadopago.com/users/me', {
      headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` }
    });

    console.log(`   ✅ Conta: ${account.data.email}`);
    console.log(`   ✅ ID: ${account.data.id}`);
    console.log(`   ✅ Tipo: ${account.data.site_id}\n`);

    // Step 2: Check payment methods
    console.log('2️⃣ Verificando se PIX está disponível...');
    const methods = await axios.get('https://api.mercadopago.com/v1/payment_methods', {
      headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` }
    });

    const hasPix = methods.data.some(m => m.id === 'pix');

    if (hasPix) {
      console.log('   ✅ PIX está disponível!\n');
    } else {
      console.log('   ❌ PIX ainda NÃO está disponível');
      console.log('   ⚠️  Ative PIX em: https://www.mercadopago.com.br/\n');
      return;
    }

    // Step 3: Try to create a test PIX payment
    console.log('3️⃣ Testando criação de pagamento PIX...');

    const testPayment = {
      transaction_amount: 0.50, // R$ 0.50
      description: 'Teste PIX - CineVision',
      payment_method_id: 'pix',
      payer: {
        email: 'teste@cinevision.com',
        first_name: 'Cliente',
        last_name: 'Teste',
      }
    };

    const payment = await axios.post(
      'https://api.mercadopago.com/v1/payments',
      testPayment,
      {
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': `test-${Date.now()}`, // Required by Mercado Pago
        }
      }
    );

    console.log(`   ✅ Pagamento criado: ${payment.data.id}`);
    console.log(`   ✅ Status: ${payment.data.status}`);

    // Step 4: Check QR Code
    console.log('\n4️⃣ Verificando geração de QR Code...');

    const qrCode = payment.data.point_of_interaction?.transaction_data?.qr_code;
    const qrCodeBase64 = payment.data.point_of_interaction?.transaction_data?.qr_code_base64;

    if (qrCode && qrCodeBase64) {
      console.log('   ✅ QR Code gerado com sucesso!');
      console.log(`   ✅ Código PIX: ${qrCode.substring(0, 50)}...`);
      console.log('\n═══════════════════════════════════════════════════');
      console.log('🎉 SUCESSO! Mercado Pago PIX está FUNCIONANDO! 🎉');
      console.log('═══════════════════════════════════════════════════\n');
      console.log('✅ Sistema pronto para produção!');
      console.log('✅ Usuários já podem fazer pagamentos PIX\n');

      // Cancel test payment
      console.log('5️⃣ Cancelando pagamento de teste...');
      try {
        await axios.put(
          `https://api.mercadopago.com/v1/payments/${payment.data.id}`,
          { status: 'cancelled' },
          {
            headers: {
              'Authorization': `Bearer ${ACCESS_TOKEN}`,
              'Content-Type': 'application/json',
            }
          }
        );
        console.log('   ✅ Pagamento de teste cancelado\n');
      } catch (e) {
        console.log('   ⚠️  Não foi possível cancelar (ignore isso)\n');
      }
    } else {
      console.log('   ❌ QR Code NÃO foi gerado');
      console.log('\n⚠️  PROBLEMA: PIX está ativo mas QR Code falhou\n');
      console.log('📝 Possíveis causas:');
      console.log('   1. Chave PIX não cadastrada');
      console.log('   2. Conta não é de vendedor');
      console.log('   3. Conta precisa de aprovação\n');
      console.log('📞 Contate o suporte: https://www.mercadopago.com.br/ajuda\n');
    }

  } catch (error) {
    console.log('\n❌ ERRO AO VERIFICAR:\n');

    const status = error.response?.status;
    const message = error.response?.data?.message || error.message;
    const cause = error.response?.data?.cause?.[0]?.description;

    console.log(`Status: ${status}`);
    console.log(`Mensagem: ${message}`);
    if (cause) console.log(`Causa: ${cause}`);

    console.log('\n📋 DIAGNÓSTICO:\n');

    if (message?.includes('without key enabled') || message?.includes('QR render')) {
      console.log('❌ PIX não está ativado na conta ou chave PIX não cadastrada\n');
      console.log('📝 COMO RESOLVER:\n');
      console.log('1. Acesse: https://www.mercadopago.com.br/');
      console.log('2. Login com: rafagomes2404@gmail.com');
      console.log('3. Vá em "Transferir" → "PIX"');
      console.log('4. Clique em "Criar chave PIX"');
      console.log('5. Escolha o tipo (CPF recomendado)');
      console.log('6. Aguarde aprovação (geralmente instantâneo)');
      console.log('7. Execute este script novamente\n');
    } else if (message?.includes('Idempotency')) {
      console.log('⚠️  Erro de idempotência - ignore e tente novamente\n');
    } else if (status === 401) {
      console.log('❌ Token de acesso inválido\n');
      console.log('📝 COMO RESOLVER:\n');
      console.log('1. Gere novos tokens em: https://www.mercadopago.com.br/developers/panel/app');
      console.log('2. Atualize MERCADO_PAGO_ACCESS_TOKEN no Render\n');
    } else {
      console.log('❌ Erro desconhecido - verifique detalhes acima\n');
      console.log('📞 Suporte Mercado Pago: https://www.mercadopago.com.br/developers/pt/support\n');
    }
  }
}

verifyPixSetup();
