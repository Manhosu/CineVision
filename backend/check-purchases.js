const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://szghyvnbmjlquznxhqum.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6Z2h5dm5ibWpscXV6bnhocXVtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODc0OTk5OSwiZXhwIjoyMDc0MzI1OTk5fQ.p9_G_CjLg8h2CVZqteKLdK9WUFKFdXSqTuTolHFiWGc';

const supabase = createClient(supabaseUrl, supabaseKey);

(async () => {
  console.log('🔍 Checking pending purchases...\n');

  const { data: purchases, error } = await supabase
    .from('purchases')
    .select('id, user_id, content_id, status, payment_method, payment_provider_id, amount_cents, created_at, provider_meta')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }

  console.log(`📦 Total pending purchases: ${purchases.length}\n`);

  if (purchases.length === 0) {
    console.log('✅ No pending purchases found!');
    process.exit(0);
  }

  purchases.forEach((purchase, index) => {
    console.log(`\n${index + 1}. Purchase ID: ${purchase.id}`);
    console.log(`   Status: ${purchase.status}`);
    console.log(`   Payment Method: ${purchase.payment_method || 'not set'}`);
    console.log(`   Provider ID: ${purchase.payment_provider_id || 'not set'}`);
    console.log(`   Amount: R$ ${(purchase.amount_cents / 100).toFixed(2)}`);
    console.log(`   Created: ${new Date(purchase.created_at).toLocaleString()}`);
    if (purchase.provider_meta) {
      console.log(`   Provider Meta:`, JSON.stringify(purchase.provider_meta, null, 2));
    }
  });

  console.log('\n\n🔍 Checking for Stripe Checkout Sessions...\n');

  const withStripe = purchases.filter(p =>
    p.payment_provider_id && p.payment_provider_id.startsWith('cs_')
  );

  console.log(`💳 Purchases with Stripe Checkout Session: ${withStripe.length}`);

  if (withStripe.length > 0) {
    console.log('\n⚠️ These purchases have Stripe sessions but are still pending.');
    console.log('This means webhook is NOT arriving or NOT configured correctly.\n');

    withStripe.forEach(p => {
      console.log(`   - ${p.id}: ${p.payment_provider_id}`);
    });
  }

  console.log('\n\n📊 Checking recent system logs for webhook events...\n');

  const { data: logs, error: logsError } = await supabase
    .from('system_logs')
    .select('created_at, type, level, message, meta')
    .or('type.eq.payment,message.ilike.%webhook%,message.ilike.%stripe%')
    .order('created_at', { ascending: false })
    .limit(20);

  if (logsError) {
    console.error('❌ Error fetching logs:', logsError);
  } else {
    console.log(`📝 Recent payment/webhook logs: ${logs.length}\n`);

    const webhookLogs = logs.filter(l =>
      l.message.toLowerCase().includes('webhook') ||
      l.message.toLowerCase().includes('stripe')
    );

    if (webhookLogs.length === 0) {
      console.log('⚠️ NO webhook events found in system logs!');
      console.log('This confirms webhook is NOT configured or NOT arriving.\n');
    } else {
      console.log('✅ Found webhook events:\n');
      webhookLogs.slice(0, 5).forEach(log => {
        console.log(`   [${new Date(log.created_at).toLocaleString()}] ${log.message}`);
      });
    }
  }

  process.exit(0);
})();
