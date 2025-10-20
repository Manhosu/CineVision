const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function checkUserTelegramId() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  console.log('\n🔍 Investigando campo telegram_id...\n');

  // Buscar todos os usuários
  const { data: users, error } = await supabase
    .from('users')
    .select('*');

  if (error) {
    console.error('❌ Erro ao buscar usuários:', error);
    return;
  }

  console.log(`Total de usuários: ${users.length}\n`);

  users.forEach((user, index) => {
    console.log(`${index + 1}. User ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Telegram ID (raw): ${JSON.stringify(user.telegram_id)}`);
    console.log(`   Telegram ID (type): ${typeof user.telegram_id}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Created: ${user.created_at}`);
    console.log('');
  });

  // Verificar se há algum usuário com telegram_id não nulo
  const usersWithTelegram = users.filter(u => u.telegram_id != null && u.telegram_id !== '');
  console.log(`\n✅ Usuários com telegram_id preenchido: ${usersWithTelegram.length}`);

  if (usersWithTelegram.length > 0) {
    console.log('\nDetalhes:');
    usersWithTelegram.forEach(user => {
      console.log(`- ${user.email}: telegram_id = ${user.telegram_id}`);
    });
  }
}

checkUserTelegramId().catch(console.error);
