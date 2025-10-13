const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testDeduplicate() {
  const userId = '84dca2a4-02cd-4dfa-a7df-6f2afcb26027';
  
  // Simular o que o PurchasesService faz
  const { data: purchases, error } = await supabase
    .from('purchases')
    .select(`
      id,
      created_at,
      access_token,
      access_expires_at,
      content:content_id (
        id,
        title,
        description,
        poster_url,
        banner_url,
        duration_minutes,
        release_year,
        imdb_rating,
        genres
      )
    `)
    .eq('user_id', userId)
    .eq('status', 'paid')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Raw purchases from DB:', purchases.length);
  
  // Deduplicate
  const uniqueContentMap = new Map();
  
  for (const purchase of purchases) {
    if (!uniqueContentMap.has(purchase.content.id)) {
      uniqueContentMap.set(purchase.content.id, {
        id: purchase.content.id,
        title: purchase.content.title,
        purchased_at: purchase.created_at,
      });
    }
  }
  
  const uniqueContent = Array.from(uniqueContentMap.values());
  
  console.log('\nUnique content after deduplication:', uniqueContent.length);
  console.log(JSON.stringify(uniqueContent, null, 2));
}

testDeduplicate();
