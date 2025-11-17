const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');
const axios = require('axios');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const mpAccessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;

async function syncPaymentStatuses() {
  console.log('🔄 Syncing payment statuses from Stripe and Mercado Pago...\n');

  // Get all payments with provider_payment_id
  const { data: payments, error } = await supabase
    .from('payments')
    .select('*')
    .not('provider_payment_id', 'is', null)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error fetching payments:', error.message);
    return;
  }

  console.log(`Found ${payments.length} pending payments to check\n`);

  let updated = 0;
  let failed = 0;

  for (const payment of payments) {
    try {
      console.log(`\nChecking payment ${payment.id} (${payment.provider})...`);

      let realStatus = null;

      if (payment.provider === 'stripe') {
        // Check with Stripe - payment could be a checkout session or payment intent
        try {
          // Try as checkout session first
          const session = await stripe.checkout.sessions.retrieve(payment.provider_payment_id);
          realStatus = session.payment_status; // paid, unpaid, no_payment_required
          console.log(`  Stripe Checkout Session status: ${session.payment_status}`);
        } catch {
          try {
            // Try as payment intent
            const pi = await stripe.paymentIntents.retrieve(payment.provider_payment_id);
            realStatus = pi.status; // succeeded, processing, etc.
            console.log(`  Stripe Payment Intent status: ${pi.status}`);
          } catch (e) {
            console.log(`  ⚠️  Failed to retrieve from Stripe: ${e.message}`);
          }
        }

        // Map Stripe status to internal status
        if (realStatus === 'paid' || realStatus === 'succeeded') {
          await updatePaymentStatus(payment, 'pago');
          updated++;
        } else if (realStatus === 'unpaid' || realStatus === 'requires_payment_method' || realStatus === 'processing') {
          console.log(`  Status is still ${realStatus}, keeping as pending`);
        }

      } else if (payment.provider === 'mercadopago') {
        // Check with Mercado Pago
        try {
          const response = await axios.get(
            `https://api.mercadopago.com/v1/payments/${payment.provider_payment_id}`,
            {
              headers: {
                'Authorization': `Bearer ${mpAccessToken}`
              }
            }
          );

          realStatus = response.data.status;
          console.log(`  Mercado Pago status: ${realStatus}`);

          // Map Mercado Pago status to internal status
          if (realStatus === 'approved') {
            await updatePaymentStatus(payment, 'pago');
            updated++;
          } else if (realStatus === 'cancelled' || realStatus === 'rejected') {
            await updatePaymentStatus(payment, 'falhou');
            updated++;
          } else {
            console.log(`  Status is still ${realStatus}, keeping as pending`);
          }
        } catch (e) {
          console.log(`  ⚠️  Failed to retrieve from Mercado Pago: ${e.message}`);
        }
      }

    } catch (error) {
      console.error(`  ❌ Error processing payment ${payment.id}:`, error.message);
      failed++;
    }
  }

  console.log(`\n\n✅ Sync complete!`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Failed: ${failed}`);
  console.log(`   Unchanged: ${payments.length - updated - failed}`);
}

async function updatePaymentStatus(payment, newStatus) {
  console.log(`  ✅ Updating payment ${payment.id} to ${newStatus}`);

  // Update payment
  await supabase
    .from('payments')
    .update({
      status: newStatus,
      ...(newStatus === 'pago' && { paid_at: new Date().toISOString() })
    })
    .eq('id', payment.id);

  // Update purchase
  await supabase
    .from('purchases')
    .update({ status: newStatus })
    .eq('id', payment.purchase_id);

  console.log(`  ✅ Updated purchase ${payment.purchase_id} to ${newStatus}`);
}

syncPaymentStatuses().catch(console.error);
