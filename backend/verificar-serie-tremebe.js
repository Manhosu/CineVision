// Verificar se a série Tremembé foi criada corretamente
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SERIES_ID = '33c1ce60-dec5-4ce5-b326-33814c0d470a';

async function verificarSerie() {
  console.log('\n🔍 Verificando série Tremembé...\n');
  console.log(`ID: ${SERIES_ID}\n`);

  // 1. Verificar se existe na tabela content
  const { data: content, error: contentError } = await supabase
    .from('content')
    .select('*')
    .eq('id', SERIES_ID)
    .single();

  if (contentError) {
    console.log('❌ Erro ao buscar content:', contentError.message);
    return;
  }

  console.log('✅ Content encontrado:');
  console.log('   Título:', content.title);
  console.log('   Tipo:', content.type);
  console.log('   Status:', content.status);
  console.log('   Processing Status:', content.processing_status);
  console.log('');

  // 2. Verificar se existe na tabela series
  const { data: series, error: seriesError } = await supabase
    .from('series')
    .select('*')
    .eq('id', SERIES_ID)
    .single();

  if (seriesError) {
    console.log('❌ NÃO existe na tabela series!');
    console.log('   Erro:', seriesError.message);
    console.log('');
    console.log('🔴 PROBLEMA IDENTIFICADO:');
    console.log('   A série existe na tabela "content" mas NÃO na tabela "series"!');
    console.log('   Isso causa erro 404 quando tenta buscar /content/series/{id}');
    console.log('');
  } else {
    console.log('✅ Series encontrada:');
    console.log('   Total Seasons:', series.total_seasons);
    console.log('   Total Episodes:', series.total_episodes);
    console.log('');
  }

  // 3. Verificar episódios
  const { data: episodes, error: episodesError } = await supabase
    .from('episodes')
    .select('*')
    .eq('series_id', SERIES_ID)
    .order('season_number', { ascending: true })
    .order('episode_number', { ascending: true });

  if (episodesError) {
    console.log('❌ Erro ao buscar episódios:', episodesError.message);
  } else {
    console.log(`✅ ${episodes.length} episódios encontrados:`);
    episodes.forEach(ep => {
      console.log(`   S${ep.season_number}E${ep.episode_number}: ${ep.title}`);
      console.log(`      Storage: ${ep.storage_path || 'NÃO DEFINIDO'}`);
      console.log(`      Status: ${ep.processing_status}`);
    });
    console.log('');
  }

  // 4. Verificar estrutura esperada
  console.log('📋 Estrutura esperada:');
  console.log('   ✓ Tabela "content" com type="series"');
  console.log('   ✓ Tabela "series" com o mesmo ID');
  console.log('   ✓ Tabela "episodes" com series_id apontando para o ID');
  console.log('');

  if (!series) {
    console.log('❌ AÇÃO NECESSÁRIA:');
    console.log('   Criar registro na tabela "series" com o ID da série');
    console.log('   Ou ajustar o código para não exigir tabela "series"');
  }
}

verificarSerie().catch(console.error);
