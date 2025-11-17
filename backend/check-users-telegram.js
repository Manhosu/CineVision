const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkUsersTelegram() {
  // Get some recent purchases with their user IDs
  const { data: purchases } = await supabase
    .from('purchases')
    .select('id, user_id, provider_meta')
    .order('created_at', { ascending: false })
    .limit(5);

  console.log(`\n👥 Checking user data for recent purchases:\n`);

  for (const purchase of purchases) {
    console.log(`Purchase ${purchase.id.substring(0, 8)}...`);
    console.log(`  User ID: ${purchase.user_id}`);

    // Get user data
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, name, telegram_id, telegram_username')
      .eq('id', purchase.user_id)
      .single();

    if (error) {
      console.log(`  ❌ Error fetching user: ${error.message}`);
    } else if (user) {
      console.log(`  ✅ User found in database:`);
      console.log(`     - name: ${user.name || 'MISSING'}`);
      console.log(`     - email: ${user.email || 'MISSING'}`);
      console.log(`     - telegram_id: ${user.telegram_id || 'MISSING'}`);
      console.log(`     - telegram_username: ${user.telegram_username || 'MISSING'}`);
    } else {
      console.log(`  ❌ No user found in database`);
    }

    if (purchase.provider_meta?.telegram_user_id) {
      console.log(`  📱 provider_meta telegram_user_id: ${purchase.provider_meta.telegram_user_id}`);

      // Try to find user by telegram_id
      const { data: telegramUser } = await supabase
        .from('users')
        .select('id, name, telegram_id, telegram_username')
        .eq('telegram_id', purchase.provider_meta.telegram_user_id)
        .single();

      if (telegramUser && telegramUser.id !== purchase.user_id) {
        console.log(`  ⚠️  Found DIFFERENT user with same telegram_id!`);
        console.log(`     - Different user ID: ${telegramUser.id}`);
        console.log(`     - name: ${telegramUser.name}`);
        console.log(`     - telegram_username: ${telegramUser.telegram_username}`);
      }
    }

    console.log('');
  }
}

checkUsersTelegram().catch(console.error);
