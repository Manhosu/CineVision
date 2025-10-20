const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function checkTelegramChatId() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  console.log('\n🔍 Verificando campo telegram_chat_id...\n');

  // Verificar estrutura da tabela
  const { data: sample } = await supabase
    .from('users')
    .select('*')
    .limit(1)
    .single();

  console.log('📋 Campos na tabela users:');
  if (sample) {
    Object.keys(sample).sort().forEach(key => {
      console.log(`   - ${key}`);
    });
  }

  console.log('\n');

  // Verificar se existe telegram_chat_id
  if (sample && 'telegram_chat_id' in sample) {
    console.log('✅ Campo telegram_chat_id EXISTE na tabela\n');

    // Buscar usuário com telegram_id
    const { data: telegramUser } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_id', '2006803983')
      .single();

    if (telegramUser) {
      console.log('👤 Usuário com Telegram ID encontrado:');
      console.log(`   ID: ${telegramUser.id}`);
      console.log(`   Email: ${telegramUser.email}`);
      console.log(`   Telegram ID: ${telegramUser.telegram_id}`);
      console.log(`   Telegram Chat ID: ${telegramUser.telegram_chat_id || 'NÃO DEFINIDO ❌'}`);
      console.log(`   Telegram Username: ${telegramUser.telegram_username || 'NÃO DEFINIDO'}`);
      console.log(`   Name: ${telegramUser.name || 'NÃO DEFINIDO'}`);

      if (!telegramUser.telegram_chat_id) {
        console.log('\n⚠️  PROBLEMA: telegram_chat_id está vazio!');
        console.log('   Isso pode impedir o envio de mensagens pelo bot.');
      }
    }
  } else {
    console.log('❌ Campo telegram_chat_id NÃO EXISTE na tabela');
    console.log('   Isso é um PROBLEMA CRÍTICO!');
    console.log('\n📝 Solução: Executar migração para adicionar campos:');
    console.log('   - telegram_chat_id');
    console.log('   - telegram_username');
    console.log('   - last_active_at');
  }
}

checkTelegramChatId().catch(console.error);
