const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');

const SUPABASE_URL = 'https://szghyvnbmjlquznxhqum.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6Z2h5dm5ibWpscXV6bnhocXVtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODc0OTk5OSwiZXhwIjoyMDc0MzI1OTk5fQ.p9_G_CjLg8h2CVZqteKLdK9WUFKFdXSqTuTolHFiWGc';

const EMAIL = 'cinevision@teste.com';
const PASSWORD = 'teste123';
const AUTH_USER_ID = '84dca2a4-02cd-4dfa-a7df-6f2afcb26027';

async function createUserInUsersTable() {
  console.log('🚀 Criando usuário na tabela users...\n');

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    // 1. Gerar hash da senha com bcrypt (mesma configuração do backend: 12 rounds)
    console.log('🔐 Gerando hash da senha...');
    const passwordHash = await bcrypt.hash(PASSWORD, 12);
    console.log('✅ Hash gerado com sucesso!\n');

    // 2. Inserir usuário na tabela users
    console.log('📝 Inserindo usuário na tabela users...');
    const { data, error } = await supabase
      .from('users')
      .insert({
        id: AUTH_USER_ID, // Usar o mesmo ID do auth.users
        email: EMAIL,
        password_hash: passwordHash,
        role: 'user',
        telegram_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select();

    if (error) {
      console.error('❌ Erro ao criar usuário:', error);
      return;
    }

    console.log('✅ Usuário criado com sucesso na tabela users!');
    console.log('   ID:', data[0].id);
    console.log('   Email:', data[0].email);
    console.log('   Role:', data[0].role);

    console.log('\n📋 Credenciais:');
    console.log('   Email:', EMAIL);
    console.log('   Senha:', PASSWORD);
    console.log('\n🎉 Tudo pronto! Agora você pode fazer login.');

  } catch (error) {
    console.error('❌ Erro inesperado:', error);
  }
}

createUserInUsersTable();
