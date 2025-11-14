/**
 * Script to recalculate weekly_sales for all content based on purchases from last 7 days
 *
 * This fixes the issue where weekly_sales was not being incremented for Mercado Pago/PIX purchases
 *
 * Usage: node scripts/recalculate-weekly-sales.js
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

async function recalculateWeeklySales() {
  try {
    console.log('🚀 Starting weekly_sales recalculation...\n');

    // Calculate date 7 days ago
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoISO = sevenDaysAgo.toISOString();

    console.log(`📅 Counting purchases from: ${sevenDaysAgoISO}`);
    console.log(`📅 Until now: ${new Date().toISOString()}\n`);

    // Get all paid purchases from last 7 days
    const { data: purchases, error: purchasesError } = await supabase
      .from('purchases')
      .select('content_id, created_at')
      .eq('status', 'paid')
      .gte('created_at', sevenDaysAgoISO)
      .order('created_at', { ascending: false });

    if (purchasesError) {
      console.error('❌ Error fetching purchases:', purchasesError);
      return;
    }

    console.log(`📊 Found ${purchases.length} paid purchases in last 7 days\n`);

    // Group purchases by content_id
    const salesByContent = purchases.reduce((acc, purchase) => {
      const contentId = purchase.content_id;
      if (!acc[contentId]) {
        acc[contentId] = 0;
      }
      acc[contentId]++;
      return acc;
    }, {});

    const contentIds = Object.keys(salesByContent);
    console.log(`🎬 Updating weekly_sales for ${contentIds.length} content items...\n`);

    // Update weekly_sales for each content
    let updatedCount = 0;
    let errorCount = 0;

    for (const contentId of contentIds) {
      const weeklySales = salesByContent[contentId];

      // Get content info for logging
      const { data: content } = await supabase
        .from('content')
        .select('title, weekly_sales')
        .eq('id', contentId)
        .single();

      const oldWeeklySales = content?.weekly_sales || 0;

      // Update weekly_sales
      const { error: updateError } = await supabase
        .from('content')
        .update({ weekly_sales: weeklySales })
        .eq('id', contentId);

      if (updateError) {
        console.error(`❌ Error updating content ${contentId}:`, updateError);
        errorCount++;
      } else {
        console.log(
          `✅ ${content?.title || contentId}: ${oldWeeklySales} → ${weeklySales} (${weeklySales > oldWeeklySales ? '+' : ''}${weeklySales - oldWeeklySales})`
        );
        updatedCount++;
      }
    }

    // Reset weekly_sales to 0 for content with no purchases in last 7 days
    console.log('\n🔄 Resetting weekly_sales to 0 for content with no recent purchases...');

    const { data: allContent } = await supabase
      .from('content')
      .select('id, title, weekly_sales')
      .gt('weekly_sales', 0);

    let resetCount = 0;
    for (const content of allContent || []) {
      if (!salesByContent[content.id]) {
        const { error: resetError } = await supabase
          .from('content')
          .update({ weekly_sales: 0 })
          .eq('id', content.id);

        if (!resetError) {
          console.log(`🔄 ${content.title}: ${content.weekly_sales} → 0`);
          resetCount++;
        }
      }
    }

    console.log('\n✅ Recalculation completed!');
    console.log(`   Updated: ${updatedCount} content items`);
    console.log(`   Reset: ${resetCount} content items`);
    console.log(`   Errors: ${errorCount} items`);

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

// Run the script
recalculateWeeklySales()
  .then(() => {
    console.log('\n🎉 Script finished successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
