const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');
require('dotenv').config();

const supabaseUrl = 'https://szghyvnbmjlquznxhqum.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6Z2h5dm5ibWpscXV6bnhocXVtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODc0OTk5OSwiZXhwIjoyMDc0MzI1OTk5fQ.p9_G_CjLg8h2CVZqteKLdK9WUFKFdXSqTuTolHFiWGc';

const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize Stripe
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  console.error('❌ STRIPE_SECRET_KEY not found in environment');
  process.exit(1);
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2025-08-27.basil',
});

async function approvePaidPurchases() {
  console.log('🔍 Finding purchases with paid status in Stripe but pending in database...\n');

  // Find purchases that have checkout_session_id and payment_status: paid
  const { data: purchases, error } = await supabase
    .from('purchases')
    .select('*, content(*)')
    .eq('status', 'pending')
    .not('provider_meta->>checkout_session_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('❌ Error fetching purchases:', error);
    process.exit(1);
  }

  console.log(`📦 Found ${purchases.length} purchases with Stripe sessions\n`);

  const paidPurchases = purchases.filter(p =>
    p.provider_meta?.payment_status === 'paid' || p.provider_meta?.checkout_session_id
  );

  console.log(`💳 ${paidPurchases.length} purchases marked as paid or have session ID\n`);

  if (paidPurchases.length === 0) {
    console.log('✅ No purchases to approve!');
    return;
  }

  for (const purchase of paidPurchases) {
    const sessionId = purchase.provider_meta?.checkout_session_id;

    if (!sessionId) {
      console.log(`⏭️  Skipping ${purchase.id} - no session ID`);
      continue;
    }

    console.log(`\n🔍 Checking purchase ${purchase.id}`);
    console.log(`   Session: ${sessionId}`);
    console.log(`   Amount: R$ ${(purchase.amount_cents / 100).toFixed(2)}`);

    try {
      // Get session from Stripe
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      console.log(`   Stripe Status: ${session.payment_status}`);
      console.log(`   Payment Intent: ${session.payment_intent || 'none'}`);

      if (session.payment_status === 'paid') {
        console.log(`   ✅ PAID IN STRIPE! Approving now...`);

        // Get payment intent details
        let paymentMethodType = 'card';
        if (session.payment_intent) {
          const paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent);
          paymentMethodType = paymentIntent.payment_method_types?.[0] || 'card';
          console.log(`   Payment Method: ${paymentMethodType}`);
        }

        // Update purchase to PAID
        const { error: updateError } = await supabase
          .from('purchases')
          .update({
            status: 'paid',
            payment_provider_id: session.payment_intent || sessionId,
            payment_method: paymentMethodType === 'pix' ? 'pix' : 'card',
            access_expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
            updated_at: new Date().toISOString(),
            provider_meta: {
              ...purchase.provider_meta,
              manually_approved: true,
              approved_at: new Date().toISOString(),
              stripe_payment_status: session.payment_status,
            },
          })
          .eq('id', purchase.id);

        if (updateError) {
          console.error(`   ❌ Error updating purchase:`, updateError);
          continue;
        }

        console.log(`   ✅ Purchase marked as PAID!`);

        // Increment content sales
        if (purchase.content_id) {
          const { error: salesError } = await supabase.rpc('increment_content_sales', {
            content_id: purchase.content_id,
          }).catch(() => {
            // Fallback manual increment
            return supabase
              .from('content')
              .update({
                total_sales: (purchase.content?.total_sales || 0) + 1,
                weekly_sales: (purchase.content?.weekly_sales || 0) + 1,
              })
              .eq('id', purchase.content_id);
          });
        }

        // Log approval
        await supabase
          .from('system_logs')
          .insert({
            type: 'payment',
            level: 'info',
            message: `Purchase ${purchase.id} manually approved - paid in Stripe`,
            meta: {
              purchase_id: purchase.id,
              session_id: sessionId,
              payment_intent: session.payment_intent,
              amount_cents: purchase.amount_cents,
              manually_approved: true,
            },
          });

        console.log(`   📝 Logged to system_logs`);

        // Get telegram_chat_id
        const telegramChatId = purchase.provider_meta?.telegram_chat_id;

        if (telegramChatId) {
          console.log(`   📱 User has Telegram ID: ${telegramChatId}`);
          console.log(`   ⚠️  MANUAL ACTION REQUIRED: Send content via Telegram bot`);
          console.log(`   Purchase ID: ${purchase.id}`);
          console.log(`   Content ID: ${purchase.content_id}`);
          console.log(`   Content Title: ${purchase.content?.title || 'unknown'}`);
          console.log(`   Chat ID: ${telegramChatId}`);
        } else {
          console.log(`   ⚠️  No telegram_chat_id found - cannot deliver content`);
        }

      } else {
        console.log(`   ℹ️  Status: ${session.payment_status} - NOT paid yet`);
      }

    } catch (stripeError) {
      console.error(`   ❌ Stripe error:`, stripeError.message);
    }
  }

  console.log('\n\n✅ Done! Approved purchases are now marked as PAID.');
  console.log('⚠️  Note: Content must be delivered manually via Telegram bot');
  console.log('    or by restarting the backend to trigger delivery.');
}

approvePaidPurchases().catch(console.error);
