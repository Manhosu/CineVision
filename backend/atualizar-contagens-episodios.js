const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function atualizarContagens() {
  console.log('\n=== ATUALIZANDO CONTAGENS DE EPISÓDIOS ===\n');

  // 1. Buscar todas as séries
  const { data: series, error: seriesError } = await supabase
    .from('content')
    .select('id, title')
    .eq('content_type', 'series');

  if (seriesError) {
    console.error('Erro ao buscar séries:', seriesError);
    return;
  }

  console.log(`Encontradas ${series.length} séries para atualizar\n`);

  // 2. Para cada série, contar episódios e temporadas
  for (const s of series) {
    console.log(`Processando: ${s.title} (${s.id})`);

    // Contar episódios
    const { data: episodes, error: episodesError } = await supabase
      .from('episodes')
      .select('id, season_number')
      .eq('series_id', s.id);

    if (episodesError) {
      console.error(`  ❌ Erro ao contar episódios:`, episodesError);
      continue;
    }

    const totalEpisodes = episodes.length;
    const totalSeasons = [...new Set(episodes.map(e => e.season_number))].length;

    console.log(`  Episódios: ${totalEpisodes}`);
    console.log(`  Temporadas: ${totalSeasons}`);

    // Atualizar a série
    const { error: updateError } = await supabase
      .from('content')
      .update({
        total_episodes: totalEpisodes,
        total_seasons: totalSeasons
      })
      .eq('id', s.id);

    if (updateError) {
      console.error(`  ❌ Erro ao atualizar:`, updateError);
    } else {
      console.log(`  ✅ Atualizado com sucesso!\n`);
    }
  }

  console.log('\n=== RESULTADO FINAL ===\n');

  // 3. Mostrar resultado final
  const { data: updatedSeries, error: finalError } = await supabase
    .from('content')
    .select('title, total_seasons, total_episodes')
    .eq('content_type', 'series');

  if (finalError) {
    console.error('Erro ao buscar resultado:', finalError);
    return;
  }

  updatedSeries.forEach(s => {
    console.log(`📺 ${s.title}: ${s.total_seasons || 0} temporadas • ${s.total_episodes || 0} episódios`);
  });
}

atualizarContagens()
  .then(() => {
    console.log('\n✅ Contagens atualizadas com sucesso!\n');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Erro:', err);
    process.exit(1);
  });
