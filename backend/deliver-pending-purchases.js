const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
require('dotenv').config();

const supabaseUrl = 'https://szghyvnbmjlquznxhqum.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6Z2h5dm5ibWpscXV6bnhocXVtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODc0OTk5OSwiZXhwIjoyMDc0MzI1OTk5fQ.p9_G_CjLg8h2CVZqteKLdK9WUFKFdXSqTuTolHFiWGc';

const supabase = createClient(supabaseUrl, supabaseKey);

// Telegram Bot Token
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://app.cinevisionapp.com.br';

async function sendTelegramMessage(chatId, text, options = {}) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        ...options,
      }),
    });

    const data = await response.json();
    if (!data.ok) {
      throw new Error(data.description || 'Telegram API error');
    }

    return data.result;
  } catch (error) {
    console.error(`   ❌ Erro ao enviar mensagem Telegram: ${error.message}`);
    throw error;
  }
}

async function getOrCreateAutoLoginToken(userId, telegramId) {
  try {
    // Buscar token existente
    const { data: existingTokens } = await supabase
      .from('auto_login_tokens')
      .select('token')
      .eq('user_id', userId)
      .eq('telegram_id', telegramId)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1);

    if (existingTokens && existingTokens.length > 0) {
      console.log('   ✅ Token de auto-login já existe');
      return existingTokens[0].token;
    }

    // Criar novo token
    console.log('   🔑 Criando novo token de auto-login...');
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

    const { error: tokenError } = await supabase
      .from('auto_login_tokens')
      .insert({
        token,
        user_id: userId,
        telegram_id: telegramId,
        expires_at: expiresAt.toISOString(),
        redirect_url: '/dashboard',
        is_used: false,
      });

    if (tokenError) {
      console.log(`   ⚠️  Erro ao criar token: ${tokenError.message}`);
      console.log('   Continuando sem token de auto-login...');
      return null;
    }

    console.log('   ✅ Token de auto-login criado com sucesso');
    return token;
  } catch (error) {
    console.log(`   ⚠️  Erro ao gerenciar token: ${error.message}`);
    return null;
  }
}

