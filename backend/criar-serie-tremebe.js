// Criar registro da série Tremembé e corrigir campo type
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SERIES_ID = '33c1ce60-dec5-4ce5-b326-33814c0d470a';

async function criarSerieECorrigirType() {
  console.log('\n🔧 Criando registro da série e corrigindo campo type...\n');

  // 1. Buscar dados do content
  const { data: content, error: contentError } = await supabase
    .from('content')
    .select('*')
    .eq('id', SERIES_ID)
    .single();

  if (contentError) {
    console.log('❌ Erro ao buscar content:', contentError.message);
    return;
  }

  console.log('✅ Content encontrado:', content.title);
  console.log(`   Content Type atual: "${content.content_type}"`);
  console.log('');

  // 2. Corrigir o campo content_type no content
  console.log('🔄 Corrigindo campo content_type do content para "series"...');
  const { error: updateContentError } = await supabase
    .from('content')
    .update({ content_type: 'series' })
    .eq('id', SERIES_ID);

  if (updateContentError) {
    console.log('❌ Erro ao atualizar content:', updateContentError.message);
    return;
  }

  console.log('✅ Campo type atualizado com sucesso!');
  console.log('');

  // 3. Contar episódios
  const { data: episodes, error: episodesError } = await supabase
    .from('episodes')
    .select('id, season_number, episode_number')
    .eq('series_id', SERIES_ID);

  const totalEpisodes = episodes ? episodes.length : 0;
  const seasons = episodes ? Math.max(...episodes.map(ep => ep.season_number)) : 1;

  console.log(`📊 Episódios: ${totalEpisodes} em ${seasons} temporada(s)`);
  console.log('');

  // 4. Criar registro na tabela series
  console.log('🔄 Criando registro na tabela series...');

  // Map availability values
  const availabilityMap = {
    'site': 'APP_ONLY',
    'telegram': 'TELEGRAM_ONLY',
    'both': 'BOTH',
    'app': 'APP_ONLY',
  };

  const availability = availabilityMap[content.availability?.toLowerCase()] || 'BOTH';

  // Map status values
  const statusMap = {
    'published': 'PUBLISHED',
    'draft': 'DRAFT',
    'archived': 'ARCHIVED',
  };

  const status = statusMap[content.status?.toLowerCase()] || 'PUBLISHED';

  const seriesData = {
    id: SERIES_ID,
    title: content.title || 'Tremembé',
    description: content.description,
    synopsis: content.synopsis,
    cover_url: content.cover_url,
    poster_url: content.poster_url,
    backdrop_url: content.backdrop_url,
    banner_url: content.banner_url,
    trailer_url: content.trailer_url,
    price_cents: content.price_cents || 0,
    currency: content.currency || 'BRL',
    price_per_episode: false,
    release_year: content.release_year,
    director: content.director,
    cast: content.cast,
    genres: content.genres,
    imdb_rating: content.imdb_rating,
    total_seasons: seasons,
    total_episodes: totalEpisodes,
    availability: availability,
    status: status,
    is_featured: content.is_featured || false,
    views_count: content.views_count || 0,
    purchases_count: content.purchases_count || 0,
    created_at: content.created_at,
    updated_at: new Date().toISOString(),
  };

  const { data: newSeries, error: seriesError } = await supabase
    .from('series')
    .insert(seriesData)
    .select()
    .single();

  if (seriesError) {
    console.log('❌ Erro ao criar registro na tabela series:', seriesError.message);
    console.log(seriesError);
    return;
  }

  console.log('✅ Registro criado na tabela series com sucesso!');
  console.log('');

  // 5. Verificação final
  console.log('🔍 Verificação final...\n');

  const { data: verifyContent } = await supabase
    .from('content')
    .select('id, title, content_type, status')
    .eq('id', SERIES_ID)
    .single();

  const { data: verifySeries } = await supabase
    .from('series')
    .select('id, title, total_seasons, total_episodes, status')
    .eq('id', SERIES_ID)
    .single();

  console.log('✅ Content:');
  console.log(`   Title: ${verifyContent.title}`);
  console.log(`   Content Type: ${verifyContent.content_type}`);
  console.log(`   Status: ${verifyContent.status}`);
  console.log('');

  console.log('✅ Series:');
  console.log(`   Title: ${verifySeries.title}`);
  console.log(`   Seasons: ${verifySeries.total_seasons}`);
  console.log(`   Episodes: ${verifySeries.total_episodes}`);
  console.log(`   Status: ${verifySeries.status}`);
  console.log('');

  console.log('🎉 TUDO CORRIGIDO! A série agora deve funcionar corretamente!');
  console.log('');
  console.log('🔗 Tente acessar novamente:');
  console.log('   https://www.cinevisionapp.com.br/series/33c1ce60-dec5-4ce5-b326-33814c0d470a');
}

criarSerieECorrigirType().catch(console.error);
