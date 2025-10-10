import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://szghyvnbmjlquznxhqum.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6Z2h5dm5ibWpscXV6bnhocXVtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODc0OTk5OSwiZXhwIjoyMDc0MzI1OTk5fQ.p9_G_CjLg8h2CVZqteKLdK9WUFKFdXSqTuTolHFiWGc';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const USER_ID = '61cf8d35-2692-4507-9784-176a3fc047cd'; // eduardogelista@gmail.com

async function createPurchases() {
  console.log('🛒 Creating purchases for all movies (except Superman)...\n');

  // Get all content except Superman
  const { data: movies, error: fetchError } = await supabase
    .from('content')
    .select('id, title, price_cents')
    .neq('title', 'Superman')
    .order('title');

  if (fetchError) {
    console.error('❌ Error fetching movies:', fetchError);
    process.exit(1);
  }

  console.log(`📊 Found ${movies.length} movies to purchase\n`);

  let successCount = 0;
  let skipCount = 0;

  for (const movie of movies) {
    // Check if purchase already exists
    const { data: existing } = await supabase
      .from('purchases')
      .select('id')
      .eq('user_id', USER_ID)
      .eq('content_id', movie.id)
      .single();

    if (existing) {
      console.log(`⏭️  ${movie.title} - Already purchased`);
      skipCount++;
      continue;
    }

    // Create purchase
    const { data: purchase, error: purchaseError } = await supabase
      .from('purchases')
      .insert({
        user_id: USER_ID,
        content_id: movie.id,
        amount_cents: movie.price_cents,
        currency: 'BRL',
        status: 'paid',
        preferred_delivery: 'both',
        payment_provider_id: `manual_${Date.now()}_${movie.id.substring(0, 8)}`,
        access_token: `access_token_${movie.id}`,
        access_expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year from now
      })
      .select()
      .single();

    if (purchaseError) {
      console.error(`❌ Error creating purchase for ${movie.title}:`, purchaseError);
      continue;
    }

    console.log(`✅ ${movie.title} - Purchase created (R$ ${(movie.price_cents / 100).toFixed(2)})`);
    successCount++;
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 PURCHASE CREATION SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Created: ${successCount}`);
  console.log(`⏭️  Skipped (already exists): ${skipCount}`);
  console.log(`📝 Total movies: ${movies.length}`);
  console.log('='.repeat(60));
}

createPurchases().catch(console.error);
