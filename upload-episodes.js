const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

// Configuração
const API_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const SERIES_ID = '08fc07e1-fe03-434e-8349-997d84a6e269'; // Wandinha
const DOWNLOAD_PATH = 'C:\\Users\\delas\\Downloads\\drive-download-20251027T041358Z-1-001';

// Episódios para fazer upload (com áudio em português otimizado)
const episodes = [
  {
    file: 'Wandinha.S01E01.NEW.mp4',
    season: 1,
    episode: 1,
    title: '01',
    duration: 59 // minutos aproximados
  },
  {
    file: 'Wandinha.S01E02.NEW.mp4',
    season: 1,
    episode: 2,
    title: '02',
    duration: 49
  },
  {
    file: 'Wandinha.S02E01.NEW.mp4',
    season: 2,
    episode: 1,
    title: '01',
    duration: 60
  }
];

// Função para fazer upload de um chunk
async function uploadChunk(uploadUrl, chunk, partNumber) {
  try {
    const response = await axios.put(uploadUrl, chunk, {
      headers: {
        'Content-Type': 'video/mp4',
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });

    return {
      ETag: response.headers.etag,
      PartNumber: partNumber,
    };
  } catch (error) {
    console.error(`Erro ao fazer upload do chunk ${partNumber}:`, error.message);
    throw error;
  }
}

// Função para fazer upload de um arquivo completo
async function uploadEpisode(episodeData) {
  const filePath = path.join(DOWNLOAD_PATH, episodeData.file);
  console.log(`\n📤 Iniciando upload de ${episodeData.file}...`);

  // Verificar se o arquivo existe
  if (!fs.existsSync(filePath)) {
    throw new Error(`Arquivo não encontrado: ${filePath}`);
  }

  const fileStats = fs.statSync(filePath);
  const fileSize = fileStats.size;
  console.log(`   Tamanho: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);

  // 1. Criar ou buscar episódio
  console.log(`   1. Verificando episódio S${episodeData.season}E${episodeData.episode}...`);

  let episodeId;
  try {
    // Buscar episódios existentes
    const { data: existingEpisodes } = await axios.get(
      `${API_URL}/api/v1/content/series/${SERIES_ID}/episodes`
    );

    const existing = existingEpisodes.find(
      ep => ep.season_number === episodeData.season && ep.episode_number === episodeData.episode
    );

    if (existing) {
      episodeId = existing.id;
      console.log(`   ✓ Episódio encontrado: ${episodeId}`);
    } else {
      // Criar novo episódio
      const { data: response } = await axios.post(
        `${API_URL}/api/v1/admin/content/series/${SERIES_ID}/episodes`,
        {
          season_number: episodeData.season,
          episode_number: episodeData.episode,
          title: episodeData.title,
          duration_minutes: episodeData.duration,
        }
      );
      episodeId = response.data.id;
      console.log(`   ✓ Episódio criado: ${episodeId}`);
    }
  } catch (error) {
    console.error(`   ✗ Erro ao criar/buscar episódio:`, error.response?.data || error.message);
    throw error;
  }

  // 2. Iniciar multipart upload e obter todas as URLs presigned
  console.log(`   2. Iniciando multipart upload...`);
  let uploadId, key, presignedUrls, partSize;

  try {
    const { data: initData } = await axios.post(
      `${API_URL}/api/v1/admin/uploads/init`,
      {
        filename: episodeData.file,
        contentType: 'video/mp4',
        size: fileSize,
        episodeId: episodeId,
      }
    );

    uploadId = initData.uploadId;
    key = initData.key;
    presignedUrls = initData.presignedUrls;
    partSize = initData.partSize;
    console.log(`   ✓ Upload iniciado: ${uploadId}`);
    console.log(`   ✓ ${presignedUrls.length} URLs presigned geradas (${(partSize / 1024 / 1024).toFixed(0)}MB por parte)`);
  } catch (error) {
    console.error(`   ✗ Erro ao iniciar upload:`, error.response?.data || error.message);
    throw error;
  }

  // 3. Upload dos chunks usando as URLs presigned
  const totalParts = presignedUrls.length;
  console.log(`   3. Fazendo upload de ${totalParts} partes...`);

  const uploadedParts = [];
  const fileHandle = fs.openSync(filePath, 'r');

  try {
    for (const urlInfo of presignedUrls) {
      const { partNumber, url } = urlInfo;

      // Ler o chunk do arquivo
      const buffer = Buffer.alloc(partSize);
      const bytesRead = fs.readSync(fileHandle, buffer, 0, partSize, (partNumber - 1) * partSize);
      const chunk = buffer.slice(0, bytesRead);

      // Fazer upload do chunk
      const part = await uploadChunk(url, chunk, partNumber);
      uploadedParts.push(part);

      const progress = ((partNumber / totalParts) * 100).toFixed(1);
      process.stdout.write(`\r   📊 Progresso: ${progress}% (${partNumber}/${totalParts} partes)`);
    }

    fs.closeSync(fileHandle);
    console.log('\n   ✓ Todas as partes enviadas!');
  } catch (error) {
    fs.closeSync(fileHandle);
    console.error(`\n   ✗ Erro no upload das partes:`, error.message);
    throw error;
  }

  // 4. Completar multipart upload
  console.log(`   4. Finalizando upload...`);

  try {
    await axios.post(
      `${API_URL}/api/v1/admin/uploads/complete`,
      {
        uploadId,
        key,
        parts: uploadedParts,
        episodeId: episodeId,
      }
    );

    console.log(`   ✓ Upload finalizado com sucesso!`);
    console.log(`   ✓ Episódio marcado como pronto para visualização!`);
  } catch (error) {
    console.error(`   ✗ Erro ao finalizar upload:`, error.response?.data || error.message);
    throw error;
  }

  console.log(`\n✅ Upload de ${episodeData.file} concluído!\n`);

  return {
    episodeId,
    key,
    success: true,
  };
}

// Função principal
async function main() {
  console.log('🎬 Iniciando upload dos episódios de Wandinha...\n');
  console.log(`API: ${API_URL}`);
  console.log(`Série: ${SERIES_ID}\n`);

  const results = [];

  for (const episode of episodes) {
    try {
      const result = await uploadEpisode(episode);
      results.push({ episode, ...result });
    } catch (error) {
      console.error(`\n❌ Falha no upload de ${episode.file}`);
      results.push({ episode, success: false, error: error.message });
    }
  }

  // Sumário
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMÁRIO DO UPLOAD');
  console.log('='.repeat(60));

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`\n✅ Sucessos: ${successful}`);
  console.log(`❌ Falhas: ${failed}\n`);

  if (successful > 0) {
    console.log('Episódios enviados com sucesso:');
    results.filter(r => r.success).forEach(r => {
      console.log(`  - S${r.episode.season}E${r.episode.episode}: ${r.episode.file}`);
    });
  }

  if (failed > 0) {
    console.log('\nEpisódios com falha:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`  - S${r.episode.season}E${r.episode.episode}: ${r.episode.file}`);
      console.log(`    Erro: ${r.error}`);
    });
  }

  console.log('\n' + '='.repeat(60) + '\n');
}

// Executar
main().catch(error => {
  console.error('\n❌ Erro fatal:', error.message);
  process.exit(1);
});
