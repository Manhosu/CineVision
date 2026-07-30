// Verificação final da série Tremembé no banco de produção
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SERIES_ID = '33c1ce60-dec5-4ce5-b326-33814c0d470a';

async function verificarSerieFinal() {
  console.log('\n🔍 VERIFICAÇÃO FINAL - Série Tremembé\n');
  console.log('='.repeat(60));

  // 1. Verificar Content
  const { data: content, error: contentError } = await supabase
    .from('content')
    .select('id, title, content_type, status, availability')
    .eq('id', SERIES_ID)
    .single();

  if (contentError) {
    console.log('❌ Erro ao buscar content:', contentError.message);
    return;
  }

  console.log('\n📄 TABELA CONTENT:');
  console.log(`   ID: ${content.id}`);
  console.log(`   Title: ${content.title}`);
  console.log(`   Content Type: "${content.content_type}"`);
  console.log(`   Status: ${content.status}`);
  console.log(`   Availability: ${content.availability}`);

  // 2. Verificar Series
  const { data: series, error: seriesError } = await supabase
    .from('series')
    .select('id, title, total_seasons, total_episodes, status, availability')
    .eq('id', SERIES_ID)
    .single();

  if (seriesError) {
    console.log('\n❌ Erro ao buscar series:', seriesError.message);
    console.log(seriesError);
    return;
  }

  console.log('\n📺 TABELA SERIES:');
  console.log(`   ID: ${series.id}`);
  console.log(`   Title: ${series.title}`);
  console.log(`   Total Seasons: ${series.total_seasons}`);
  console.log(`   Total Episodes: ${series.total_episodes}`);
  console.log(`   Status: ${series.status}`);
  console.log(`   Availability: ${series.availability}`);

  // 3. Verificar Episódios
  const { data: episodes, error: episodesError } = await supabase
    .from('episodes')
    .select('id, title, season_number, episode_number, duration_seconds')
    .eq('series_id', SERIES_ID)
    .order('season_number')
    .order('episode_number');

  console.log('\n🎬 EPISÓDIOS:');
  if (episodes && episodes.length > 0) {
    episodes.forEach(ep => {
      console.log(`   S${ep.season_number}E${ep.episode_number}: ${ep.title} (${ep.duration_seconds}s)`);
    });
  } else {
    console.log('   ⚠️ Nenhum episódio encontrado');
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n✅ DIAGNÓSTICO:');

  if (content.content_type === 'series' && series) {
    console.log('   ✓ Content Type: OK');
    console.log('   ✓ Registro Series: OK');
    console.log('   ✓ Episódios: ' + (episodes?.length || 0) + ' encontrados');
    console.log('\n🎉 A série está CORRETAMENTE configurada no banco!');
    console.log('\n🔗 URL para testar:');
    console.log('   https://app.cinevisionapp.com.br/series/' + SERIES_ID);
  } else {
    console.log('   ❌ Ainda há problemas na configuração');
  }

  console.log('');
}

verificarSerieFinal().catch(console.error);
