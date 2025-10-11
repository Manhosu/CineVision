const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://szghyvnbmjlquznxhqum.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6Z2h5dm5ibWpscXV6bnhocXVtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODc0OTk5OSwiZXhwIjoyMDc0MzI1OTk5fQ.p9_G_CjLg8h2CVZqteKLdK9WUFKFdXSqTuTolHFiWGc';

const EMAIL = 'cinevision@teste.com';
const PASSWORD = 'teste123';

const MOVIES = [
  {
    id: 'c7ed9623-7bcb-4c13-91b7-6f96b76facd1',
    title: 'Lilo & Stitch',
    price_cents: 698
  },
  {
    id: 'da5a57f3-a4d8-41d7-bffd-3f46042b55ea',
    title: 'A Hora do Mal',
    price_cents: 695
  }
];

async function createTestUser() {
  console.log('🚀 Iniciando criação de usuário de teste...\n');

  // Criar cliente Supabase com service role key
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  try {
    // 1. Criar usuário via Admin API
    console.log('📝 Criando usuário via Supabase Admin API...');
    const { data: userData, error: userError } = await supabase.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: {
        name: 'Usuario Teste'
      }
    });

    if (userError) {
      console.error('❌ Erro ao criar usuário:', userError);
      return;
    }

    console.log('✅ Usuário criado com sucesso!');
    console.log(`   ID: ${userData.user.id}`);
    console.log(`   Email: ${userData.user.email}\n`);

    const userId = userData.user.id;

    // 2. Adicionar compras para os filmes
    console.log('🎬 Adicionando compras dos filmes...');

    for (const movie of MOVIES) {
      const { data: purchaseData, error: purchaseError } = await supabase
        .from('purchases')
        .insert({
          user_id: userId,
          content_id: movie.id,
          amount_cents: movie.price_cents,
          currency: 'BRL',
          status: 'COMPLETED',
          purchase_token: `token-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        })
        .select();

      if (purchaseError) {
        console.error(`❌ Erro ao adicionar compra de "${movie.title}":`, purchaseError);
      } else {
        console.log(`✅ Compra de "${movie.title}" adicionada com sucesso!`);
      }
    }

    console.log('\n🎉 Processo concluído com sucesso!');
    console.log('\n📋 Credenciais de teste:');
    console.log(`   Email: ${EMAIL}`);
    console.log(`   Senha: ${PASSWORD}`);
    console.log(`   User ID: ${userId}`);

  } catch (error) {
    console.error('❌ Erro inesperado:', error);
  }
}

createTestUser();
