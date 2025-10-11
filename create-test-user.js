const axios = require('axios');

const API_URL = 'http://localhost:3001/api/v1';
const SUPABASE_URL = 'https://ysohboybpmnwqbumhtim.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlzb2hib3licG1ud3FidW1odGltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mjc0NjM1MDIsImV4cCI6MjA0MzAzOTUwMn0.DnlLbG4wJXYrJv8lF11ZWSC1NhW3PYnfmemMXyGabOI';

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
  console.log('🔐 Criando usuário de teste...\n');

  try {
    // 1. Criar usuário no Supabase Auth
    console.log(`📧 Email: ${EMAIL}`);
    console.log(`🔑 Senha: ${PASSWORD}\n`);

    const signUpResponse = await axios.post(
      `${SUPABASE_URL}/auth/v1/signup`,
      {
        email: EMAIL,
        password: PASSWORD,
        data: {
          full_name: 'Usuário Teste',
          role: 'user'
        }
      },
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    const userId = signUpResponse.data.user.id;
    const accessToken = signUpResponse.data.access_token;

    console.log(`✅ Usuário criado com sucesso!`);
    console.log(`   User ID: ${userId}\n`);

    // 2. Criar compras para cada filme
    console.log(`🎬 Adicionando filmes à biblioteca do usuário...\n`);

    for (const movie of MOVIES) {
      try {
        // Criar compra
        const purchaseResponse = await axios.post(
          `${SUPABASE_URL}/rest/v1/purchase`,
          {
            user_id: userId,
            content_id: movie.id,
            amount_cents: movie.price_cents,
            currency: 'BRL',
            payment_status: 'completed',
            purchase_type: 'direct',
            platform: 'web',
            expires_at: null // Compra permanente
          },
          {
            headers: {
              'apikey': SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=representation'
            }
          }
        );

        console.log(`✅ ${movie.title} adicionado à biblioteca`);
      } catch (error) {
        console.log(`⚠️  Erro ao adicionar ${movie.title}:`, error.response?.data || error.message);
      }
    }

    console.log(`\n✨ Usuário de teste criado com sucesso!\n`);
    console.log(`📋 Credenciais:`);
    console.log(`   Email: ${EMAIL}`);
    console.log(`   Senha: ${PASSWORD}\n`);
    console.log(`🎬 Filmes disponíveis:`);
    MOVIES.forEach(movie => console.log(`   - ${movie.title}`));

  } catch (error) {
    if (error.response?.status === 400 && error.response?.data?.msg?.includes('already registered')) {
      console.log(`⚠️  Usuário ${EMAIL} já existe!`);
      console.log(`\n📋 Credenciais:`);
      console.log(`   Email: ${EMAIL}`);
      console.log(`   Senha: ${PASSWORD}`);
    } else {
      console.error(`\n❌ Erro ao criar usuário:`, error.response?.data || error.message);
    }
  }
}

createTestUser();
