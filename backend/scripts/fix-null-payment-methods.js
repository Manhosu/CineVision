/**
 * Script to fix NULL payment_method values in purchases table
 *
 * This fixes the issue where old purchases don't have payment_method set,
 * causing "PAID" warnings in the admin Purchase Manager
 *
 * Usage: node scripts/fix-null-payment-methods.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixNullPaymentMethods() {
  try {
    console.log('🚀 Starting payment_method NULL fix...\n');

    // Get all purchases with NULL payment_method
    const { data: purchases, error: purchasesError } = await supabase
      .from('purchases')
      .select('id, provider_meta, status, created_at, payment_provider_id')
      .is('payment_method', null)
      .order('created_at', { ascending: false });

    if (purchasesError) {
      console.error('❌ Error fetching purchases:', purchasesError);
      return;
    }

    console.log(`📊 Found ${purchases.length} purchases with NULL payment_method\n`);

    if (purchases.length === 0) {
      console.log('✅ No purchases to fix!');
      return;
    }

    let fixedCount = 0;
    let errorCount = 0;

    const stats = {
      pix: 0,
      card: 0,
      credit_card: 0,
    };

    for (const purchase of purchases) {
      let paymentMethod = null;
      let providerInfo = 'unknown';

      // Try to determine payment method from provider_meta first
      if (purchase.provider_meta) {
        const meta = typeof purchase.provider_meta === 'string'
          ? JSON.parse(purchase.provider_meta)
          : purchase.provider_meta;

        if (meta.payment_method === 'pix') {
          paymentMethod = 'pix';
        } else if (meta.payment_method === 'card') {
          paymentMethod = 'card';
        } else if (meta.payment_method === 'credit_card') {
          paymentMethod = 'credit_card';
        } else if (meta.payment_type_id === 'pix') {
          paymentMethod = 'pix';
        } else if (meta.payment_type_id === 'credit_card') {
          paymentMethod = 'credit_card';
        } else if (meta.payment_type_id === 'debit_card') {
          paymentMethod = 'card';
        }
      }

      // If still not determined, try to get from payments table
      if (!paymentMethod) {
        const { data: payment } = await supabase
          .from('payments')
          .select('provider, payment_method')
          .eq('purchase_id', purchase.id)
          .single();

        if (payment) {
          providerInfo = payment.provider;

          // Use payment's payment_method if available
          if (payment.payment_method) {
            paymentMethod = payment.payment_method;
          } else {
            // Infer from provider
            if (payment.provider === 'stripe') {
              paymentMethod = 'card';
            } else if (payment.provider === 'pix') {
              paymentMethod = 'pix';
            } else if (payment.provider === 'credit_card') {
              paymentMethod = 'credit_card';
            }
          }
        }
      }

      // Default fallback based on status
      if (!paymentMethod && purchase.status === 'paid') {
        paymentMethod = 'card'; // Default to card for paid purchases
        providerInfo = 'default';
      }

      // Skip if still can't determine
      if (!paymentMethod) {
        console.log(`⚠️  Skipping purchase ${purchase.id}: Cannot determine payment method`);
        continue;
      }

      // Update the purchase
      const { error: updateError } = await supabase
        .from('purchases')
        .update({ payment_method: paymentMethod })
        .eq('id', purchase.id);

      if (updateError) {
        console.error(`❌ Error updating purchase ${purchase.id}:`, updateError);
        errorCount++;
      } else {
        stats[paymentMethod] = (stats[paymentMethod] || 0) + 1;
        const statusEmoji = purchase.status === 'paid' ? '✅' : '⏳';
        console.log(
          `${statusEmoji} Purchase ${purchase.id}: NULL → ${paymentMethod} (${providerInfo}, ${purchase.status})`
        );
        fixedCount++;
      }
    }

    console.log('\n✅ Fix completed!');
    console.log(`   Fixed: ${fixedCount} purchases`);
    console.log(`   - PIX: ${stats.pix || 0}`);
    console.log(`   - Card: ${stats.card || 0}`);
    console.log(`   - Credit Card: ${stats.credit_card || 0}`);
    console.log(`   Errors: ${errorCount} purchases`);

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

// Run the script
fixNullPaymentMethods()
  .then(() => {
    console.log('\n🎉 Script finished successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
