require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testPixInsert() {
  console.log('🧪 Testando inserção com provider_meta...\n');

  // Primeiro, buscar um purchase existente
  const { data: purchases, error: purchaseError } = await supabase
    .from('purchases')
    .select('id, amount_cents, currency')
    .limit(1)
    .single();

  if (purchaseError) {
    console.error('❌ Erro ao buscar purchase:', purchaseError);
    return;
  }

  console.log('✅ Purchase encontrado:', purchases.id);

  // Tentar inserir um payment com provider_meta
  const testData = {
    purchase_id: purchases.id,
    provider_payment_id: 'test_' + Date.now(),
    provider: 'pix',
    status: 'pending',
    provider_meta: {
      transaction_id: 'test_123',
      pix_key: '13175567983',
      qr_code_emv: 'test_qr_code',
      amount_cents: purchases.amount_cents,
      currency: purchases.currency,
      payment_method: 'pix',
    },
  };

  console.log('📤 Tentando inserir payment com provider_meta...');

  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .insert(testData)
    .select()
    .single();

  if (paymentError) {
    console.error('❌ Erro ao inserir payment:', paymentError);
    console.error('\n📋 Detalhes completos:', JSON.stringify(paymentError, null, 2));
  } else {
    console.log('✅ Payment inserido com sucesso!');
    console.log('📦 Payment criado:', payment);

    // Limpar o teste
    console.log('\n🧹 Removendo payment de teste...');
    await supabase.from('payments').delete().eq('id', payment.id);
    console.log('✅ Limpeza concluída!');
  }
}

testPixInsert().catch(console.error);
