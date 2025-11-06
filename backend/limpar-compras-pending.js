const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function limparComprasPending() {
  console.log('\n=== LIMPANDO COMPRAS PENDING ANTIGAS ===\n');

  // Data limite: 24 horas atrás
  const limitDate = new Date();
  limitDate.setHours(limitDate.getHours() - 24);

  console.log(`Removendo compras pending criadas antes de: ${limitDate.toISOString()}\n`);

  // 1. Listar compras que serão removidas
  const { data: toDelete, error: listError } = await supabase
    .from('purchases')
    .select('id, content_id, status, created_at, amount_cents, content(title)')
    .eq('status', 'pending')
    .lt('created_at', limitDate.toISOString());

  if (listError) {
    console.error('❌ Erro ao listar compras:', listError);
    return;
  }

  if (!toDelete || toDelete.length === 0) {
    console.log('✅ Nenhuma compra pending antiga encontrada!\n');
    return;
  }

  console.log(`📋 Encontradas ${toDelete.length} compras pending antigas:\n`);

  // Agrupar por conteúdo
  const grouped = {};
  toDelete.forEach(purchase => {
    const title = purchase.content?.title || 'Desconhecido';
    if (!grouped[title]) {
      grouped[title] = [];
    }
    grouped[title].push(purchase);
  });

  for (const [title, purchases] of Object.entries(grouped)) {
    console.log(`  📺 ${title}: ${purchases.length} compras pending`);
    purchases.forEach(p => {
      console.log(`     - ${p.id} (${new Date(p.created_at).toLocaleString('pt-BR')})`);
    });
  }

  console.log(`\n⚠️  Total a remover: ${toDelete.length} compras\n`);

  // Confirmar antes de deletar
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const confirmed = await new Promise(resolve => {
    readline.question('Deseja continuar com a remoção? (s/n): ', answer => {
      readline.close();
      resolve(answer.toLowerCase() === 's' || answer.toLowerCase() === 'sim');
    });
  });

  if (!confirmed) {
    console.log('\n❌ Operação cancelada pelo usuário.\n');
    return;
  }

  // 2. Deletar compras
  const { error: deleteError } = await supabase
    .from('purchases')
    .delete()
    .eq('status', 'pending')
    .lt('created_at', limitDate.toISOString());

  if (deleteError) {
    console.error('❌ Erro ao deletar compras:', deleteError);
    return;
  }

  console.log(`\n✅ ${toDelete.length} compras pending antigas foram removidas com sucesso!\n`);

  // 3. Listar compras restantes do usuário
  const { data: remaining, error: remainingError } = await supabase
    .from('purchases')
    .select('id, status, content(title), created_at')
    .eq('user_id', '84dca2a4-02cd-4dfa-a7df-6f2afcb26027')
    .order('created_at', { ascending: false });

  if (remainingError) {
    console.error('Erro ao listar compras restantes:', remainingError);
    return;
  }

  console.log('📊 Compras restantes do usuário:\n');

  const statusCount = {};
  remaining.forEach(p => {
    statusCount[p.status] = (statusCount[p.status] || 0) + 1;
  });

  console.log('Status das compras:');
  Object.entries(statusCount).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`);
  });

  console.log('\nDetalhes:');
  remaining.slice(0, 10).forEach(p => {
    console.log(`  - ${p.content?.title || 'N/A'} (${p.status}) - ${new Date(p.created_at).toLocaleString('pt-BR')}`);
  });

  if (remaining.length > 10) {
    console.log(`  ... e mais ${remaining.length - 10} compras\n`);
  }
}

limparComprasPending()
  .then(() => {
    console.log('\n✅ Limpeza concluída!\n');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Erro:', err);
    process.exit(1);
  });
