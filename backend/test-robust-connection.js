require('dotenv').config();
const { Pool } = require('pg');
const dns = require('dns');

// Configurar DNS para preferir IPv4
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1', '1.0.0.1']);

console.log('🚀 Testando conexão robusta com Supabase...');
console.log('📊 Configurações aplicadas:');
console.log('   - DNS: IPv4 preferencial');
console.log('   - Servidores DNS: Google, Cloudflare');
console.log('   - Pool de conexões: 2-20 conexões');
console.log('   - Timeout: 10 segundos');
console.log('   - Retry: 5 tentativas');

const connectionString = process.env.SUPABASE_DATABASE_URL;

if (!connectionString) {
  console.error('❌ SUPABASE_DATABASE_URL não está configurada no .env');
  process.exit(1);
}

// Criar pool com configurações robustas
const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false,
  },
  // Configurações de pool otimizadas
  max: 20, // máximo de conexões no pool
  min: 2,  // mínimo de conexões mantidas
  idleTimeoutMillis: 30000, // 30 segundos
  connectionTimeoutMillis: 10000, // 10 segundos para conectar
  
  // Configurações de keep-alive
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

// Event listeners para monitoramento
pool.on('connect', (client) => {
  console.log('✅ Nova conexão estabelecida com Supabase');
});

pool.on('error', (err) => {
  console.error('❌ Erro no pool de conexões:', err.message);
});

pool.on('remove', () => {
  console.log('🔄 Conexão removida do pool');
});

async function testConnection(retries = 5) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`\n🔄 Tentativa ${attempt}/${retries}...`);
      
      const client = await pool.connect();
      console.log('✅ Conexão obtida do pool');
      
      const result = await client.query(`
        SELECT 
          NOW() as current_time,
          current_database() as database_name,
          current_user as user_name,
          version() as pg_version
      `);
      
      console.log('📊 Informações do banco:');
      console.log('   - Timestamp:', result.rows[0].current_time);
      console.log('   - Database:', result.rows[0].database_name);
      console.log('   - User:', result.rows[0].user_name);
      console.log('   - Version:', result.rows[0].pg_version.split(' ')[0]);
      
      client.release();
      console.log('✅ Conexão liberada para o pool');
      
      // Mostrar estatísticas do pool
      console.log('📈 Estatísticas do pool:');
      console.log('   - Total:', pool.totalCount);
      console.log('   - Idle:', pool.idleCount);
      console.log('   - Waiting:', pool.waitingCount);
      
      return true;
      
    } catch (error) {
      console.error(`❌ Tentativa ${attempt} falhou:`, error.code, error.message);
      
      if (attempt === retries) {
        console.log('\n💡 Diagnóstico de problemas:');
        
        if (error.code === 'ENOTFOUND') {
          console.log('🔍 Problema: DNS não consegue resolver o hostname');
          console.log('   - Verificar conectividade com internet');
          console.log('   - Verificar se o projeto Supabase está ativo');
          console.log('   - Verificar se a URL está correta');
        } else if (error.code === 'ENETUNREACH') {
          console.log('🔍 Problema: Rede não consegue alcançar o servidor');
          console.log('   - Verificar configurações de IPv6');
          console.log('   - Verificar firewall/proxy');
          console.log('   - Tentar rede diferente ou VPN');
        } else if (error.code === 'ECONNREFUSED') {
          console.log('🔍 Problema: Conexão recusada pelo servidor');
          console.log('   - Verificar se o serviço está rodando');
          console.log('   - Verificar credenciais de acesso');
        } else if (error.code === 'ETIMEDOUT') {
          console.log('🔍 Problema: Timeout na conexão');
          console.log('   - Verificar latência da rede');
          console.log('   - Verificar se há bloqueios de ISP');
        }
        
        return false;
      }
      
      // Aguardar antes da próxima tentativa
      await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
    }
  }
  
  return false;
}

// Executar teste
testConnection().then(async (success) => {
  if (success) {
    console.log('\n🎉 Sistema pronto para produção com Supabase!');
    console.log('✅ Conectividade estabelecida com sucesso');
    console.log('✅ Pool de conexões funcionando');
    console.log('✅ Configurações DNS aplicadas');
  } else {
    console.log('\n❌ Falha na conectividade com Supabase');
    console.log('💡 Verifique as sugestões de diagnóstico acima');
  }
  
  // Fechar pool
  await pool.end();
  console.log('🔒 Pool de conexões fechado');
  
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('💥 Erro durante o teste:', error.message);
  process.exit(1);
});