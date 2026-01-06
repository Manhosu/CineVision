const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');
const axios = require('axios');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Woovi configuration
const wooviAppId = process.env.WOOVI_APP_ID;
const wooviSandbox = process.env.WOOVI_SANDBOX === 'true';
const wooviBaseUrl = wooviSandbox
  ? 'https://api.woovi-sandbox.com'
  : 'https://api.woovi.com';

// Get Woovi payment status
async function getWooviPaymentStatus(correlationID) {
  if (!wooviAppId) {
    console.log('⚠️  WOOVI_APP_ID not configured');
    return null;
  }

  try {
    const response = await axios.get(
      `${wooviBaseUrl}/api/v1/charge/${correlationID}`,
      {
        headers: {
          'Authorization': wooviAppId,
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data.charge || response.data;
  } catch (error) {
    console.log(`⚠️  Failed to get Woovi payment: ${error.message}`);
    return null;
  }
}

async function syncPaymentStatuses() {
  console.log('🔄 Syncing payment statuses from Stripe and Woovi...\n');

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

      } else if (payment.provider === 'woovi') {
        // Check with Woovi
        const wooviPayment = await getWooviPaymentStatus(payment.provider_payment_id);

        if (wooviPayment) {
          realStatus = wooviPayment.status;
          console.log(`  Woovi status: ${realStatus}`);

          // Map Woovi status to internal status
          if (realStatus === 'COMPLETED') {
            await updatePaymentStatus(payment, 'pago');
            updated++;
          } else if (realStatus === 'EXPIRED') {
            await updatePaymentStatus(payment, 'falhou');
            updated++;
          } else {
            console.log(`  Status is still ${realStatus}, keeping as pending`);
          }
        }
      } else if (payment.provider === 'efi' || payment.provider === 'mercadopago') {
        // Legacy: Skip old EFI/Mercado Pago payments (no longer supported)
        console.log(`  ⚠️  ${payment.provider} is no longer supported, skipping`);
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
