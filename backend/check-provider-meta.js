const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkProviderMeta() {
  const { data: purchases, error } = await supabase
    .from('purchases')
    .select('id, provider_meta, user_id, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  console.log(`\n📦 Analyzing last 10 purchases:\n`);

  purchases.forEach((p, index) => {
    console.log(`${index + 1}. Purchase ${p.id}`);
    console.log(`   User ID: ${p.user_id}`);
    console.log(`   Created: ${new Date(p.created_at).toLocaleString('pt-BR')}`);

    if (p.provider_meta) {
      console.log(`   Provider Meta Keys:`, Object.keys(p.provider_meta));
      console.log(`   - telegram_user_id: ${p.provider_meta.telegram_user_id || 'MISSING'}`);
      console.log(`   - telegram_username: ${p.provider_meta.telegram_username || 'MISSING'}`);
      console.log(`   - telegram_first_name: ${p.provider_meta.telegram_first_name || 'MISSING'}`);
      console.log(`   - telegram_last_name: ${p.provider_meta.telegram_last_name || 'MISSING'}`);
      console.log(`   Full provider_meta:`, JSON.stringify(p.provider_meta, null, 2));
    } else {
      console.log(`   ❌ NO provider_meta found!`);
    }
    console.log('');
  });
}

checkProviderMeta().catch(console.error);
