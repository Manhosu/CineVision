/**
 * Script para verificar configurações de webhooks e triggers no Supabase
 * que podem estar criando compras automaticamente
 */

require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  console.log('🔍 Verificando configurações do Supabase...\n');

  // Verificar compras recentes com padrão suspeito
  console.log('📊 Verificando padrão de compras duplicadas:\n');

  const { data: recentPurchases, error } = await supabase
    .from('purchases')
    .select('id, content_id, amount_cents, status, payment_method, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('❌ Erro ao buscar compras:', error);
    return;
  }

  // Agrupar por content_id e timestamp
  const groupedByContentAndTime = {};
  recentPurchases.forEach(p => {
    const timeKey = new Date(p.created_at).toISOString().substring(0, 16); // Agrupar por minuto
    const key = `${p.content_id}_${timeKey}`;

    if (!groupedByContentAndTime[key]) {
      groupedByContentAndTime[key] = [];
    }
    groupedByContentAndTime[key].push(p);
  });

  // Identificar duplicatas (múltiplas compras do mesmo conteúdo no mesmo minuto)
  const duplicates = Object.entries(groupedByContentAndTime)
    .filter(([_, purchases]) => purchases.length > 1)
    .map(([key, purchases]) => ({
      content_id: purchases[0].content_id,
      timestamp: purchases[0].created_at,
      count: purchases.length,
      purchases: purchases
    }));

  if (duplicates.length > 0) {
    console.log(`⚠️  ENCONTRADAS ${duplicates.length} OCORRÊNCIAS DE COMPRAS DUPLICADAS:\n`);

    duplicates.slice(0, 5).forEach((dup, index) => {
      console.log(`  ${index + 1}. Content ID: ${dup.content_id}`);
      console.log(`     Timestamp: ${new Date(dup.timestamp).toLocaleString('pt-BR')}`);
      console.log(`     Quantidade: ${dup.count} compras no mesmo minuto`);
      console.log(`     Status: ${dup.purchases[0].status}`);
      console.log(`     Payment Method: ${dup.purchases[0].payment_method || 'NULL'}`);
      console.log(`     Amount: R$ ${(dup.purchases[0].amount_cents / 100).toFixed(2)}`);
      console.log('');
    });
  } else {
    console.log('✅ Nenhuma compra duplicada encontrada nas últimas 50 compras');
  }

  // Verificar padrão específico do TempPurchaseController
  const suspiciousPurchases = recentPurchases.filter(p =>
    p.payment_method === null &&
    p.status === 'PAID'
  );

  if (suspiciousPurchases.length > 0) {
    console.log(`\n⚠️  ENCONTRADAS ${suspiciousPurchases.length} COMPRAS SUSPEITAS:`);
    console.log('   (payment_method = NULL e status = PAID)');
    console.log('   Padrão característico de criação via TempPurchaseController\n');
  }

  // Análise de timestamps
  console.log('\n📅 Análise temporal das últimas 20 compras:');
  const timestamps = recentPurchases.slice(0, 20).map(p => ({
    id: p.id.substring(0, 8),
    created_at: new Date(p.created_at),
    amount: p.amount_cents
  }));

  let simultaneousCount = 0;
  for (let i = 0; i < timestamps.length - 1; i++) {
    const diff = Math.abs(timestamps[i].created_at - timestamps[i + 1].created_at);
    if (diff < 1000) { // Menos de 1 segundo de diferença
      simultaneousCount++;
      console.log(`   ⚠️  ${timestamps[i].id} e ${timestamps[i + 1].id} criados com ${diff}ms de diferença`);
    }
  }

  if (simultaneousCount > 0) {
    console.log(`\n   Total de pares simultâneos: ${simultaneousCount}`);
    console.log('   Isso indica possível criação em batch ou loop automático');
  }

  console.log('\n\n💡 RECOMENDAÇÕES:');
  console.log('1. Remover TempPurchaseController do código');
  console.log('2. Verificar se há scripts externos ou ferramentas (Postman, etc) fazendo requests');
  console.log('3. Adicionar autenticação/autorização em todos os endpoints de compra');
  console.log('4. Monitorar logs do Render para identificar origem dos requests');
}

main().catch(console.error);
