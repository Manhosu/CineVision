const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://szghyvnbmjlquznxhqum.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6Z2h5dm5ibWpscXV6bnhocXVtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODc0OTk5OSwiZXhwIjoyMDc0MzI1OTk5fQ.p9_G_CjLg8h2CVZqteKLdK9WUFKFdXSqTuTolHFiWGc';

const supabase = createClient(supabaseUrl, supabaseKey);

async function investigate() {
  console.log('🔍 INVESTIGAÇÃO: Por que compras não têm conteúdo?\n');

  // 1. Verificar as compras pagas
  const { data: purchases, error: purchasesError } = await supabase
    .from('purchases')
    .select('id, user_id, content_id, status, amount_cents, created_at')
    .eq('status', 'paid')
    .order('created_at', { ascending: false })
    .limit(5);

  if (purchasesError) {
    console.error('❌ Erro ao buscar compras:', purchasesError);
    return;
  }

  console.log(`📦 Compras Pagas (${purchases.length}):\n`);

  for (const purchase of purchases) {
    console.log(`ID: ${purchase.id}`);
    console.log(`User ID: ${purchase.user_id}`);
    console.log(`Content ID: ${purchase.content_id || '⚠️ NULL'}`);
    console.log(`Status: ${purchase.status}`);
    console.log(`Valor: R$ ${(purchase.amount_cents / 100).toFixed(2)}`);
    console.log(`Data: ${new Date(purchase.created_at).toLocaleString()}`);
    console.log('---');
  }

  // 2. Verificar se há conteúdo na tabela content
  const { data: contents, error: contentsError } = await supabase
    .from('content')
    .select('id, title, content_type, video_url')
    .limit(10);

  if (contentsError) {
    console.error('❌ Erro ao buscar conteúdos:', contentsError);
  } else {
    console.log(`\n🎬 Conteúdos Disponíveis (${contents.length}):\n`);

    if (contents.length === 0) {
      console.log('⚠️ NENHUM CONTEÚDO CADASTRADO NO SISTEMA!\n');
    } else {
      contents.forEach(content => {
        console.log(`ID: ${content.id}`);
        console.log(`Título: ${content.title}`);
        console.log(`Tipo: ${content.content_type}`);
        console.log(`URL: ${content.video_url ? 'Sim' : 'Não'}`);
        console.log('---');
      });
    }
  }

  // 3. Verificar content_ids que não existem mais
  const contentIds = purchases
    .map(p => p.content_id)
    .filter(Boolean);

  if (contentIds.length > 0) {
    console.log(`\n🔎 Verificando se os content_ids das compras existem...\n`);

    for (const contentId of contentIds) {
      const { data: content, error } = await supabase
        .from('content')
        .select('id, title')
        .eq('id', contentId)
        .single();

      if (error || !content) {
        console.log(`❌ Content ID ${contentId} NÃO EXISTE na tabela content!`);
      } else {
        console.log(`✅ Content ID ${contentId} existe: ${content.title}`);
      }
    }
  } else {
    console.log('\n⚠️ Todas as compras têm content_id NULL!\n');
  }

  // 4. Verificar schema da tabela purchases
  console.log('\n📋 Verificando schema da tabela purchases...\n');

  const { data: columns } = await supabase
    .rpc('exec_sql', {
      query: `
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'purchases'
        ORDER BY ordinal_position;
      `
    })
    .single();

  console.log('Colunas da tabela purchases:', columns);
}

investigate().catch(console.error);
