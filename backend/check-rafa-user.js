const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://szghyvnbmjlquznxhqum.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6Z2h5dm5ibWpscXV6bnhocXVtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODc0OTk5OSwiZXhwIjoyMDc0MzI1OTk5fQ.p9_G_CjLg8h2CVZqteKLdK9WUFKFdXSqTuTolHFiWGc';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRafaUser() {
  console.log('🔍 DIAGNÓSTICO: Verificando dados do usuário Rafa Gomes\n');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const telegramId = '6543183277';

  // 1. Buscar usuário pelo telegram_id
  console.log('1️⃣ Buscando usuário por telegram_id:', telegramId);
  console.log('─────────────────────────────────────────────────────────────\n');

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('telegram_id', telegramId)
    .single();

  if (userError) {
    console.log('❌ ERRO ao buscar usuário:', userError.message);
    console.log('\n⚠️  Possível causa: telegram_id não existe ou há múltiplos registros\n');

    // Tentar buscar por nome
    console.log('🔎 Tentando buscar por nome "Rafa Gomes"...\n');
    const { data: usersByName } = await supabase
      .from('users')
      .select('*')
      .ilike('name', '%Rafa%Gomes%');

    if (usersByName && usersByName.length > 0) {
      console.log(`✅ Encontrados ${usersByName.length} usuário(s) com nome similar:\n`);
      usersByName.forEach((u, idx) => {
        console.log(`Usuário ${idx + 1}:`);
        console.log(`   ID: ${u.id}`);
        console.log(`   Nome: ${u.name}`);
        console.log(`   Email: ${u.email || 'N/A'}`);
        console.log(`   Telegram ID: ${u.telegram_id || '⚠️  NULL'}`);
        console.log(`   Telegram Chat ID: ${u.telegram_chat_id || '⚠️  NULL'}`);
        console.log(`   Telegram Username: ${u.telegram_username || 'N/A'}`);
        console.log('');
      });
    } else {
      console.log('❌ Nenhum usuário encontrado com nome "Rafa Gomes"\n');
    }
    return;
  }

  if (!user) {
    console.log('❌ Usuário não encontrado com telegram_id:', telegramId);
    return;
  }

  console.log('✅ USUÁRIO ENCONTRADO!\n');
  console.log('📋 Dados Completos do Usuário:');
  console.log('─────────────────────────────────────────────────────────────');
  console.log(`ID: ${user.id}`);
  console.log(`Nome: ${user.name || 'N/A'}`);
  console.log(`Email: ${user.email || 'N/A'}`);
  console.log(`\n📱 Dados do Telegram:`);
  console.log(`   Telegram ID: ${user.telegram_id || '⚠️  NULL - PROBLEMA!'}`);
  console.log(`   Telegram Chat ID: ${user.telegram_chat_id || '⚠️  NULL - PROBLEMA!'}`);
  console.log(`   Telegram Username: @${user.telegram_username || 'N/A'}`);
  console.log(`\n📅 Timestamps:`);
  console.log(`   Criado em: ${new Date(user.created_at).toLocaleString()}`);
  console.log(`   Atualizado em: ${new Date(user.updated_at).toLocaleString()}`);
  console.log('');

  // Análise do problema
  if (!user.telegram_id) {
    console.log('🚨 PROBLEMA IDENTIFICADO: telegram_id está NULL!');
    console.log('   Isso impede a criação de auto-login tokens.\n');
  } else {
    console.log('✅ telegram_id está populado corretamente.\n');
  }

  // 2. Buscar tokens de auto-login
  console.log('\n2️⃣ Buscando tokens de auto-login para user_id:', user.id);
  console.log('─────────────────────────────────────────────────────────────\n');

  const { data: tokens, error: tokensError } = await supabase
    .from('auto_login_tokens')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (tokensError) {
    console.log('❌ ERRO ao buscar tokens:', tokensError.message);
  } else if (!tokens || tokens.length === 0) {
    console.log('❌ NENHUM TOKEN ENCONTRADO!');
    console.log('   Este usuário não possui tokens de auto-login.\n');
  } else {
    console.log(`✅ Encontrados ${tokens.length} token(s):\n`);
    tokens.forEach((token, idx) => {
      const isExpired = new Date(token.expires_at) < new Date();
      console.log(`Token ${idx + 1}:`);
      console.log(`   Token: ${token.token.substring(0, 30)}...`);
      console.log(`   Telegram ID: ${token.telegram_id}`);
      console.log(`   Criado: ${new Date(token.created_at).toLocaleString()}`);
      console.log(`   Expira: ${new Date(token.expires_at).toLocaleString()} ${isExpired ? '❌ EXPIRADO' : '✅ VÁLIDO'}`);
      console.log(`   Usado: ${token.is_used ? 'Sim' : 'Não'}`);
      console.log(`   Redirect: ${token.redirect_url || 'N/A'}`);
      console.log('');
    });
  }

  // 3. Buscar compras do usuário
  console.log('\n3️⃣ Buscando compras do usuário');
  console.log('─────────────────────────────────────────────────────────────\n');

  const { data: purchases, error: purchasesError } = await supabase
    .from('purchases')
    .select('id, content_id, status, amount_cents, payment_method, created_at, updated_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (purchasesError) {
    console.log('❌ ERRO ao buscar compras:', purchasesError.message);
  } else if (!purchases || purchases.length === 0) {
    console.log('⚠️  Nenhuma compra encontrada para este usuário.');
  } else {
    console.log(`✅ Encontradas ${purchases.length} compra(s):\n`);

    let totalPago = 0;
    purchases.forEach((purchase, idx) => {
      console.log(`Compra ${idx + 1}:`);
      console.log(`   ID: ${purchase.id}`);
      console.log(`   Content ID: ${purchase.content_id}`);
      console.log(`   Status: ${purchase.status}`);
      console.log(`   Valor: R$ ${(purchase.amount_cents / 100).toFixed(2)}`);
      console.log(`   Método: ${purchase.payment_method || 'N/A'}`);
      console.log(`   Criada: ${new Date(purchase.created_at).toLocaleString()}`);
      console.log(`   Atualizada: ${new Date(purchase.updated_at).toLocaleString()}`);
      console.log('');

      if (purchase.status === 'paid') {
        totalPago += purchase.amount_cents;
      }
    });

    console.log(`💰 Total pago: R$ ${(totalPago / 100).toFixed(2)}\n`);
  }

  // 4. Verificar logs de entrega
  console.log('\n4️⃣ Verificando logs de entrega');
  console.log('─────────────────────────────────────────────────────────────\n');

  const purchaseIds = purchases?.filter(p => p.status === 'paid').map(p => p.id) || [];

  if (purchaseIds.length > 0) {
    for (const purchaseId of purchaseIds) {
      const { data: logs } = await supabase
        .from('system_logs')
        .select('created_at, level, message')
        .eq('type', 'delivery')
        .ilike('message', `%${purchaseId}%`)
        .order('created_at', { ascending: false })
        .limit(1);

      if (logs && logs.length > 0) {
        console.log(`✅ Log encontrado para compra ${purchaseId.substring(0, 8)}...`);
        console.log(`   [${new Date(logs[0].created_at).toLocaleString()}] ${logs[0].message}`);
      } else {
        console.log(`⚠️  Sem logs de entrega para compra ${purchaseId.substring(0, 8)}...`);
      }
    }
  } else {
    console.log('⚠️  Nenhuma compra paga para verificar logs.');
  }

  // RESUMO FINAL
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('📊 RESUMO DO DIAGNÓSTICO');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log(`Usuário ID: ${user.id}`);
  console.log(`Nome: ${user.name}`);
  console.log(`\n🔑 Status do Auto-Login:`);
  console.log(`   Telegram ID populado: ${user.telegram_id ? '✅ SIM' : '❌ NÃO - PROBLEMA!'}`);
  console.log(`   Tokens existentes: ${tokens && tokens.length > 0 ? `✅ ${tokens.length}` : '❌ NENHUM'}`);

  console.log(`\n💳 Status de Compras:`);
  console.log(`   Total de compras: ${purchases?.length || 0}`);
  console.log(`   Compras pagas: ${purchases?.filter(p => p.status === 'paid').length || 0}`);
  console.log(`   Total pago: R$ ${((purchases?.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount_cents, 0) || 0) / 100).toFixed(2)}`);

  console.log(`\n📦 Status de Entrega:`);
  const deliveredCount = purchaseIds.length; // Assumindo que todos com log foram entregues
  console.log(`   Entregas registradas: ${deliveredCount > 0 ? `✅ ${deliveredCount}` : '⚠️  0'}`);

  console.log('\n═══════════════════════════════════════════════════════════════\n');

  // AÇÃO RECOMENDADA
  if (!user.telegram_id) {
    console.log('🚨 AÇÃO NECESSÁRIA: Atualizar telegram_id do usuário!');
    console.log(`   O campo telegram_id está NULL, o que impede a criação de tokens.`);
    console.log(`   Isso deve ser corrigido no código de cadastro/atualização do usuário.\n`);
  } else if (!tokens || tokens.length === 0) {
    console.log('⚠️  AÇÃO NECESSÁRIA: Criar token de auto-login para este usuário!');
    console.log(`   O usuário tem telegram_id válido mas não tem tokens.`);
    console.log(`   Execute o script create-missing-tokens.js para corrigir.\n`);
  } else {
    console.log('✅ Usuário está configurado corretamente!');
    console.log('   Possui telegram_id e tokens de auto-login.\n');
  }
}

checkRafaUser().catch(error => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});
