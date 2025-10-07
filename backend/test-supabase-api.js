require('dotenv').config();
const https = require('https');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

console.log('🔍 Testando conectividade com API do Supabase...');
console.log('URL:', supabaseUrl);

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Configurações do Supabase não encontradas no .env');
  process.exit(1);
}

// Testar conectividade HTTP com a API do Supabase
const testUrl = `${supabaseUrl}/rest/v1/`;

const options = {
  hostname: new URL(supabaseUrl).hostname,
  port: 443,
  path: '/rest/v1/',
  method: 'GET',
  headers: {
    'apikey': supabaseAnonKey,
    'Authorization': `Bearer ${supabaseAnonKey}`,
    'Content-Type': 'application/json'
  }
};

console.log(`\n🌐 Testando conectividade HTTP para: ${options.hostname}`);

const req = https.request(options, (res) => {
  console.log(`✅ Status HTTP: ${res.statusCode}`);
  console.log(`✅ Headers:`, res.headers);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    if (res.statusCode === 200 || res.statusCode === 401) {
      console.log('✅ API do Supabase está acessível via HTTP!');
      console.log('✅ Isso confirma que o projeto Supabase está ativo');
      
      // Se a API funciona, o problema é específico da conexão PostgreSQL
      console.log('\n💡 Diagnóstico:');
      console.log('   - ✅ Projeto Supabase está ativo');
      console.log('   - ✅ Conectividade HTTP funciona');
      console.log('   - ❌ Problema específico na conexão PostgreSQL (porta 5432)');
      console.log('\n🔧 Possíveis soluções:');
      console.log('   1. Verificar se a porta 5432 não está bloqueada');
      console.log('   2. Verificar configurações de firewall');
      console.log('   3. Tentar usar pooling de conexão');
      console.log('   4. Verificar se há proxy/VPN interferindo');
      
    } else {
      console.log(`❌ Status inesperado: ${res.statusCode}`);
      console.log('Resposta:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Erro na requisição HTTP:', error.message);
  console.log('\n💡 Isso indica problema de conectividade geral');
  console.log('   - Verificar conexão com internet');
  console.log('   - Verificar DNS');
  console.log('   - Verificar firewall/proxy');
});

req.setTimeout(10000, () => {
  console.error('❌ Timeout na requisição HTTP');
  req.destroy();
});

req.end();