require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testarClassificacao() {
  console.log('🎬 Testando Classificação Etária...\n');

  // Buscar um conteúdo
  const { data: content, error: fetchError } = await supabase
    .from('content')
    .select('id, title, age_rating')
    .limit(1)
    .single();

  if (fetchError || !content) {
    console.error('❌ Erro ao buscar conteúdo:', fetchError);
    return;
  }

  console.log(`📝 Conteúdo: ${content.title}`);
  console.log(`   Classificação atual: ${content.age_rating || 'null'}\n`);

  // Testar todas as classificações
  const classificacoes = ['L', '10', '12', '14', '16', '18'];

  for (const classificacao of classificacoes) {
    console.log(`\n📌 Testando classificação: ${classificacao}`);

    // Atualizar
    const { data: updated, error: updateError } = await supabase
      .from('content')
      .update({ age_rating: classificacao })
      .eq('id', content.id)
      .select('age_rating')
      .single();

    if (updateError) {
      console.error(`❌ Erro ao atualizar para "${classificacao}":`, updateError);
      continue;
    }

    // Verificar
    const { data: verified, error: verifyError } = await supabase
      .from('content')
      .select('age_rating')
      .eq('id', content.id)
      .single();

    if (verifyError) {
      console.error(`❌ Erro ao verificar:`, verifyError);
      continue;
    }

    const sucesso = verified.age_rating === classificacao;
    console.log(`   ${sucesso ? '✅' : '❌'} Salvo: ${verified.age_rating}`);
  }

  // Testar valor vazio
  console.log(`\n📌 Testando sem classificação (vazio)`);
  const { data: emptyUpdate, error: emptyError } = await supabase
    .from('content')
    .update({ age_rating: null })
    .eq('id', content.id)
    .select('age_rating')
    .single();

  if (!emptyError) {
    console.log(`   ✅ Salvo como: ${emptyUpdate.age_rating === null ? 'null' : emptyUpdate.age_rating}`);
  } else {
    console.error(`   ❌ Erro:`, emptyError);
  }

  // Restaurar valor original
  if (content.age_rating) {
    await supabase
      .from('content')
      .update({ age_rating: content.age_rating })
      .eq('id', content.id);
    console.log(`\n♻️  Valor original restaurado: ${content.age_rating}`);
  }

  console.log('\n✅ Teste concluído!\n');
}

testarClassificacao().catch(console.error);
