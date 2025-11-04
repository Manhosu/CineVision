/**
 * Detailed PIX test - checks exactly what's wrong
 */

const axios = require('axios');

const ACCESS_TOKEN = 'APP_USR-2790127687766077-110215-00693d48ca03833b472196039192a2eb-452973387';

async function detailedTest() {
  console.log('\n🔍 TESTE DETALHADO DE PIX\n');
  console.log('='.repeat(60));

  try {
    // 1. Check account
    console.log('\n1️⃣ Verificando conta...');
    const account = await axios.get('https://api.mercadopago.com/users/me', {
      headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` }
    });

    console.log(`   ✅ Email: ${account.data.email}`);
    console.log(`   ✅ ID: ${account.data.id}`);
    console.log(`   ✅ País: ${account.data.site_id}`);
    console.log(`   ℹ️  Status: ${account.data.status || 'N/A'}`);

    // Check if seller account
    if (account.data.user_type) {
      console.log(`   ℹ️  Tipo de conta: ${account.data.user_type}`);
    }

    // 2. Check payment methods
    console.log('\n2️⃣ Verificando métodos de pagamento disponíveis...');
    const methods = await axios.get('https://api.mercadopago.com/v1/payment_methods', {
      headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` }
    });

    console.log(`   ℹ️  Total de métodos: ${methods.data.length}`);

    const pixMethod = methods.data.find(m => m.id === 'pix');

    if (pixMethod) {
      console.log(`   ✅ PIX encontrado!`);
      console.log(`      Status: ${pixMethod.status}`);
      console.log(`      Nome: ${pixMethod.name}`);
      console.log(`      Tipo: ${pixMethod.payment_type_id}`);
    } else {
      console.log(`   ❌ PIX NÃO encontrado nos métodos de pagamento`);
      console.log(`   ℹ️  Métodos disponíveis:`);
      methods.data.slice(0, 5).forEach(m => {
        console.log(`      - ${m.id} (${m.name})`);
      });
    }

    // 3. Try to get account preferences for PIX
    console.log('\n3️⃣ Testando criação de pagamento PIX...');

    const testPayment = {
      transaction_amount: 1.00, // R$ 1.00
      description: 'Teste PIX - CineVision',
      payment_method_id: 'pix',
      payer: {
        email: 'teste@cinevision.com',
        first_name: 'Teste',
        last_name: 'Cliente',
      }
    };

    try {
      const payment = await axios.post(
        'https://api.mercadopago.com/v1/payments',
        testPayment,
        {
          headers: {
            'Authorization': `Bearer ${ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
            'X-Idempotency-Key': `test-${Date.now()}`,
          }
        }
      );

      console.log(`   ✅ Pagamento criado: ${payment.data.id}`);
      console.log(`   ✅ Status: ${payment.data.status}`);

      if (payment.data.point_of_interaction?.transaction_data?.qr_code) {
        console.log(`   ✅ QR Code gerado!`);
        console.log(`   ✅ Código PIX: ${payment.data.point_of_interaction.transaction_data.qr_code.substring(0, 50)}...`);

        console.log('\n' + '='.repeat(60));
        console.log('🎉 SUCESSO! PIX ESTÁ FUNCIONANDO PERFEITAMENTE!');
        console.log('='.repeat(60));
        console.log('\n✅ Sistema PRONTO para receber pagamentos PIX em produção!\n');

        // Try to cancel test payment
        try {
          await axios.put(
            `https://api.mercadopago.com/v1/payments/${payment.data.id}`,
            { status: 'cancelled' },
            { headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` } }
          );
          console.log('✅ Pagamento de teste cancelado\n');
        } catch (e) {
          console.log('ℹ️  Pagamento de teste expira automaticamente\n');
        }

      } else {
        console.log(`   ❌ QR Code NÃO foi gerado`);
        console.log(`   ❌ Resposta do pagamento:`, JSON.stringify(payment.data, null, 2));
      }

    } catch (paymentError) {
      console.log(`   ❌ Erro ao criar pagamento PIX`);

      const status = paymentError.response?.status;
      const message = paymentError.response?.data?.message || paymentError.message;
      const cause = paymentError.response?.data?.cause;

      console.log(`\n   Status HTTP: ${status}`);
      console.log(`   Mensagem: ${message}`);

      if (cause && cause.length > 0) {
        console.log(`   Causa:`);
        cause.forEach(c => {
          console.log(`      - ${c.code}: ${c.description}`);
        });
      }

      console.log('\n' + '='.repeat(60));
      console.log('❌ DIAGNÓSTICO DO PROBLEMA:');
      console.log('='.repeat(60));

      if (message?.includes('without key enabled') || message?.includes('QR render')) {
        console.log('\n🔴 PROBLEMA: PIX não está totalmente configurado\n');
        console.log('POSSÍVEIS CAUSAS:');
        console.log('1. Chave PIX criada mas não ATIVADA para recebimentos');
        console.log('2. Conta não é de VENDEDOR (apenas pessoal)');
        console.log('3. Conta precisa de aprovação do Mercado Pago');
        console.log('\nSOLUÇÕES:');
        console.log('A) No app Mercado Pago:');
        console.log('   - Vá em "Seu negócio" ou "Vender"');
        console.log('   - Ative o modo VENDEDOR');
        console.log('   - Complete dados comerciais se solicitado');
        console.log('\nB) Verifique se sua chave PIX está:');
        console.log('   - Status: ATIVA (não pendente)');
        console.log('   - Habilitada para recebimentos comerciais');
        console.log('\nC) Entre em contato com suporte Mercado Pago:');
        console.log('   - Chat no app (canto inferior direito)');
        console.log('   - https://www.mercadopago.com.br/developers/pt/support\n');

      } else if (status === 401 || status === 403) {
        console.log('\n🔴 PROBLEMA: Token de acesso inválido ou sem permissões\n');
        console.log('SOLUÇÃO: Gere novo token em:');
        console.log('https://www.mercadopago.com.br/developers/panel/app\n');

      } else if (message?.includes('Idempotency')) {
        console.log('\n🟡 Erro de idempotência - tente novamente em 1 minuto\n');

      } else {
        console.log('\n🔴 PROBLEMA: Erro desconhecido\n');
        console.log('Entre em contato com suporte do Mercado Pago:');
        console.log('https://www.mercadopago.com.br/developers/pt/support\n');
        console.log('Mostre esta mensagem de erro:\n');
        console.log(JSON.stringify(paymentError.response?.data, null, 2));
        console.log('');
      }
    }

  } catch (error) {
    console.log('\n❌ ERRO GERAL:', error.message);
    if (error.response?.data) {
      console.log('Detalhes:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

detailedTest();
