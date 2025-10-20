const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

/**
 * Script para corrigir telegram_chat_id de usuários existentes
 *
 * PROBLEMA:
 * Usuários criados ANTES da migração que adicionou telegram_chat_id
 * não têm esse campo preenchido, impedindo envio de broadcasts.
 *
 * SOLUÇÃO:
 * Para usuários onde telegram_id existe mas telegram_chat_id está vazio,
 * copiar o valor de telegram_id para telegram_chat_id.
 */

async function fixTelegramChatId() {
  console.log('\n🔧 CORRIGINDO TELEGRAM_CHAT_ID DE USUÁRIOS EXISTENTES\n');
  console.log('='.repeat(70));

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // 1. Buscar usuários com telegram_id mas sem telegram_chat_id
  console.log('\n📋 1. BUSCANDO USUÁRIOS AFETADOS...');
  console.log('-'.repeat(70));

  const { data: affectedUsers, error: searchError } = await supabase
    .from('users')
    .select('id, email, name, telegram_id, telegram_chat_id')
    .not('telegram_id', 'is', null)
    .is('telegram_chat_id', null);

  if (searchError) {
    console.error('❌ Erro ao buscar usuários:', searchError);
    return;
  }

  if (!affectedUsers || affectedUsers.length === 0) {
    console.log('✅ Nenhum usuário precisa de correção!');
    console.log('   Todos os usuários com telegram_id já têm telegram_chat_id preenchido.\n');
    return;
  }

  console.log(`⚠️  ${affectedUsers.length} usuário(s) encontrado(s) sem telegram_chat_id:\n`);

  affectedUsers.forEach((user, index) => {
    console.log(`${index + 1}. ${user.email}`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Nome: ${user.name || 'não definido'}`);
    console.log(`   Telegram ID: ${user.telegram_id}`);
    console.log(`   Telegram Chat ID: ${user.telegram_chat_id || 'NULL ❌'}`);
    console.log('');
  });

  // 2. Corrigir cada usuário
  console.log('\n🔨 2. APLICANDO CORREÇÕES...');
  console.log('-'.repeat(70));

  let successCount = 0;
  let errorCount = 0;

  for (const user of affectedUsers) {
    try {
      const { error: updateError } = await supabase
        .from('users')
        .update({
          telegram_chat_id: user.telegram_id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (updateError) {
        console.log(`❌ Erro ao atualizar ${user.email}:`, updateError.message);
        errorCount++;
      } else {
        console.log(`✅ ${user.email} → telegram_chat_id atualizado para ${user.telegram_id}`);
        successCount++;
      }
    } catch (error) {
      console.log(`❌ Exceção ao atualizar ${user.email}:`, error.message);
      errorCount++;
    }
  }

  // 3. Resumo
  console.log('\n📊 3. RESUMO DA OPERAÇÃO');
  console.log('='.repeat(70));
  console.log(`✅ Sucesso: ${successCount} usuário(s)`);
  console.log(`❌ Erro: ${errorCount} usuário(s)`);

  // 4. Verificação final
  if (successCount > 0) {
    console.log('\n🔍 4. VERIFICAÇÃO FINAL...');
    console.log('-'.repeat(70));

    const { data: verifyUsers, error: verifyError } = await supabase
      .from('users')
      .select('id, email, telegram_id, telegram_chat_id')
      .in('id', affectedUsers.map(u => u.id));

    if (!verifyError && verifyUsers) {
      console.log('\n✅ Estado atual dos usuários corrigidos:\n');
      verifyUsers.forEach((user, index) => {
        const status = user.telegram_chat_id ? '✓' : '✗';
        console.log(`${index + 1}. ${user.email}`);
        console.log(`   telegram_id: ${user.telegram_id}`);
        console.log(`   telegram_chat_id: ${user.telegram_chat_id || 'NULL'} ${status}`);
        console.log('');
      });
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('✅ Operação concluída!\n');
}

fixTelegramChatId().catch(console.error);
