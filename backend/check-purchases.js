const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkPurchases() {
  const userId = '84dca2a4-02cd-4dfa-a7df-6f2afcb26027';
  const liloId = 'c7ed9623-7bcb-4c13-91b7-6f96b76facd1';
  
  const { data, error } = await supabase
    .from('purchases')
    .select('id, content_id, status, created_at')
    .eq('user_id', userId)
    .eq('content_id', liloId)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('Purchases for Lilo & Stitch:');
  console.log(JSON.stringify(data, null, 2));
  console.log(`\nTotal: ${data.length} purchases`);
}

checkPurchases();
