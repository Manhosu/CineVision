/**
 * Script para listar compras de teste dos IDs de Telegram específicos
 * Telegram IDs: 5212925997 e 2006803983
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

  console.log(`\n✅ Encontrados ${users.length} usuário(s):\n`);
  users.forEach(user => {
    console.log(`  - ID: ${user.id}`);
    console.log(`    Email: ${user.email || 'N/A'}`);
    console.log(`    Nome: ${user.name || 'N/A'}`);
    console.log(`    Telegram ID: ${user.telegram_id}`);
    console.log(`    Telegram Username: ${user.telegram_username || 'N/A'}`);
    console.log('');
  });

  const userIds = users.map(u => u.id);

  // 2. Buscar compras desses usuários
  console.log('🔍 Buscando compras desses usuários...\n');

  const { data: purchases, error: purchasesError } = await supabase
    .from('purchases')
    .select('id, user_id, content_id, amount_cents, currency, status, payment_method, created_at')
    .in('user_id', userIds)
    .order('created_at', { ascending: false });

  if (purchasesError) {
    console.error('❌ Erro ao buscar compras:', purchasesError);
    process.exit(1);
  }

  if (!purchases || purchases.length === 0) {
    console.log('ℹ️  Nenhuma compra encontrada para esses usuários');
    return;
  }

  console.log(`✅ Encontradas ${purchases.length} compra(s):\n`);

  // 3. Buscar conteúdos relacionados
  const contentIds = [...new Set(purchases.map(p => p.content_id).filter(Boolean))];
  const { data: contents } = await supabase
    .from('content')
    .select('id, title')
    .in('id', contentIds);

  const contentMap = new Map(contents?.map(c => [c.id, c.title]) || []);

  purchases.forEach((purchase, index) => {
    const user = users.find(u => u.id === purchase.user_id);
    const contentTitle = contentMap.get(purchase.content_id) || 'N/A';

    console.log(`  ${index + 1}. Compra ID: ${purchase.id}`);
    console.log(`     Usuário: ${user?.name || user?.email || 'N/A'} (Telegram: ${user?.telegram_id})`);
    console.log(`     Conteúdo: ${contentTitle}`);
    console.log(`     Valor: R$ ${(purchase.amount_cents / 100).toFixed(2)}`);
    console.log(`     Status: ${purchase.status}`);
    console.log(`     Método: ${purchase.payment_method || 'N/A'}`);
    console.log(`     Data: ${new Date(purchase.created_at).toLocaleString('pt-BR')}`);
    console.log('');
  });

  console.log('\n📋 RESUMO:');
  console.log(`   Total de usuários: ${users.length}`);
  console.log(`   Total de compras: ${purchases.length}`);
  console.log(`   IDs das compras: ${purchases.map(p => p.id).join(', ')}`);
  console.log('\n💡 Para deletar essas compras, use o script delete-test-purchases.js');
}

main().catch(console.error);
