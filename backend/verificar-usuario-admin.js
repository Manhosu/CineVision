require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verificarUsuarioAdmin() {
  console.log('🔍 Verificando usuários admin...\n');

  // Buscar todos os usuários
  const { data: users, error } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Erro ao buscar usuários:', error);
    return;
  }

  console.log(`📊 Total de usuários: ${users.length}\n`);

  // Filtrar admins
  const admins = users.filter(u => u.role === 'admin');

  if (admins.length === 0) {
    console.log('⚠️  NENHUM USUÁRIO ADMIN ENCONTRADO!\n');
    console.log('Para criar um admin, execute:\n');
    console.log('  1. Faça login como usuário normal');
    console.log('  2. Execute este script novamente para ver seu user_id');
    console.log('  3. Rode: node promover-usuario-admin.js <user_id>\n');
  } else {
    console.log(`✅ Usuários ADMIN (${admins.length}):`);
    console.log('─'.repeat(80));
    admins.forEach((admin, index) => {
      console.log(`${index + 1}. ${admin.email || admin.name || 'Sem nome'}`);
      console.log(`   ID: ${admin.id}`);
      console.log(`   Role: ${admin.role}`);
      console.log(`   Email: ${admin.email || 'N/A'}`);
      console.log(`   Telegram ID: ${admin.telegram_id || 'N/A'}`);
      console.log(`   Criado em: ${new Date(admin.created_at).toLocaleString('pt-BR')}`);
      console.log('');
    });
  }

  // Mostrar todos os usuários para referência
  console.log('\n📋 Todos os usuários:');
  console.log('─'.repeat(80));
  users.forEach((user, index) => {
    console.log(`${index + 1}. ${user.email || user.name || 'Sem nome'} - Role: ${user.role || 'user'} (ID: ${user.id.substring(0, 8)}...)`);
  });

  console.log('\n✅ Verificação concluída!\n');
}

verificarUsuarioAdmin().catch(console.error);
