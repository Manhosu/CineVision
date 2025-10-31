const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://szghyvnbmjlquznxhqum.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6Z2h5dm5ibWpscXV6bnhocXVtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODc0OTk5OSwiZXhwIjoyMDc0MzI1OTk5fQ.p9_G_CjLg8h2CVZqteKLdK9WUFKFdXSqTuTolHFiWGc';

const supabase = createClient(supabaseUrl, supabaseKey);

async function auditDeliveryFlow() {
  console.log('🔍 AUDITORIA: Fluxo de Entrega de Conte\u00fado Ap\u00f3s Pagamento\n');

  // 1. Verificar compras pagas recentes
  console.log('1\ufe0f⃣ Verificando compras pagas recentes...\n');

  const { data: paidPurchases, error: purchasesError } = await supabase
    .from('purchases')
    .select('id, user_id, content_id, status, payment_method, amount_cents, created_at, provider_meta, updated_at')
    .eq('status', 'paid')
    .order('updated_at', { ascending: false })
    .limit(5);

  if (purchasesError) {
    console.error('❌ Erro:', purchasesError);
    return;
  }

  console.log(`✅ Encontradas ${paidPurchases.length} compras pagas\n`);

  if (paidPurchases.length === 0) {
    console.log('⚠️  Sem compras pagas para auditar');
    return;
  }

  // Para cada compra paga, verificar:
  for (const purchase of paidPurchases) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📦 COMPRA: ${purchase.id}`);
    console.log(`${'='.repeat(80)}\n`);

    console.log(`Status: ${purchase.status}`);
    console.log(`Método: ${purchase.payment_method || 'N/A'}`);
    console.log(`Valor: R$ ${(purchase.amount_cents / 100).toFixed(2)}`);
    console.log(`Criada: ${new Date(purchase.created_at).toLocaleString()}`);
    console.log(`Atualizada: ${new Date(purchase.updated_at).toLocaleString()}\n`);

    // 2. Verificar usuário
    console.log('👤 Verificando usuário...');
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, name, telegram_id, telegram_username, telegram_chat_id')
      .eq('id', purchase.user_id)
      .single();

    if (userError || !user) {
      console.log(`   ❌ Usuário não encontrado!\n`);
      continue;
    }

    console.log(`   ✅ ${user.name || user.email}`);
    console.log(`   📱 Telegram ID: ${user.telegram_id || 'N/A'}`);
    console.log(`   💬 Telegram Chat ID: ${user.telegram_chat_id || 'N/A'}`);
    console.log(`   👤 Username: @${user.telegram_username || 'N/A'}\n`);

    // 3. Verificar conteúdo
    console.log('🎬 Verificando conteúdo...');
    console.log(`   Buscando content_id: ${purchase.content_id || 'NULL'}`);

    if (!purchase.content_id) {
      console.log(`   ❌ Purchase não tem content_id!\n`);
      continue;
    }

    const { data: content, error: contentError } = await supabase
      .from('content')
      .select('id, title, content_type, video_url, telegram_link')
      .eq('id', purchase.content_id)
      .single();

    if (contentError) {
      console.log(`   ❌ Erro ao buscar conteúdo: ${contentError.message}\n`);
      continue;
    }

    if (!content) {
      console.log(`   ❌ Conteúdo não encontrado no banco!\n`);
      continue;
    }

    console.log(`   ✅ ${content.title}`);
    console.log(`   📺 Tipo: ${content.content_type || 'N/A'}`);
    console.log(`   🔗 Video URL: ${content.video_url ? 'Sim' : 'Não'}`);
    console.log(`   📲 Telegram Link: ${content.telegram_link || 'N/A'}\n`);

    // 4. Verificar linguagens do conteúdo
    console.log('🌐 Verificando idiomas disponíveis...');
    const { data: languages, error: langError } = await supabase
      .from('content_languages')
      .select('id, language, is_active, video_storage_key, upload_status, file_size_bytes')
      .eq('content_id', purchase.content_id);

    if (langError || !languages || languages.length === 0) {
      console.log(`   ⚠️  Nenhum idioma encontrado\n`);
    } else {
      console.log(`   ✅ ${languages.length} idioma(s) encontrado(s):`);
      languages.forEach(lang => {
        console.log(`      - ${lang.language}: ${lang.is_active ? '✅ Ativo' : '❌ Inativo'} | Upload: ${lang.upload_status} | Storage: ${lang.video_storage_key ? 'Sim' : 'Não'}`);
      });
      console.log('');
    }

    // 5. Verificar token de auto-login
    console.log('🔑 Verificando token de auto-login...');
    let tokens = null;
    if (user.telegram_id) {
      const { data: tokensData, error: tokenError } = await supabase
        .from('auto_login_tokens')
        .select('token, created_at, expires_at')
        .eq('telegram_id', user.telegram_id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (tokenError) {
        console.log(`   ❌ Erro ao buscar token: ${tokenError.message}\n`);
      } else if (!tokensData || tokensData.length === 0) {
        console.log(`   ⚠️  Nenhum token encontrado para este usuário\n`);
      } else {
        tokens = tokensData;
        const token = tokens[0];
        const isExpired = new Date(token.expires_at) < new Date();
        console.log(`   ✅ Token encontrado`);
        console.log(`      Token: ${token.token.substring(0, 20)}...`);
        console.log(`      Criado: ${new Date(token.created_at).toLocaleString()}`);
        console.log(`      Expira: ${new Date(token.expires_at).toLocaleString()} ${isExpired ? '(EXPIRADO!)' : ''}\n`);
      }
    } else {
      console.log(`   ⚠️  Usuário não tem telegram_id\n`);
    }

    // 6. Verificar logs de entrega
    console.log('📋 Verificando logs de entrega...');
    const { data: logs, error: logsError } = await supabase
      .from('system_logs')
      .select('created_at, type, level, message')
      .eq('type', 'delivery')
      .ilike('message', `%${purchase.id}%`)
      .order('created_at', { ascending: false })
      .limit(5);

    if (logsError) {
      console.log(`   ❌ Erro ao buscar logs: ${logsError.message}\n`);
    } else if (!logs || logs.length === 0) {
      console.log(`   ⚠️  Nenhum log de entrega encontrado\n`);
    } else {
      console.log(`   ✅ ${logs.length} log(s) encontrado(s):`);
      logs.forEach(log => {
        console.log(`      [${new Date(log.created_at).toLocaleString()}] ${log.level}: ${log.message}`);
      });
      console.log('');
    }

    // 7. RESUMO
    console.log('📊 RESUMO DA AUDITORIA:');
    console.log(`   Usuário: ${user ? '✅' : '❌'}`);
    console.log(`   Telegram Chat ID: ${user?.telegram_chat_id ? '✅' : '❌ FALTANDO!'}`);
    console.log(`   Conteúdo: ${content ? '✅' : '❌'}`);
    console.log(`   Idiomas ativos: ${languages?.filter(l => l.is_active && l.video_storage_key).length || 0}`);
    console.log(`   Token auto-login: ${user?.telegram_id ? (tokens?.length > 0 ? '✅' : '❌') : 'N/A'}`);
    console.log(`   Logs de entrega: ${logs?.length > 0 ? '✅' : '❌ NENHUM!'}`);
    console.log('');
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log('✅ AUDITORIA CONCLUÍDA');
  console.log(`${'='.repeat(80)}\n`);
}

auditDeliveryFlow().catch(console.error);
