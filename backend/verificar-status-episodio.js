const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verificarStatusEpisodio() {
  console.log('🔍 Verificando status dos episódios mais recentes...\n');

  // Buscar episódios mais recentes (último 1 dia)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: episodes, error } = await supabase
    .from('episodes')
    .select('id, series_id, season_number, episode_number, title, processing_status, storage_path, file_storage_key, updated_at')
    .gte('updated_at', oneDayAgo)
    .order('updated_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('❌ Erro ao buscar episódios:', error);
    return;
  }

  if (!episodes || episodes.length === 0) {
    console.log('⚠️ Nenhum episódio recente encontrado (últimas 24h)');
    return;
  }

  console.log(`📺 Encontrados ${episodes.length} episódios recentes:\n`);

  for (const ep of episodes) {
    console.log(`📌 Episódio ID: ${ep.id}`);
    console.log(`   Série ID: ${ep.series_id || 'N/A'}`);
    console.log(`   S${ep.season_number}E${ep.episode_number} - ${ep.title || 'Sem título'}`);
    console.log(`   Status: ${ep.processing_status || 'pending'}`);
    console.log(`   Storage Path: ${ep.storage_path || 'N/A'}`);
    console.log(`   File Key: ${ep.file_storage_key || 'N/A'}`);
    console.log(`   Atualizado em: ${new Date(ep.updated_at).toLocaleString('pt-BR')}`);
    console.log('');
  }

  // Buscar uploads relacionados
  console.log('\n📤 Verificando uploads relacionados...\n');

  const { data: uploads, error: uploadsError } = await supabase
    .from('video_uploads')
    .select('id, episode_id, filename, status, parts_count, created_at, updated_at')
    .gte('created_at', oneDayAgo)
    .order('created_at', { ascending: false })
    .limit(10);

  if (uploadsError) {
    console.error('❌ Erro ao buscar uploads:', uploadsError);
    return;
  }

  if (!uploads || uploads.length === 0) {
    console.log('⚠️ Nenhum upload recente encontrado');
    return;
  }

  console.log(`📤 Encontrados ${uploads.length} uploads recentes:\n`);

  for (const upload of uploads) {
    console.log(`📦 Upload ID: ${upload.id}`);
    console.log(`   Episódio ID: ${upload.episode_id || 'N/A'}`);
    console.log(`   Arquivo: ${upload.filename}`);
    console.log(`   Status: ${upload.status}`);
    console.log(`   Partes: ${upload.parts_count}`);
    console.log(`   Criado em: ${new Date(upload.created_at).toLocaleString('pt-BR')}`);
    console.log(`   Atualizado em: ${new Date(upload.updated_at).toLocaleString('pt-BR')}`);
    console.log('');
  }
}

verificarStatusEpisodio()
  .then(() => {
    console.log('✅ Verificação concluída!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro:', error);
    process.exit(1);
  });
