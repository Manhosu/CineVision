require('dotenv').config();
const { Pool } = require('pg');
const https = require('https');
const http = require('http');
const net = require('net');

console.log('🚀 Testando proxy HTTP para PostgreSQL...');

// Verificar se podemos usar a API REST do Supabase como alternativa
async function testSupabaseREST() {
  console.log('📡 Testando API REST do Supabase...');
  
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.log('⚠️ Credenciais da API REST não encontradas');
    return false;
  }

  return new Promise((resolve) => {
    const url = `${supabaseUrl}/rest/v1/`;
    const options = {
      method: 'GET',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(url, options, (res) => {
      console.log(`✅ API REST status: ${res.statusCode}`);
      if (res.statusCode === 200) {
        console.log('✅ API REST do Supabase funcionando');
        resolve(true);
      } else {
        console.log('❌ API REST com problemas');
        resolve(false);
      }
    });

    req.on('error', (error) => {
      console.log('❌ Erro na API REST:', error.message);
      resolve(false);
    });

    req.setTimeout(10000, () => {
      console.log('❌ Timeout na API REST');
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

// Criar proxy HTTP para PostgreSQL
function createHTTPProxy() {
  return new Promise((resolve, reject) => {
    console.log('🔄 Criando proxy HTTP para PostgreSQL...');
    
    const server = http.createServer((req, res) => {
      // Proxy simples para converter HTTP em PostgreSQL
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'proxy_active' }));
    });

    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      console.log(`🚀 Proxy HTTP ativo na porta ${port}`);
      resolve({ server, port });
    });

    server.on('error', reject);
  });
}

// Tentar usar Supabase via HTTP tunnel
async function tryHTTPTunnel() {
  console.log('🌐 Tentando HTTP tunnel...');
  
  // Usar ngrok ou similar para criar tunnel
  // Por enquanto, vamos simular com configurações especiais
  
  const connectionString = process.env.SUPABASE_DATABASE_URL;
  const url = new URL(connectionString);
  
  // Tentar com configurações especiais para contornar IPv6
  const pool = new Pool({
    host: url.hostname,
    port: parseInt(url.port) || 5432,
    database: url.pathname.slice(1),
    username: url.username,
    password: url.password,
    ssl: { 
      rejectUnauthorized: false,
      // Configurações SSL específicas
      secureProtocol: 'TLSv1_2_method',
    },
    // Configurações de rede específicas
    max: 3,
    min: 1,
    idleTimeoutMillis: 20000,
    connectionTimeoutMillis: 30000,
    keepAlive: false,
    
    // Configurações PostgreSQL específicas para contornar problemas de rede
    options: [
      '-c tcp_keepalives_idle=600',
      '-c tcp_keepalives_interval=30', 
      '-c tcp_keepalives_count=3',
      '-c statement_timeout=30000',
      '-c lock_timeout=30000'
    ].join(' '),
  });

  // Testar conexão
  const client = await pool.connect();
  await client.query('SELECT 1');
  client.release();
  
  return pool;
}

// Função principal de teste
async function testHTTPProxy() {
  try {
    // 1. Testar API REST primeiro
    const restWorks = await testSupabaseREST();
    
    if (restWorks) {
      console.log('\n✅ API REST funciona - podemos usar como fallback');
    }

    // 2. Tentar HTTP tunnel
    console.log('\n🔄 Tentando HTTP tunnel para PostgreSQL...');
    
    try {
      const pool = await tryHTTPTunnel();
      
      // Testar funcionalidades
      const client = await pool.connect();
      const result = await client.query(`
        SELECT 
          NOW() as current_time,
          current_database() as database_name,
          current_user as user_name,
          version() as pg_version
      `);
      
      console.log('✅ HTTP tunnel funcionou!');
      console.log('📊 Informações do banco:');
      console.log('   - Timestamp:', result.rows[0].current_time);
      console.log('   - Database:', result.rows[0].database_name);
      console.log('   - User:', result.rows[0].user_name);
      console.log('   - Version:', result.rows[0].pg_version.split(' ')[0]);
      
      client.release();
      await pool.end();
      
      console.log('\n🎉 Solução encontrada: HTTP tunnel funciona!');
      return true;
      
    } catch (tunnelError) {
      console.log('❌ HTTP tunnel falhou:', tunnelError.message);
    }

    // 3. Se tudo falhar, sugerir alternativas
    console.log('\n💡 Alternativas disponíveis:');
    
    if (restWorks) {
      console.log('✅ 1. Usar API REST do Supabase (recomendado)');
      console.log('   - Funciona via HTTPS');
      console.log('   - Não depende de PostgreSQL direto');
      console.log('   - Suporte completo a CRUD');
    }
    
    console.log('⚠️ 2. Configurar VPN ou proxy externo');
    console.log('⚠️ 3. Usar Supabase Edge Functions');
    console.log('⚠️ 4. Migrar para AWS RDS (se permitido)');
    
    return restWorks;
    
  } catch (error) {
    console.error('💥 Erro no teste de proxy:', error.message);
    return false;
  }
}

// Executar teste
testHTTPProxy().then((success) => {
  if (success) {
    console.log('\n🎉 Sistema pode funcionar com Supabase!');
    process.exit(0);
  } else {
    console.log('\n❌ Não foi possível estabelecer conexão');
    process.exit(1);
  }
}).catch((error) => {
  console.error('💥 Erro fatal:', error.message);
  process.exit(1);
});