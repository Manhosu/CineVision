const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkAllPago() {
  const { data: purchases, error } = await supabase
    .from('purchases')
    .select('id, status, payment_method, payment_provider_id, amount_cents, created_at')
    .eq('status', 'pago')
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  console.log(`\n✅ Total purchases with status='pago': ${purchases.length}`);

  purchases.forEach((p, index) => {
    console.log(`\n${index + 1}. Purchase ${p.id}`);
    console.log(`   Payment Method: ${p.payment_method || 'null'}`);
    console.log(`   Payment Provider ID: ${p.payment_provider_id || 'null'}`);
    console.log(`   Amount: R$ ${(p.amount_cents / 100).toFixed(2)}`);
    console.log(`   Created: ${new Date(p.created_at).toLocaleString('pt-BR')}`);
  });
}

checkAllPago().catch(console.error);
