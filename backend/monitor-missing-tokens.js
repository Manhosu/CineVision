const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://szghyvnbmjlquznxhqum.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6Z2h5dm5ibWpscXV6bnhocXVtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODc0OTk5OSwiZXhwIjoyMDc0MzI1OTk5fQ.p9_G_CjLg8h2CVZqteKLdK9WUFKFdXSqTuTolHFiWGc';

const supabase = createClient(supabaseUrl, supabaseKey);

async function monitorMissingTokens() {
  console.log('🔍 MONITORAMENTO: Verificando tokens de auto-login faltantes\n');
  console.log('═══════════════════════════════════════════════════════════════\n');
  console.log(`Data: ${new Date().toLocaleString()}\n`);

  // 1. Buscar todos os usuários com telegram_id
  console.log('1️⃣ Buscando usuários com telegram_id...\n');

  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, name, email, telegram_id, telegram_chat_id, created_at')
    .not('telegram_id', 'is', null);

  if (usersError) {
    console.error('❌ Erro ao buscar usuários:', usersError);
    return;
  }

  console.log(`✅ Encontrados ${users.length} usuários com telegram_id\n`);

  // 2. Para cada usuário, verificar se tem token válido
  const usersWithoutTokens = [];
  const usersWithExpiredTokens = [];
  const usersWithValidTokens = [];

  for (const user of users) {
    // Buscar tokens do usuário
    const { data: tokens } = await supabase
      .from('auto_login_tokens')
      .select('token, expires_at, created_at')
      .eq('user_id', user.id)
      .eq('telegram_id', user.telegram_id)
      .order('created_at', { ascending: false });

    if (!tokens || tokens.length === 0) {
      // Usuário sem token
      usersWithoutTokens.push(user);
    } else {
      // Verificar se tem token válido (não expirado)
      const validTokens = tokens.filter(t => new Date(t.expires_at) > new Date());

      if (validTokens.length === 0) {
        // Todos os tokens expiraram
        usersWithExpiredTokens.push({
          user,
          lastToken: tokens[0],
        });
      } else {
        // Tem pelo menos um token válido
        usersWithValidTokens.push({
          user,
          validTokenCount: validTokens.length,
          nextExpiry: validTokens[0].expires_at,
        });
      }
    }
  }

  // 3. Relatório de problemas
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📊 RELATÓRIO DE MONITORAMENTO');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log(`Total de usuários com telegram_id: ${users.length}\n`);

  console.log(`✅ Usuários com tokens válidos: ${usersWithValidTokens.length}`);
  console.log(`⚠️  Usuários com tokens expirados: ${usersWithExpiredTokens.length}`);
  console.log(`❌ Usuários SEM tokens: ${usersWithoutTokens.length}\n`);

  // 4. Detalhar problemas
  if (usersWithoutTokens.length > 0) {
    console.log('─────────────────────────────────────────────────────────────');
    console.log(`❌ USUÁRIOS SEM TOKENS (${usersWithoutTokens.length}):`);
    console.log('─────────────────────────────────────────────────────────────\n');

    usersWithoutTokens.forEach((user, idx) => {
      console.log(`${idx + 1}. ${user.name || user.email}`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Telegram ID: ${user.telegram_id}`);
      console.log(`   Telegram Chat ID: ${user.telegram_chat_id || 'N/A'}`);
      console.log(`   Cadastrado em: ${new Date(user.created_at).toLocaleString()}`);
      console.log('');
    });

    console.log('⚠️  AÇÃO NECESSÁRIA:');
    console.log('   Execute: node create-missing-tokens.js\n');
  }

  if (usersWithExpiredTokens.length > 0) {
    console.log('─────────────────────────────────────────────────────────────');
    console.log(`⚠️  USUÁRIOS COM TOKENS EXPIRADOS (${usersWithExpiredTokens.length}):`);
    console.log('─────────────────────────────────────────────────────────────\n');

    usersWithExpiredTokens.forEach((item, idx) => {
      const { user, lastToken } = item;
      console.log(`${idx + 1}. ${user.name || user.email}`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Telegram ID: ${user.telegram_id}`);
      console.log(`   Último token expirou em: ${new Date(lastToken.expires_at).toLocaleString()}`);
      console.log('');
    });

    console.log('⚠️  AÇÃO NECESSÁRIA:');
    console.log('   Execute: node create-missing-tokens.js\n');
  }

  // 5. Verificar compras pagas sem entrega
  console.log('─────────────────────────────────────────────────────────────');
  console.log('📦 Verificando compras pagas sem logs de entrega...');
  console.log('─────────────────────────────────────────────────────────────\n');

  const { data: paidPurchases } = await supabase
    .from('purchases')
    .select('id, user_id, created_at')
    .eq('status', 'paid')
    .order('created_at', { ascending: false })
    .limit(100);

  if (paidPurchases && paidPurchases.length > 0) {
    const purchasesWithoutDelivery = [];

    for (const purchase of paidPurchases) {
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

    if (purchasesWithoutDelivery.length > 0) {
      console.log(`⚠️  ${purchasesWithoutDelivery.length} compra(s) paga(s) sem log de entrega!\n`);

      purchasesWithoutDelivery.slice(0, 10).forEach((purchase, idx) => {
        console.log(`${idx + 1}. Compra ID: ${purchase.id.substring(0, 8)}...`);
        console.log(`   User ID: ${purchase.user_id}`);
        console.log(`   Data: ${new Date(purchase.created_at).toLocaleString()}`);
        console.log('');
      });

      if (purchasesWithoutDelivery.length > 10) {
        console.log(`... e mais ${purchasesWithoutDelivery.length - 10} compras\n`);
      }

      console.log('⚠️  AÇÃO NECESSÁRIA:');
      console.log('   Execute: node deliver-pending-purchases.js\n');
    } else {
      console.log('✅ Todas as compras pagas têm logs de entrega!\n');
    }
  }

  // 6. Resumo e recomendações
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📋 RESUMO E RECOMENDAÇÕES');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const hasProblems = usersWithoutTokens.length > 0 || usersWithExpiredTokens.length > 0;

  if (hasProblems) {
    console.log('⚠️  PROBLEMAS DETECTADOS:\n');

    if (usersWithoutTokens.length > 0) {
      console.log(`   • ${usersWithoutTokens.length} usuário(s) sem tokens de auto-login`);
    }

    if (usersWithExpiredTokens.length > 0) {
      console.log(`   • ${usersWithExpiredTokens.length} usuário(s) com tokens expirados`);
    }

    console.log('\n📝 AÇÕES RECOMENDADAS:');
    console.log('   1. Execute: node create-missing-tokens.js');
    console.log('   2. Configure este script para rodar diariamente (cron job)');
    console.log('   3. Monitore os logs do sistema em system_logs\n');
  } else {
    console.log('✅ TUDO OK!');
    console.log('   Todos os usuários têm tokens válidos de auto-login.\n');
    console.log('📝 RECOMENDAÇÕES:');
    console.log('   • Configure este script para rodar diariamente');
    console.log('   • Monitore regularmente o sistema para prevenir problemas\n');
  }

  console.log('═══════════════════════════════════════════════════════════════\n');

  // 7. Salvar log de monitoramento
  await supabase.from('system_logs').insert({
    type: 'monitoring',
    level: hasProblems ? 'warn' : 'info',
    message: `Auto-login token monitoring: ${usersWithValidTokens.length} OK, ${usersWithoutTokens.length} missing, ${usersWithExpiredTokens.length} expired`,
  });
}

monitorMissingTokens().catch(error => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});
