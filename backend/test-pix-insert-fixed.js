require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testPixInsert() {
  console.log('🧪 Testando inserção PIX com schema CORRETO...\n');

  // Buscar um purchase com content válido
  const { data: purchase, error: purchaseError } = await supabase
    .from('purchases')
    .select('id, user_id, content_id, amount_cents, currency')
    .not('content_id', 'is', null)
    .limit(1)
    .single();

  if (purchaseError || !purchase) {
    console.error('❌ Erro ao buscar purchase:', purchaseError);
    return;
  }

  console.log('✅ Purchase encontrado:', purchase.id);
  console.log(`   - user_id: ${purchase.user_id || 'NULL'}`);
  console.log(`   - content_id: ${purchase.content_id}`);

  // Preparar user_id
  let paymentUserId = purchase.user_id;
  if (!paymentUserId) {
    paymentUserId = '00000000-0000-0000-0000-000000000000';
    console.log('⚠️  user_id é NULL, usando UUID padrão');
  }

  // Verificar se o content_id existe na tabela content
  const { data: content, error: contentError } = await supabase
    .from('content')
    .select('id, title')
    .eq('id', purchase.content_id)
    .single();

  if (contentError || !content) {
    console.error('❌ Content não encontrado:', contentError);
    return;
  }

  console.log(`✅ Content encontrado: "${content.title}"\n`);

  // Tentar inserir um payment com as colunas CORRETAS
  const testData = {
    user_id: paymentUserId,
    movie_id: purchase.content_id, // Agora aponta para content.id
    amount: (purchase.amount_cents / 100).toString(),
    currency: purchase.currency || 'BRL',
    payment_method: 'pix', // CORRETO
    payment_status: 'pending', // CORRETO
    stripe_payment_intent_id: 'test_' + Date.now(),
    provider_meta: {
      purchase_id: purchase.id,
      transaction_id: 'test_123',
      pix_key: '13175567983',
      qr_code_emv: 'test_qr_code',
      amount_cents: purchase.amount_cents,
      currency: purchase.currency || 'BRL',
      payment_method: 'pix',
    },
  };

  console.log('📤 Tentando inserir payment...');
  console.log('   Dados:', JSON.stringify(testData, null, 2), '\n');

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
