const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const WANDINHA_ID = '08fc07e1-fe03-434e-8349-997d84a6e269';

async function verificarEpisodiosCompletos() {
  console.log('\n=== VERIFICANDO EPISÓDIOS DA SÉRIE WANDINHA ===\n');

  // 1. Buscar todos os episódios
  const { data: episodes, error } = await supabase
    .from('episodes')
    .select('*')
    .eq('series_id', WANDINHA_ID)
    .order('season_number', { ascending: true })
    .order('episode_number', { ascending: true });

  if (error) {
    console.error('Erro ao buscar episódios:', error);
    return;
  }

  console.log(`Total de episódios encontrados: ${episodes.length}\n`);

  // 2. Mostrar detalhes de cada episódio
  episodes.forEach((ep, idx) => {
    console.log(`\n${idx + 1}. S${ep.season_number}E${ep.episode_number} - ${ep.title}`);
    console.log(`   ID: ${ep.id}`);
    console.log(`   Duração: ${ep.duration_minutes || 0} minutos`);
    console.log(`   Video URL: ${ep.video_url || 'NULL'}`);
    console.log(`   Storage Path: ${ep.storage_path || 'NULL'}`);
    console.log(`   File Storage Key: ${ep.file_storage_key || 'NULL'}`);
    console.log(`   Processing Status: ${ep.processing_status || 'NULL'}`);
    console.log(`   Criado em: ${ep.created_at}`);
    console.log(`   Atualizado em: ${ep.updated_at}`);
  });

  // 3. Verificar uploads em andamento
  console.log('\n\n=== VERIFICANDO UPLOADS EM ANDAMENTO ===\n');

  const { data: uploads, error: uploadsError } = await supabase
    .from('video_uploads')
    .select('*')
    .in('episode_id', episodes.map(e => e.id))
    .order('created_at', { ascending: false });

  if (uploadsError) {
    console.error('Erro ao buscar uploads:', uploadsError);
  } else {
    console.log(`Total de uploads encontrados: ${uploads.length}\n`);

    uploads.forEach((upload, idx) => {
      const episode = episodes.find(e => e.id === upload.episode_id);
      console.log(`\n${idx + 1}. Upload ID: ${upload.id}`);
      console.log(`   Episódio: S${episode?.season_number}E${episode?.episode_number} - ${episode?.title}`);
      console.log(`   Filename: ${upload.filename}`);
      console.log(`   Status: ${upload.status}`);
      console.log(`   Size: ${(upload.size / 1024 / 1024).toFixed(2)} MB`);
      console.log(`   Parts Count: ${upload.parts_count}`);
      console.log(`   S3 Key: ${upload.key}`);
      console.log(`   Upload ID (S3): ${upload.upload_id}`);
      console.log(`   Criado em: ${upload.created_at}`);
      console.log(`   Atualizado em: ${upload.updated_at}`);
    });
  }

  // 4. Contar temporadas e episódios
  console.log('\n\n=== ESTATÍSTICAS ===\n');

  const seasons = [...new Set(episodes.map(e => e.season_number))];
  console.log(`Total de Temporadas: ${seasons.length}`);
  console.log(`Total de Episódios: ${episodes.length}`);

  seasons.forEach(season => {
    const seasonEpisodes = episodes.filter(e => e.season_number === season);
    console.log(`  Temporada ${season}: ${seasonEpisodes.length} episódios`);
  });

  // 5. Verificar episódios com vídeo
  const episodesWithVideo = episodes.filter(e =>
    e.video_url || e.storage_path || e.file_storage_key
  );

  console.log(`\nEpisódios com vídeo: ${episodesWithVideo.length}/${episodes.length}`);

  const episodesReady = episodes.filter(e => e.processing_status === 'ready');
  console.log(`Episódios prontos (ready): ${episodesReady.length}/${episodes.length}`);
}

verificarEpisodiosCompletos()
  .then(() => {
    console.log('\n✅ Verificação concluída!\n');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Erro:', err);
    process.exit(1);
  });
