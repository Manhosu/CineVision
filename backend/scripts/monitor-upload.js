const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkUploadProgress() {
  try {
    // Buscar todos os filmes e suas versões de idioma
    const { data: movies, error } = await supabase
      .from('content')
      .select(`
        id,
        title,
        content_languages (
          id,
          audio_type,
          video_url,
          status,
          quality,
          file_size_bytes
        )
      `)
      .eq('content_type', 'movie')
      .order('title');

    if (error) {
      console.error('❌ Erro ao buscar filmes:', error);
      return;
    }

    console.log('\n' + '='.repeat(80));
    console.log('📊 PROGRESSO DO UPLOAD DE VÍDEOS');
    console.log('='.repeat(80));
    console.log(`⏰ ${new Date().toLocaleString('pt-BR')}\n`);

    let totalVideos = 0;
    let videosWithUrls = 0;
    let totalSize = 0;

    movies.forEach(movie => {
      const languages = movie.content_languages || [];

      if (languages.length === 0) {
        console.log(`📽️  ${movie.title}`);
        console.log(`   ⚠️  Nenhuma versão cadastrada\n`);
        return;
      }

      console.log(`📽️  ${movie.title}`);

      languages.forEach(lang => {
        totalVideos++;
        const hasVideo = lang.video_url && lang.video_url.trim() !== '';

        if (hasVideo) {
          videosWithUrls++;
          totalSize += lang.file_size_bytes || 0;
        }

        const status = hasVideo ? '✅' : '⏳';
        const audioType = (lang.audio_type || 'N/A').toUpperCase();
        const quality = lang.quality || 'N/A';
        const size = lang.file_size_bytes
          ? `${(lang.file_size_bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
          : 'N/A';

        console.log(`   ${status} ${audioType.padEnd(12)} | ${quality.padEnd(8)} | ${size.padEnd(12)} | ${lang.status || 'pending'}`);
      });

      console.log('');
    });

    const progressPercent = totalVideos > 0 ? ((videosWithUrls / totalVideos) * 100).toFixed(1) : 0;
    const totalSizeGB = (totalSize / (1024 * 1024 * 1024)).toFixed(2);

    console.log('='.repeat(80));
    console.log('📈 RESUMO:');
    console.log(`   Total de versões: ${totalVideos}`);
    console.log(`   Vídeos com upload: ${videosWithUrls}/${totalVideos} (${progressPercent}%)`);
    console.log(`   Tamanho total: ${totalSizeGB} GB`);
    console.log('='.repeat(80));

    // Criar barra de progresso visual
    const barLength = 50;
    const filledLength = Math.round((videosWithUrls / totalVideos) * barLength);
    const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
    console.log(`\n[${bar}] ${progressPercent}%\n`);

    return { totalVideos, videosWithUrls, completed: videosWithUrls === totalVideos };

  } catch (error) {
    console.error('❌ Erro ao verificar progresso:', error);
  }
}

async function monitorLoop() {
  console.log('🚀 Iniciando monitoramento de upload...\n');

  while (true) {
    const result = await checkUploadProgress();

    if (result && result.completed) {
      console.log('\n🎉 TODOS OS UPLOADS FORAM CONCLUÍDOS! 🎉\n');
      break;
    }

    console.log('⏳ Aguardando 30 segundos para próxima verificação...\n');
    await new Promise(resolve => setTimeout(resolve, 30000));
  }
}

// Se executado diretamente
if (require.main === module) {
  monitorLoop().catch(console.error);
}

module.exports = { checkUploadProgress };
