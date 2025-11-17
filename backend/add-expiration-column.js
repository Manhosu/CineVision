const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addExpirationColumn() {
  console.log('🔧 Adding expires_at column to purchases table...\n');

  try {
    // Add column
    console.log('1. Adding expires_at column...');
    const { error: alterError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE purchases
        ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
      `
    });

    if (alterError && !alterError.message.includes('already exists')) {
      console.error('Error adding column:', alterError.message);
    } else {
      console.log('✅ Column added successfully');
    }

    // Update existing pending purchases
    console.log('\n2. Setting expiration for existing pending purchases...');
    const { data, error: updateError } = await supabase
      .from('purchases')
      .update({
        expires_at: supabase.rpc('now() + interval \'24 hours\'')
      })
      .in('status', ['pending', 'pendente'])
      .is('expires_at', null);

    if (updateError) {
      // Try alternative approach
      console.log('Trying alternative update method...');

      const { data: pendingPurchases } = await supabase
        .from('purchases')
        .select('id, created_at')
        .in('status', ['pending', 'pendente'])
        .is('expires_at', null);

      if (pendingPurchases && pendingPurchases.length > 0) {
        console.log(`Found ${pendingPurchases.length} pending purchases to update`);

        for (const purchase of pendingPurchases) {
          const expiresAt = new Date(purchase.created_at);
          expiresAt.setHours(expiresAt.getHours() + 24);

          await supabase
            .from('purchases')
            .update({ expires_at: expiresAt.toISOString() })
            .eq('id', purchase.id);
        }

        console.log('✅ Updated all pending purchases with expiration');
      }
    } else {
      console.log('✅ Set expiration for existing purchases');
    }

    console.log('\n✅ Migration completed successfully!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

addExpirationColumn().catch(console.error);