async function deliverPendingPurchases() {
  console.log('📦 ENTREGA DE CONTEÚDO PENDENTE\n');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // 1. Buscar compras pagas sem logs de entrega
  console.log('1️⃣ Buscando compras pagas sem entrega...');
  console.log('─────────────────────────────────────────────────────────────\n');

  const { data: purchases, error: purchasesError } = await supabase
    .from('purchases')
    .select('*')
    .eq('status', 'paid')
    .order('created_at', { ascending: false });

  if (purchasesError) {
    console.error('❌ Erro ao buscar compras:', purchasesError);
    return;
  }

  console.log(`✅ Encontradas ${purchases.length} compras pagas\n`);

  // 2. Filtrar compras sem logs de entrega
  const purchasesWithoutDelivery = [];

  for (const purchase of purchases) {
    const { data: logs } = await supabase
      .from('system_logs')
      .select('id')
      .eq('type', 'delivery')
      .ilike('message', `%${purchase.id}%`)
      .limit(1);

    if (!logs || logs.length === 0) {
      purchasesWithoutDelivery.push(purchase);
    }
  }

  console.log(`⚠️  ${purchasesWithoutDelivery.length} compra(s) sem entrega encontrada(s)\n`);

  if (purchasesWithoutDelivery.length === 0) {
    console.log('✅ Todas as compras pagas já foram entregues!\n');
    return;
  }

  // 3. Entregar cada compra pendente
  let successCount = 0;
  let errorCount = 0;

  for (const purchase of purchasesWithoutDelivery) {
    console.log('\n════════════════════════════════════════════════════════════════');
    console.log(`📦 COMPRA: ${purchase.id.substring(0, 8)}...`);
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Buscar usuário
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('id', purchase.user_id)
      .single();

    if (!user) {
      console.log('❌ ERRO: Usuário não encontrado!\n');
      errorCount++;
      continue;
    }

    // Buscar conteúdo
    const { data: content } = await supabase
      .from('content')
      .select('*')
      .eq('id', purchase.content_id)
      .single();

    if (!content) {
      console.log('❌ ERRO: Conteúdo não encontrado!\n');
      errorCount++;
      continue;
    }

    console.log(`Usuário: ${user.name || user.email}`);
    console.log(`Conteúdo: ${content.title}`);
    console.log(`Valor: R$ ${(purchase.amount_cents / 100).toFixed(2)}`);
    console.log(`Data da compra: ${new Date(purchase.created_at).toLocaleString()}\n`);

    // Verificar telegram_chat_id
    if (!user.telegram_chat_id) {
      console.log('❌ ERRO: Usuário não tem telegram_chat_id!');
      console.log('   Não é possível enviar conteúdo sem ID do chat.\n');
      errorCount++;

      await supabase.from('system_logs').insert({
        type: 'delivery',
        level: 'error',
        message: `Cannot deliver purchase ${purchase.id}: user ${user.id} has no telegram_chat_id`,
      });

      continue;
    }

    const chatId = user.telegram_chat_id;
    console.log(`📱 Telegram Chat ID: ${chatId}\n`);

    try {
      // Obter ou criar token de auto-login
      const token = await getOrCreateAutoLoginToken(user.id, user.telegram_id);
      const dashboardUrl = token
        ? `${FRONTEND_URL}/auth/auto-login?token=${token}`
        : `${FRONTEND_URL}/dashboard`;

      // Enviar mensagem de confirmação
      console.log('📨 Enviando mensagem de confirmação...\n');

      const priceText = (purchase.amount_cents / 100).toFixed(2);
      let message =
        `🎉 *Pagamento Confirmado!*\n\n` +
        `✅ Sua compra de "${content.title}" foi aprovada!\n` +
        `💰 Valor pago: R$ ${priceText}\n\n` +
        `🌐 *Dashboard Auto-Login:*\n${dashboardUrl}\n\n`;

      // Verificar conteúdo disponível
      let contentAvailable = false;

      // 1. Verificar se tem video_url direto
      if (content.video_url) {
        console.log('   ✅ Video URL disponível');
        message += `🔗 *Link do Vídeo:*\n${content.video_url}\n\n`;
        contentAvailable = true;
      } else {
        console.log('   ⚠️  Sem video_url direto');
      }

      // 2. Verificar idiomas com storage_key
      const { data: languages } = await supabase
        .from('content_languages')
        .select('*')
        .eq('content_id', content.id)
        .eq('is_active', true)
        .eq('upload_status', 'completed')
        .not('video_storage_key', 'is', null);

      if (languages && languages.length > 0) {
        console.log(`   ✅ ${languages.length} idioma(s) com vídeo disponível:`);

        message += `📺 *Idiomas Disponíveis:*\n`;
        languages.forEach(lang => {
          console.log(`      - ${lang.language}`);
          message += `   • ${lang.language}\n`;
          contentAvailable = true;
        });
        message += '\n';
      } else {
        console.log('   ⚠️  Nenhum idioma com vídeo disponível');
      }

      // Se não tem nenhum conteúdo disponível
      if (!contentAvailable) {
        message += `⚠️ *Atenção:* O conteúdo ainda está sendo processado.\n`;
        message += `Você receberá o link assim que estiver disponível.\n\n`;
        console.log('   ⚠️  NENHUM CONTEÚDO DISPONÍVEL PARA ENVIO');
      } else {
        message += `✅ Acesse o dashboard para assistir!\n\n`;
      }

      message += `📞 Suporte: Entre em contato conosco caso tenha dúvidas.`;

      // Enviar mensagem
      await sendTelegramMessage(chatId, message, { parse_mode: 'Markdown' });
      console.log('\n   ✅ Mensagem enviada com sucesso!');

      // Logar entrega
      await supabase.from('system_logs').insert({
        type: 'delivery',
        level: 'info',
        message: `Content delivered for purchase ${purchase.id} (manual delivery script)`,
      });

      successCount++;
      console.log(`\n✅ ENTREGA CONCLUÍDA COM SUCESSO!\n`);
    } catch (error) {
      console.log(`\n❌ ERRO NA ENTREGA: ${error.message}\n`);
      errorCount++;

      await supabase.from('system_logs').insert({
        type: 'delivery',
        level: 'error',
        message: `Failed to deliver purchase ${purchase.id}: ${error.message}`,
      });
    }
  }

  // RESUMO
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('📊 RESUMO DA OPERAÇÃO');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log(`Total de compras sem entrega: ${purchasesWithoutDelivery.length}`);
  console.log(`✅ Entregas bem-sucedidas: ${successCount}`);
  console.log(`❌ Erros: ${errorCount}`);

  const successRate = purchasesWithoutDelivery.length > 0
    ? (successCount / purchasesWithoutDelivery.length * 100).toFixed(1)
    : 100;

  console.log(`\n📈 Taxa de sucesso: ${successRate}%\n`);

  if (successCount > 0) {
    console.log('✅ Entregas realizadas com sucesso!');
    console.log('   Os usuários receberam notificação e link de acesso.\n');
  }

  console.log('═══════════════════════════════════════════════════════════════\n');
}

deliverPendingPurchases().catch(error => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});
