const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function auditTelegramAuth() {
  console.log('🔍 AUDITORIA: Sistema de Autenticação por Telegram ID\n');
  console.log('='.repeat(70));

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // 1. Verificar estrutura da tabela users
  console.log('\n📋 1. ESTRUTURA DA TABELA USERS');
  console.log('-'.repeat(70));

  const { data: sampleUser, error: userError } = await supabase
    .from('users')
    .select('*')
    .limit(1)
    .single();

  if (sampleUser) {
    console.log('✅ Tabela users acessível');
    console.log('📝 Campos disponíveis:');
    Object.keys(sampleUser).forEach(key => {
      console.log(`   - ${key}: ${typeof sampleUser[key]}`);
    });
  } else {
    console.log('⚠️  Nenhum usuário encontrado na tabela');
  }

  // 2. Verificar usuários com Telegram ID
  console.log('\n\n👥 2. USUÁRIOS COM TELEGRAM ID');
  console.log('-'.repeat(70));

  const { data: telegramUsers, error: telegramError } = await supabase
    .from('users')
    .select('id, name, email, telegram_id, telegram_chat_id, telegram_username, role, status, created_at')
    .not('telegram_id', 'is', null);

  if (telegramUsers && telegramUsers.length > 0) {
    console.log(`✅ ${telegramUsers.length} usuário(s) com Telegram ID encontrado(s):\n`);
    telegramUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name || 'Sem nome'}`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Telegram ID: ${user.telegram_id}`);
      console.log(`   Chat ID: ${user.telegram_chat_id || 'não definido'}`);
      console.log(`   Username: ${user.telegram_username || 'não definido'}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Status: ${user.status}`);
      console.log(`   Criado em: ${new Date(user.created_at).toLocaleString('pt-BR')}`);
      console.log('');
    });
  } else {
    console.log('⚠️  Nenhum usuário com Telegram ID encontrado');
  }

  // 3. Verificar tabela de auto_login_tokens
  console.log('\n🔑 3. TOKENS DE AUTO-LOGIN');
  console.log('-'.repeat(70));

  const { data: tokens, error: tokensError } = await supabase
    .from('auto_login_tokens')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (tokens && tokens.length > 0) {
    console.log(`✅ ${tokens.length} token(s) recente(s) encontrado(s):\n`);
    tokens.forEach((token, index) => {
      const isExpired = new Date(token.expires_at) < new Date();
      const isUsed = token.is_used;
      const status = isUsed ? '✓ Usado' : isExpired ? '⏱ Expirado' : '✓ Válido';

      console.log(`${index + 1}. Token: ${token.token.substring(0, 20)}...`);
      console.log(`   Status: ${status}`);
      console.log(`   User ID: ${token.user_id}`);
      console.log(`   Telegram ID: ${token.telegram_id}`);
      console.log(`   Expira em: ${new Date(token.expires_at).toLocaleString('pt-BR')}`);
      console.log(`   Redirect: ${token.redirect_url || 'nenhum'}`);
      console.log(`   Criado: ${new Date(token.created_at).toLocaleString('pt-BR')}`);
      if (token.used_at) {
        console.log(`   Usado em: ${new Date(token.used_at).toLocaleString('pt-BR')}`);
      }
      console.log('');
    });
  } else {
    console.log('⚠️  Nenhum token encontrado');
  }

  // 4. Verificar compras de usuários do Telegram
  console.log('\n💳 4. COMPRAS DE USUÁRIOS DO TELEGRAM');
  console.log('-'.repeat(70));

  if (telegramUsers && telegramUsers.length > 0) {
    const telegramUserIds = telegramUsers.map(u => u.id);

    const { data: purchases, error: purchasesError } = await supabase
      .from('purchases')
      .select('id, user_id, content_id, status, created_at')
      .in('user_id', telegramUserIds);

    if (purchases && purchases.length > 0) {
      console.log(`✅ ${purchases.length} compra(s) encontrada(s):\n`);

      // Agrupar por usuário
      const purchasesByUser = purchases.reduce((acc, purchase) => {
        if (!acc[purchase.user_id]) {
          acc[purchase.user_id] = [];
        }
        acc[purchase.user_id].push(purchase);
        return acc;
      }, {});

      Object.entries(purchasesByUser).forEach(([userId, userPurchases]) => {
        const user = telegramUsers.find(u => u.id === userId);
        console.log(`👤 ${user?.name || 'Usuário'} (${user?.telegram_id})`);
        console.log(`   Total de compras: ${userPurchases.length}`);
        userPurchases.forEach((p, i) => {
          console.log(`   ${i + 1}. Status: ${p.status} | Conteúdo: ${p.content_id} | ${new Date(p.created_at).toLocaleDateString('pt-BR')}`);
        });
        console.log('');
      });
    } else {
      console.log('⚠️  Nenhuma compra encontrada para usuários do Telegram');
    }
  }

  // 5. Verificar sistema de atividade (se existir)
  console.log('\n📊 5. SISTEMA DE ATIVIDADE');
  console.log('-'.repeat(70));

  if (sampleUser && ('last_active_at' in sampleUser || 'last_login_at' in sampleUser)) {
    console.log('✅ Campo de atividade encontrado na tabela users');

    if (telegramUsers) {
      const activeUsers = telegramUsers.filter(u => u.last_active_at || u.last_login_at);
      console.log(`📈 ${activeUsers.length} usuário(s) com registro de atividade`);
    }
  } else {
    console.log('⚠️  PROBLEMA IDENTIFICADO: Não há campo de tracking de atividade');
    console.log('   Recomendação: Adicionar campos last_active_at e/ou last_login_at');
  }

  // 6. Resumo da auditoria
  console.log('\n\n📝 RESUMO DA AUDITORIA');
  console.log('='.repeat(70));

  const issues = [];
  const successes = [];

  if (telegramUsers && telegramUsers.length > 0) {
    successes.push(`✅ ${telegramUsers.length} usuário(s) autenticado(s) via Telegram ID`);
  } else {
    issues.push('⚠️  Nenhum usuário criado via Telegram ainda');
  }

  if (tokens && tokens.length > 0) {
    const validTokens = tokens.filter(t => !t.is_used && new Date(t.expires_at) > new Date());
    if (validTokens.length > 0) {
      successes.push(`✅ ${validTokens.length} token(s) de auto-login válido(s)`);
    }
  }

  if (!sampleUser || !('last_active_at' in sampleUser || 'last_login_at' in sampleUser)) {
    issues.push('❌ Sistema de tracking de atividade não implementado');
  }

  console.log('\n✨ FUNCIONALIDADES OPERACIONAIS:');
  successes.forEach(s => console.log(`  ${s}`));

  if (issues.length > 0) {
    console.log('\n⚠️  PROBLEMAS IDENTIFICADOS:');
    issues.forEach(i => console.log(`  ${i}`));
  } else {
    console.log('\n🎉 Nenhum problema crítico identificado!');
  }

  console.log('\n' + '='.repeat(70));
  console.log('✅ Auditoria concluída\n');
}

auditTelegramAuth().catch(console.error);
