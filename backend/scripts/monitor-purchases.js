/**
 * Script de monitoramento de compras em tempo real
 * Detecta novas compras e alerta sobre padrões suspeitos
 *
 * USO: node scripts/monitor-purchases.js
 *
 * CTRL+C para parar
 */

require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const CHECK_INTERVAL = 10000; // 10 segundos
let lastCheckTime = new Date();
let purchaseCount = 0;

async function checkForNewPurchases() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Buscar compras criadas após o último check
  const { data: newPurchases, error } = await supabase
    .from('purchases')
    .select('id, user_id, content_id, amount_cents, status, payment_method, created_at')
    .gte('created_at', lastCheckTime.toISOString())
    .order('created_at', { ascending: true });

  if (error) {
    console.error('❌ Erro ao buscar compras:', error.message);
    return;
  }

  if (newPurchases && newPurchases.length > 0) {
    console.log(`\n🔔 ${newPurchases.length} NOVA(S) COMPRA(S) DETECTADA(S):`);

    // Buscar dados de usuários e conteúdos
    const userIds = [...new Set(newPurchases.map(p => p.user_id).filter(Boolean))];
    const contentIds = [...new Set(newPurchases.map(p => p.content_id).filter(Boolean))];

    const { data: users } = await supabase
      .from('users')
      .select('id, email, name, telegram_id')
      .in('id', userIds);

    const { data: contents } = await supabase
      .from('content')
      .select('id, title')
      .in('id', contentIds);

    const userMap = new Map(users?.map(u => [u.id, u]) || []);
    const contentMap = new Map(contents?.map(c => [c.id, c]) || []);

    newPurchases.forEach((purchase, index) => {
      purchaseCount++;
      const user = userMap.get(purchase.user_id);
      const content = contentMap.get(purchase.content_id);

      console.log(`\n  ${index + 1}. ID: ${purchase.id.substring(0, 8)}...`);
      console.log(`     Usuário: ${user?.name || user?.email || 'N/A'}`);
      console.log(`     Telegram ID: ${user?.telegram_id || 'N/A'}`);
      console.log(`     Conteúdo: ${content?.title || 'N/A'}`);
      console.log(`     Valor: R$ ${(purchase.amount_cents / 100).toFixed(2)}`);
      console.log(`     Status: ${purchase.status}`);
      console.log(`     Método: ${purchase.payment_method || 'NULL ⚠️'}`);
      console.log(`     Criado: ${new Date(purchase.created_at).toLocaleString('pt-BR')}`);

      // Alertas de padrões suspeitos
      if (purchase.payment_method === null && purchase.status === 'PAID') {
        console.log(`     ⚠️  ALERTA: Padrão suspeito (payment_method NULL + status PAID)`);
      }
    });

    // Detectar compras simultâneas
    const timestamps = newPurchases.map(p => new Date(p.created_at).getTime());
    let simultaneousCount = 0;
    for (let i = 0; i < timestamps.length - 1; i++) {
      if (Math.abs(timestamps[i] - timestamps[i + 1]) < 1000) {
        simultaneousCount++;
      }
    }

    if (simultaneousCount > 0) {
      console.log(`\n     ⚠️  ${simultaneousCount} compra(s) criadas quase simultaneamente!`);
      console.log(`        Possível criação em batch ou automática`);
    }
  }

  lastCheckTime = new Date();
}

async function main() {
  console.log('🚀 Monitor de Compras Iniciado');
  console.log('⏰ Verificando a cada', CHECK_INTERVAL / 1000, 'segundos');
  console.log('🛑 Pressione CTRL+C para parar\n');

  // Check inicial
  await checkForNewPurchases();

  // Loop de verificação
  setInterval(async () => {
    const now = new Date();
    const elapsed = Math.floor((now - lastCheckTime) / 1000);

    process.stdout.write(`\r⏱️  Monitorando... (${elapsed}s) | Total monitorado: ${purchaseCount} compras`);

    await checkForNewPurchases();
  }, CHECK_INTERVAL);
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n✅ Monitor encerrado');
  console.log(`📊 Total de compras detectadas: ${purchaseCount}`);
  process.exit(0);
});

main().catch(console.error);
