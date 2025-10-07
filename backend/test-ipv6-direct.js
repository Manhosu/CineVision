require('dotenv').config();
const { Pool } = require('pg');

console.log('🚀 Testando conexão direta IPv6 com Supabase...');

const originalUrl = process.env.SUPABASE_DATABASE_URL;
console.log('📊 URL original:', originalUrl);

// Extrair componentes da URL
const url = new URL(originalUrl);
console.log('📊 Host original:', url.hostname);
console.log('📊 Porta:', url.port);

// Usar o endereço IPv6 diretamente (obtido do nslookup)
const ipv6Address = '2600:1f1e:75b:4b13:9e75:bf78:b731:9b78';
console.log('📊 Endereço IPv6:', ipv6Address);

// Construir nova URL com IPv6
url.hostname = `[${ipv6Address}]`; // IPv6 precisa estar entre colchetes
const ipv6Url = url.toString();

console.log('📊 URL IPv6:', ipv6Url);

// Criar pool com endereço IPv6 direto
const pool = new Pool({
  connectionString: ipv6Url,
  ssl: {
    rejectUnauthorized: false,
  },
  max: 10,
  min: 1,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

// Event listeners
pool.on('connect', () => {
  console.log('✅ Conexão IPv6 estabelecida com Supabase');
});

pool.on('error', (err) => {
  console.error('❌ Erro no pool IPv6:', err.message);
});

async function testIPv6Connection() {
  try {
    console.log('\n🔄 Tentando conexão IPv6 direta...');
    
    const client = await pool.connect();
    console.log('✅ Conexão IPv6 obtida do pool');
    
    const result = await client.query(`
      SELECT 
        NOW() as current_time,
        current_database() as database_name,
        current_user as user_name,
        inet_server_addr() as server_ip,
        version() as pg_version
    `);
    
    console.log('📊 Informações do banco (IPv6):');
    console.log('   - Timestamp:', result.rows[0].current_time);
    console.log('   - Database:', result.rows[0].database_name);
    console.log('   - User:', result.rows[0].user_name);
    console.log('   - Server IP:', result.rows[0].server_ip);
    console.log('   - Version:', result.rows[0].pg_version.split(' ')[0]);
    
    client.release();
    console.log('✅ Conexão IPv6 liberada para o pool');
    
    console.log('📈 Estatísticas do pool IPv6:');
    console.log('   - Total:', pool.totalCount);
    console.log('   - Idle:', pool.idleCount);
    console.log('   - Waiting:', pool.waitingCount);
    
    return true;
    
  } catch (error) {
    console.error('❌ Falha na conexão IPv6:', error.code, error.message);
    
    console.log('\n💡 Diagnóstico IPv6:');
    if (error.code === 'ENETUNREACH') {
      console.log('🔍 Sistema não suporta IPv6 ou não tem rota IPv6');
      console.log('   - Verificar se IPv6 está habilitado no sistema');
      console.log('   - Verificar se o ISP suporta IPv6');
      console.log('   - Considerar usar proxy/tunnel IPv6');
    } else if (error.code === 'ECONNREFUSED') {
      console.log('🔍 Conexão recusada no endereço IPv6');
      console.log('   - Verificar se o serviço aceita conexões IPv6');
      console.log('   - Verificar firewall IPv6');
    }
    
    return false;
  }
}

// Executar teste
testIPv6Connection().then(async (success) => {
  if (success) {
    console.log('\n🎉 Conexão IPv6 com Supabase funcionando!');
    console.log('✅ Sistema pode usar IPv6 diretamente');
    console.log('💡 Próximo passo: Configurar aplicação para usar IPv6');
  } else {
    console.log('\n❌ Conexão IPv6 não funciona neste ambiente');
    console.log('💡 Será necessário usar proxy/tunnel ou configuração alternativa');
  }
  
  await pool.end();
  console.log('🔒 Pool IPv6 fechado');
  
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('💥 Erro durante teste IPv6:', error.message);
  process.exit(1);
});