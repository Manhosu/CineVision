const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
require('dotenv').config();

const supabaseUrl = 'https://szghyvnbmjlquznxhqum.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6Z2h5dm5ibWpscXV6bnhocXVtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODc0OTk5OSwiZXhwIjoyMDc0MzI1OTk5fQ.p9_G_CjLg8h2CVZqteKLdK9WUFKFdXSqTuTolHFiWGc';

const supabase = createClient(supabaseUrl, supabaseKey);

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN not found');
  process.exit(1);
}

async function sendTelegramMessage(chatId, text, options = {}) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

  try {
    const response = await axios.post(url, {
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown',
      ...options,
    });
    return response.data;
  } catch (error) {
    console.error(`Error sending message to ${chatId}:`, error.response?.data || error.message);
    throw error;
  }
}

async function deliverContentForPurchase(purchase) {
  console.log(`\n🎬 Delivering content for purchase ${purchase.id}`);

  const chatId = purchase.provider_meta?.telegram_chat_id;
  if (!chatId) {
    console.log(`   ⚠️  No telegram_chat_id found!`);
    return false;
  }

  // Get content details
  const { data: content, error: contentError } = await supabase
    .from('content')
    .select('*')
    .eq('id', purchase.content_id)
    .single();

  if (contentError || !content) {
    console.log(`   ❌ Content not found: ${purchase.content_id}`);
    return false;
  }

  console.log(`   📺 Content: ${content.title}`);
  console.log(`   💬 Sending to chat: ${chatId}`);

  // Build message
  const message =
    `🎉 *Pagamento Confirmado!*\n\n` +
    `✅ Seu pagamento foi aprovado com sucesso!\n\n` +
    `🎬 *${content.title}*\n` +
    `💰 Valor pago: R$ ${(purchase.amount_cents / 100).toFixed(2)}\n\n` +
    `📺 *Acesso ao Conteúdo:*\n` +
    `Você agora tem acesso completo a este conteúdo.\n\n`;

  try {
    // Get video file info
    const videoInfo = content.video_file_info || content.telegram_file_meta;

    if (videoInfo?.file_id) {
      console.log(`   📹 Sending video file (file_id: ${videoInfo.file_id})`);

      // Send video
      const videoUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendVideo`;
      await axios.post(videoUrl, {
        chat_id: chatId,
        video: videoInfo.file_id,
        caption: `🎬 ${content.title}\n\n✅ Aproveite seu conteúdo!`,
        parse_mode: 'Markdown',
      });

      console.log(`   ✅ Video sent successfully!`);
    } else if (content.video_url) {
      console.log(`   🔗 Sending video URL: ${content.video_url}`);

      const urlMessage =
        message +
        `🔗 *Link do Vídeo:*\n` +
        `${content.video_url}\n\n` +
        `📱 Clique no link acima para assistir!`;

      await sendTelegramMessage(chatId, urlMessage);
      console.log(`   ✅ URL sent successfully!`);
    } else {
      console.log(`   ⚠️  No video file or URL found - sending confirmation only`);
      await sendTelegramMessage(chatId, message + `\n⚠️ O conteúdo será disponibilizado em breve.`);
    }

    // Log delivery
    await supabase
      .from('system_logs')
      .insert({
        type: 'delivery',
        level: 'info',
        message: `Content delivered for purchase ${purchase.id}`,
        meta: {
          purchase_id: purchase.id,
          content_id: content.id,
          chat_id: chatId,
          delivered_at: new Date().toISOString(),
          manually_delivered: true,
        },
      });

    return true;
  } catch (error) {
    console.error(`   ❌ Error delivering content:`, error.message);
    await supabase
      .from('system_logs')
      .insert({
        type: 'delivery_failed',
        level: 'error',
        message: `Failed to deliver content for purchase ${purchase.id}: ${error.message}`,
        meta: {
          purchase_id: purchase.id,
          content_id: content.id,
          chat_id: chatId,
          error: error.message,
        },
      });
    return false;
  }
}

async function deliverAllPaidContent() {
  console.log('🚀 Finding paid purchases that need content delivery...\n');

  // Find recently paid purchases (last 24 hours)
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: purchases, error } = await supabase
    .from('purchases')
    .select('*')
    .eq('status', 'paid')
    .gte('updated_at', since)
    .not('provider_meta->>telegram_chat_id', 'is', null)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }

  console.log(`📦 Found ${purchases.length} paid purchases in last 24 hours\n`);

  if (purchases.length === 0) {
    console.log('✅ No content to deliver!');
    return;
  }

  let delivered = 0;
  let failed = 0;

  for (const purchase of purchases) {
    const success = await deliverContentForPurchase(purchase);
    if (success) {
      delivered++;
    } else {
      failed++;
    }

    // Small delay between deliveries
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`\n\n📊 Delivery Summary:`);
  console.log(`   ✅ Delivered: ${delivered}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📦 Total: ${purchases.length}`);
}

deliverAllPaidContent().catch(console.error);
