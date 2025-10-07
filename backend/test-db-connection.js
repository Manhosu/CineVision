require('dotenv').config();
const { Client } = require('pg');
const dns = require('dns');

// Configurar DNS para preferir IPv4
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const connectionString = process.env.SUPABASE_DATABASE_URL;

console.log('🔍 Testando conectividade com Supabase (Configuração Produção)...');
console.log('URL de conexão:', connectionString ? 'Configurada' : 'NÃO CONFIGURADA');

if (!connectionString) {
  console.error('❌ SUPABASE_DATABASE_URL não está configurada no .env');
  process.exit(1);
}

// Extrair hostname da URL
const url = new URL(connectionString);
const hostname = url.hostname;

console.log(`\n🌐 Testando resolução DNS para: ${hostname}`);

// Função para testar conectividade com retry
async function testConnection(retries = 3) {
  for (let i = 0; i < retries; i++) {
    console.log(`\n🔄 Tentativa ${i + 1}/${retries}...`);
    
    const client = new Client({
      connectionString: connectionString,
      ssl: {
        rejectUnauthorized: false
      },
      connectionTimeoutMillis: 10000, // 10 segundos
      query_timeout: 5000, // 5 segundos
    });

    try {
      console.log('🔌 Conectando ao Supabase...');
      await client.connect();
      console.log('✅ Conexão com Supabase estabelecida com sucesso!');
      
      console.log('🔍 Executando query de teste...');
      const result = await client.query('SELECT NOW() as current_time, version() as pg_version');
      console.log('✅ Query de teste executada:', result.rows[0]);
      
      await client.end();
      console.log('✅ Teste de conectividade concluído com sucesso!');
      return true;
      
    } catch (error) {
      console.error(`❌ Tentativa ${i + 1} falhou:`, error.code, error.message);
      
      if (client._connected) {
        await client.end();
      }
      
      if (i === retries - 1) {
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
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

// Executar teste
testConnection().then(success => {
  if (success) {
    console.log('\n🎉 Sistema pronto para produção com Supabase!');
    process.exit(0);
  } else {
    console.log('\n❌ Falha na conectividade com Supabase');
    process.exit(1);
  }
});