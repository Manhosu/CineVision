const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkPurchases() {
  console.log('🔍 Checking purchases status...\n');

  // Get all recent purchases
  const { data: purchases, error } = await supabase
    .from('purchases')
    .select('id, status, payment_method, payment_provider_id, amount_cents, created_at')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('❌ Error fetching purchases:', error.message);
    return;
  }

  console.log(`Found ${purchases.length} recent purchases:\n`);

  // Group by status
  const statusCount = {};
  const paymentMethodCount = {};

  purchases.forEach((p, index) => {
    console.log(`${index + 1}. Purchase ${p.id}`);
    console.log(`   Status: ${p.status}`);
    console.log(`   Payment Method: ${p.payment_method || 'null'}`);
    console.log(`   Payment Provider ID: ${p.payment_provider_id || 'null'}`);
    console.log(`   Amount: R$ ${(p.amount_cents / 100).toFixed(2)}`);
    console.log(`   Created: ${new Date(p.created_at).toLocaleString('pt-BR')}`);
    console.log('');

    statusCount[p.status] = (statusCount[p.status] || 0) + 1;
    paymentMethodCount[p.payment_method || 'null'] = (paymentMethodCount[p.payment_method || 'null'] || 0) + 1;
  });

  console.log('\n📊 Status Summary:');
  Object.entries(statusCount).forEach(([status, count]) => {
    console.log(`   ${status}: ${count}`);
  });

  console.log('\n💳 Payment Method Summary:');
  Object.entries(paymentMethodCount).forEach(([method, count]) => {
    console.log(`   ${method}: ${count}`);
  });

  // Check for purchases without payment_provider_id
  const withoutProviderId = purchases.filter(p => !p.payment_provider_id);
  if (withoutProviderId.length > 0) {
    console.log(`\n⚠️  ${withoutProviderId.length} purchases without payment_provider_id`);
  }

  // Check payments table
  console.log('\n🔍 Checking payments table...\n');
  const { data: payments, error: paymentsError } = await supabase
    .from('payments')
    .select('id, status, provider, provider_payment_id, purchase_id')
    .order('created_at', { ascending: false })
    .limit(20);

  if (paymentsError) {
    console.error('❌ Error fetching payments:', paymentsError.message);
    return;
  }

  console.log(`Found ${payments.length} recent payments:\n`);

  const paymentStatusCount = {};
  payments.forEach((p, index) => {
    console.log(`${index + 1}. Payment ${p.id}`);
    console.log(`   Status: ${p.status}`);
    console.log(`   Provider: ${p.provider}`);
    console.log(`   Provider Payment ID: ${p.provider_payment_id || 'null'}`);
    console.log(`   Purchase ID: ${p.purchase_id}`);
    console.log('');

    paymentStatusCount[p.status] = (paymentStatusCount[p.status] || 0) + 1;
  });

  console.log('\n📊 Payment Status Summary:');
  Object.entries(paymentStatusCount).forEach(([status, count]) => {
    console.log(`   ${status}: ${count}`);
  });
}

checkPurchases().catch(console.error);
