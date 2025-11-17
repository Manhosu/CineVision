const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkUpdatedToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data: purchases, error } = await supabase
    .from('purchases')
    .select('id, status, updated_at, amount_cents')
    .gte('updated_at', today.toISOString())
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  console.log(`\n📊 Purchases updated today: ${purchases.length}`);

  const statusCount = {};
  purchases.forEach(p => {
    statusCount[p.status] = (statusCount[p.status] || 0) + 1;
  });

  console.log('\nStatus breakdown:');
  Object.entries(statusCount).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`);
  });

  // Show recently paid ones
  const paid = purchases.filter(p => p.status === 'pago').slice(0, 10);
  console.log(`\n✅ Recently paid purchases (${paid.length}):`);
  paid.forEach(p => {
    console.log(`  - ${p.id}: R$ ${(p.amount_cents / 100).toFixed(2)} at ${new Date(p.updated_at).toLocaleString('pt-BR')}`);
  });
}

checkUpdatedToday().catch(console.error);
