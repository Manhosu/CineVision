const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://szghyvnbmjlquznxhqum.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6Z2h5dm5ibWpscXV6bnhocXVtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODc0OTk5OSwiZXhwIjoyMDc0MzI1OTk5fQ.p9_G_CjLg8h2CVZqteKLdK9WUFKFdXSqTuTolHFiWGc';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTokenErrors() {
  console.log('🔍 Buscando erros relacionados à criação de tokens de auto-login\n');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Buscar logs relacionados a tokens nas últimas 48 horas
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

  console.log('1️⃣ Buscando logs com palavras-chave: "token", "auto-login", "generatePermanentToken"');
  console.log('─────────────────────────────────────────────────────────────\n');

  const keywords = [
    'token',
    'auto-login',
    'generatePermanentToken',
    'Failed to generate',
    'Error generating'
  ];

  for (const keyword of keywords) {
    const { data: logs } = await supabase
      .from('system_logs')
      .select('created_at, level, type, message')
      .ilike('message', `%${keyword}%`)
      .gte('created_at', twoDaysAgo)
      .order('created_at', { ascending: false })
      .limit(20);

    if (logs && logs.length > 0) {
      console.log(`\n📋 Logs contendo "${keyword}" (${logs.length} encontrados):`);
      console.log('─────────────────────────────────────────────────────────────');

      logs.forEach((log, idx) => {
        if (idx < 10) { // Mostrar apenas os 10 mais recentes
          console.log(`[${new Date(log.created_at).toLocaleString()}] ${log.level.toUpperCase()} (${log.type})`);
          console.log(`   ${log.message}`);
          console.log('');
        }
      });
    }
  }

  // Buscar especificamente logs de erro ou warning
  console.log('\n2️⃣ Buscando todos os logs de ERRO (error level)');
  console.log('─────────────────────────────────────────────────────────────\n');

  const { data: errorLogs } = await supabase
    .from('system_logs')
    .select('created_at, type, message')
    .eq('level', 'error')
    .gte('created_at', twoDaysAgo)
    .order('created_at', { ascending: false })
    .limit(30);

  if (errorLogs && errorLogs.length > 0) {
    console.log(`✅ Encontrados ${errorLogs.length} logs de erro:\n`);
    errorLogs.forEach((log, idx) => {
      console.log(`${idx + 1}. [${new Date(log.created_at).toLocaleString()}] (${log.type})`);
      console.log(`   ${log.message}`);
      console.log('');
    });
  } else {
    console.log('✅ Nenhum log de erro encontrado nas últimas 48 horas.\n');
  }

  // Buscar logs de warning
  console.log('\n3️⃣ Buscando todos os logs de WARNING (warn level)');
  console.log('─────────────────────────────────────────────────────────────\n');

  const { data: warnLogs } = await supabase
    .from('system_logs')
    .select('created_at, type, message')
    .eq('level', 'warn')
    .gte('created_at', twoDaysAgo)
    .order('created_at', { ascending: false })
    .limit(30);

  if (warnLogs && warnLogs.length > 0) {
    console.log(`✅ Encontrados ${warnLogs.length} logs de warning:\n`);
    warnLogs.forEach((log, idx) => {
      console.log(`${idx + 1}. [${new Date(log.created_at).toLocaleString()}] (${log.type})`);
      console.log(`   ${log.message}`);
      console.log('');
    });
  } else {
    console.log('✅ Nenhum log de warning encontrado nas últimas 48 horas.\n');
  }

  // Buscar logs de entrega especificamente nas datas das compras do Rafa
  console.log('\n4️⃣ Buscando logs de entrega para as compras do Rafa (31/10/2025)');
  console.log('─────────────────────────────────────────────────────────────\n');

  const rafaPurchaseIds = [
    'c4a962dc-a1e4-4822-b970-2552e0900eab',
    '3371525c-839e-4a39-9c82-53e1b49193d5',
    '756035e6-7a81-4bb9-b69f-de24fc431ae1'
  ];

  for (const purchaseId of rafaPurchaseIds) {
    const { data: purchaseLogs } = await supabase
      .from('system_logs')
      .select('created_at, level, type, message')
      .ilike('message', `%${purchaseId}%`)
      .order('created_at', { ascending: false });

    console.log(`\n📦 Logs para compra ${purchaseId.substring(0, 8)}...:`);

    if (purchaseLogs && purchaseLogs.length > 0) {
      purchaseLogs.forEach(log => {
        console.log(`   [${new Date(log.created_at).toLocaleString()}] ${log.level.toUpperCase()}`);
        console.log(`   ${log.message}`);
      });
    } else {
      console.log('   ⚠️  Nenhum log encontrado');
    }
    console.log('');
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('📊 ANÁLISE CONCLUÍDA');
  console.log('═══════════════════════════════════════════════════════════════\n');
}

checkTokenErrors().catch(error => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});
