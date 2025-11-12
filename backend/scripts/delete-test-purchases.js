/**
 * Script para deletar compras de teste dos IDs de Telegram específicos
 * Telegram IDs: 5212925997 e 2006803983
 *
 * ATENÇÃO: Este script deleta permanentemente as compras. Use com cuidado!
 */

require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const TELEGRAM_IDS = ['5212925997', '2006803983'];

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('🔍 Buscando usuários com Telegram IDs:', TELEGRAM_IDS.join(', '));

  // 1. Buscar usuários por telegram_id
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, email, name, telegram_id, telegram_username')
    .in('telegram_id', TELEGRAM_IDS);

  if (usersError) {
    console.error('❌ Erro ao buscar usuários:', usersError);
    process.exit(1);
  }

  if (!users || users.length === 0) {
    console.log('ℹ️  Nenhum usuário encontrado com esses Telegram IDs');
    return;
  }

  console.log(`✅ Encontrados ${users.length} usuário(s)`);
  users.forEach(user => {
    console.log(`  - ${user.name || user.email} (Telegram: ${user.telegram_id})`);
  });

  const userIds = users.map(u => u.id);

  // 2. Buscar compras desses usuários
  console.log('\n🔍 Buscando compras desses usuários...');

  const { data: purchases, error: purchasesError } = await supabase
    .from('purchases')
    .select('id')
    .in('user_id', userIds);

  if (purchasesError) {
    console.error('❌ Erro ao buscar compras:', purchasesError);
    process.exit(1);
  }

  if (!purchases || purchases.length === 0) {
    console.log('ℹ️  Nenhuma compra encontrada para esses usuários');
    return;
  }

  const totalPurchases = purchases.length;
  console.log(`\n⚠️  ATENÇÃO: ${totalPurchases} compra(s) serão DELETADAS PERMANENTEMENTE!`);
  console.log('\n⏳ Iniciando deleção em 3 segundos...');

  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log('\n🗑️  Deletando compras...\n');

  let deletedCount = 0;
  let failedCount = 0;

  // Deletar em lotes de 10 para evitar timeout
  const batchSize = 10;
  for (let i = 0; i < purchases.length; i += batchSize) {
    const batch = purchases.slice(i, i + batchSize);
    const batchIds = batch.map(p => p.id);

    const { error: deleteError } = await supabase
      .from('purchases')
      .delete()
      .in('id', batchIds);

    if (deleteError) {
      console.error(`❌ Erro ao deletar lote ${i / batchSize + 1}:`, deleteError.message);
      failedCount += batch.length;
    } else {
      deletedCount += batch.length;
      console.log(`✅ Deletado lote ${i / batchSize + 1}/${Math.ceil(purchases.length / batchSize)} (${batch.length} compras)`);
    }
  }

  console.log('\n📊 RESULTADO:');
  console.log(`   ✅ Compras deletadas: ${deletedCount}`);
  if (failedCount > 0) {
    console.log(`   ❌ Falhas: ${failedCount}`);
  }
  console.log(`   📋 Total: ${totalPurchases}`);
}

main().catch(console.error);
