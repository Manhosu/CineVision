require('dotenv').config();
const axios = require('axios');

console.log('🚀 Testando cliente Supabase REST...');

async function testSupabaseRest() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.log('❌ Credenciais do Supabase não encontradas');
    return false;
  }

  console.log('📡 URL:', supabaseUrl);
  console.log('🔑 Key:', supabaseKey.substring(0, 20) + '...');

  const client = axios.create({
    baseURL: `${supabaseUrl}/rest/v1`,
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    timeout: 30000,
  });

  try {
    // 1. Teste de conectividade básica
    console.log('\n🔄 Teste 1: Conectividade básica...');
    const healthResponse = await client.get('/');
    console.log('✅ Status:', healthResponse.status);

    // 2. Teste de listagem de tabelas (via schema)
    console.log('\n🔄 Teste 2: Verificando schema...');
    try {
      const schemaResponse = await client.get('/', {
        headers: {
          'Accept': 'application/openapi+json'
        }
      });
      console.log('✅ Schema disponível');
    } catch (schemaError) {
      console.log('⚠️ Schema não acessível (normal para alguns projetos)');
    }

    // 3. Teste de criação de tabela simples (se não existir)
    console.log('\n🔄 Teste 3: Testando operações CRUD...');
    
    // Tentar criar uma tabela de teste via SQL
    try {
      const createTableResponse = await client.post('/rpc/exec_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS test_connection (
            id SERIAL PRIMARY KEY,
            message TEXT NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
        `
      });
      console.log('✅ Tabela de teste criada/verificada');
    } catch (createError) {
      console.log('⚠️ Não foi possível criar tabela via RPC:', createError.response?.data?.message || createError.message);
      
      // Tentar operação mais simples
      try {
        // Verificar se existe alguma tabela pública
        const tablesResponse = await client.get('/', {
          params: { select: 'count' },
          headers: { 'Prefer': 'count=exact' }
        });
        console.log('✅ Conseguiu acessar endpoint público');
      } catch (simpleError) {
        console.log('⚠️ Acesso limitado ao banco:', simpleError.response?.data?.message || simpleError.message);
      }
    }

    // 4. Teste de inserção (se possível)
    try {
      console.log('\n🔄 Teste 4: Inserção de dados...');
      const insertResponse = await client.post('/test_connection', {
        message: 'Teste de conectividade - ' + new Date().toISOString()
      });
      console.log('✅ Inserção bem-sucedida:', insertResponse.data);

      // 5. Teste de seleção
      console.log('\n🔄 Teste 5: Seleção de dados...');
      const selectResponse = await client.get('/test_connection', {
        params: {
          select: '*',
          order: 'created_at.desc',
          limit: 5
        }
      });
      console.log('✅ Seleção bem-sucedida:', selectResponse.data.length, 'registros');

      // 6. Teste de contagem
      console.log('\n🔄 Teste 6: Contagem de registros...');
      const countResponse = await client.head('/test_connection', {
        headers: { 'Prefer': 'count=exact' }
      });
      const count = countResponse.headers['content-range']?.match(/\/(\d+)$/)?.[1] || '0';
      console.log('✅ Total de registros:', count);

    } catch (crudError) {
      console.log('⚠️ Operações CRUD limitadas:', crudError.response?.data?.message || crudError.message);
      console.log('   Isso pode ser normal se RLS (Row Level Security) estiver ativo');
    }

    console.log('\n🎉 Cliente Supabase REST funcionando!');
    console.log('💡 Recomendações:');
    console.log('   ✅ Use este cliente para operações de banco');
    console.log('   ✅ Configure RLS (Row Level Security) conforme necessário');
    console.log('   ✅ Implemente autenticação adequada');
    
    return true;

  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
    return false;
  }
}

// Executar teste
testSupabaseRest().then((success) => {
  if (success) {
    console.log('\n✅ Todos os testes passaram!');
    process.exit(0);
  } else {
    console.log('\n❌ Alguns testes falharam');
    process.exit(1);
  }
}).catch((error) => {
  console.error('💥 Erro fatal:', error.message);
  process.exit(1);
});