const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BUCKET_NAME = process.env.S3_VIDEO_BUCKET || 'cinevision-filmes';
const MOVIES_PATH = 'E:/movies';

// Mapeamento de filmes e seus arquivos
const videoFiles = [
  {
    title: 'Superman',
    files: [
      { path: 'E:/movies/FILME_ Superman (2025)/Superman (2025) - LEGENDADO.mp4', language: 'pt-BR', audioType: 'legendado' }
    ]
  },
  {
    title: 'Como Treinar o Seu Dragão',
    files: [
      { path: 'E:/movies/FILME_ Como Treinar o Seu Dragão (2025)/Como Treinar o Seu Dragão (2025) - DUBLADO.mp4', language: 'pt-BR', audioType: 'dublado' }
    ]
  },
  {
    title: 'F1 - O Filme',
    files: [
      { path: 'E:/movies/FILME_ F1 - O Filme (2025)/F1_ O Filme (2025) - DUBLADO.mp4', language: 'pt-BR', audioType: 'dublado' },
      { path: 'E:/movies/FILME_ F1 - O Filme (2025)/F1_ O Filme (2025) - LEGENDADO-005.mp4', language: 'pt-BR', audioType: 'legendado' }
    ]
  },
  {
    title: 'A Hora do Mal',
    files: [
      { path: 'E:/movies/FILME_ A Hora do Mal (2025)/A Hora do Mal (2025) - DUBLADO.mp4', language: 'pt-BR', audioType: 'dublado' },
      { path: 'E:/movies/FILME_ A Hora do Mal (2025)/A Hora do Mal (2025) - LEGENDADO.mp4', language: 'pt-BR', audioType: 'legendado' }
    ]
  },
  {
    title: 'Quarteto Fantástico 4 - Primeiros Passos',
    files: [
      { path: 'E:/movies/FILME_ Quarteto Fantástico 4 - Primeiros Passos (2025)/Quarteto Fantástico_ Primeiros Passos (2025) - DUBLADO-003.mp4', language: 'pt-BR', audioType: 'dublado' }
    ]
  },
  {
    title: 'Invocação do Mal 4: O Último Ritual',
    files: [
      { path: 'E:/movies/FILME_ Invocação do Mal 4_ O Último Ritual (2025)/Invocação do Mal 4_ O Último Ritual (2025) - DUBLADO-015.mp4', language: 'pt-BR', audioType: 'dublado' }
    ]
  },
  {
    title: 'Demon Slayer - Castelo Infinito',
    files: [
      { path: 'E:/movies/FILME_ Demon Slayer - Castelo Infinito (2025)/Demon Slayer - Castelo Infinito (2025) - DUBLADO-001.mp4', language: 'pt-BR', audioType: 'dublado' },
      { path: 'E:/movies/FILME_ Demon Slayer - Castelo Infinito (2025)/DEMON SLAYER LEGENDADO-002.mp4', language: 'pt-BR', audioType: 'legendado' }
    ]
  },
  {
    title: 'A Longa Marcha - Caminhe ou Morra',
    files: [
      { path: 'E:/movies/FILME_ A Longa Marcha - Caminhe ou Morra (2025)/A Longa Marcha_ Caminhe ou Morra (2025) - DUBLADO -008.mp4', language: 'pt-BR', audioType: 'dublado' }
    ]
  },
  {
    title: 'Jurassic World: Recomeço',
    files: [
      { path: 'E:/movies/FILME_ Jurassic World_ Recomeço (2025)/Jurassic World_ Recomeço (2025) - DUBLADO.mp4', language: 'pt-BR', audioType: 'dublado' },
      { path: 'E:/movies/FILME_ Jurassic World_ Recomeço (2025)/Jurassic World_ Recomeço (2025) - LEGENDADO.mp4', language: 'pt-BR', audioType: 'legendado' }
    ]
  },
  {
    title: 'Lilo & Stitch',
    files: [
      { path: 'E:/movies/FILME_  Lilo & Stitch (2025)/Lilo & Stitch (2025) - DUBLADO.mp4', language: 'pt-BR', audioType: 'dublado' },
      { path: 'E:/movies/FILME_  Lilo & Stitch (2025)/Lilo & Stitch (2025) - LEGENDADO.mp4', language: 'pt-BR', audioType: 'legendado' }
    ]
  }
];

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

async function uploadToS3(filePath, s3Key) {
  console.log(`  📤 Fazendo upload para S3: ${s3Key}`);

  const fileStream = fs.createReadStream(filePath);
  const stats = fs.statSync(filePath);

  console.log(`     Tamanho: ${formatBytes(stats.size)}`);

  const uploadParams = {
    Bucket: BUCKET_NAME,
    Key: s3Key,
    Body: fileStream,
    ContentType: 'video/mp4',
  };

  const startTime = Date.now();
  await s3Client.send(new PutObjectCommand(uploadParams));
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  const videoUrl = `https://${BUCKET_NAME}.s3.amazonaws.com/${s3Key}`;
  console.log(`  ✅ Upload concluído em ${duration}s`);
  console.log(`     URL: ${videoUrl}`);

  return { videoUrl, fileSize: stats.size };
}

async function findContentByTitle(title) {
  const { data, error } = await supabase
    .from('content')
    .select('id, title')
    .ilike('title', `%${title}%`)
    .single();

  if (error) {
    console.error(`  ❌ Erro ao buscar filme "${title}":`, error.message);
    return null;
  }

  return data;
}

async function createContentLanguage(contentId, videoUrl, language, audioType, fileSize) {
  // Verificar se já existe
  const { data: existing } = await supabase
    .from('content_languages')
    .select('id')
    .eq('content_id', contentId)
    .eq('language', language)
    .eq('audio_type', audioType)
    .single();

  if (existing) {
    console.log(`  ℹ️  Versão ${audioType} já existe, atualizando...`);

    const { error: updateError } = await supabase
      .from('content_languages')
      .update({
        video_url: videoUrl,
        video_storage_key: videoUrl.split('.com/')[1],
        file_size_bytes: fileSize,
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id);

    if (updateError) {
      throw new Error(`Erro ao atualizar: ${updateError.message}`);
    }

    return existing.id;
  }

  // Criar novo registro
  const { data, error } = await supabase
    .from('content_languages')
    .insert([{
      content_id: contentId,
      language: language,
      audio_type: audioType,
      video_url: videoUrl,
      video_storage_key: videoUrl.split('.com/')[1],
      file_size_bytes: fileSize,
      is_primary: audioType === 'dublado',
      quality: '1080p',
      status: 'ready'
    }])
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao criar registro: ${error.message}`);
  }

  return data.id;
}

async function processMovie(movieData) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🎬 Processando: ${movieData.title}`);
  console.log(`${'='.repeat(80)}`);

  // Buscar filme no banco
  const content = await findContentByTitle(movieData.title);
  if (!content) {
    console.log(`  ⚠️  Filme não encontrado no banco, pulando...`);
    return;
  }

  console.log(`  ✓ Filme encontrado: ${content.id}`);

  // Processar cada arquivo de vídeo
  for (const file of movieData.files) {
    console.log(`\n  📹 Processando versão ${file.audioType.toUpperCase()}`);

    // Verificar se o arquivo existe
    if (!fs.existsSync(file.path)) {
      console.log(`  ❌ Arquivo não encontrado: ${file.path}`);
      continue;
    }

    try {
      // Criar nome do arquivo no S3
      const fileName = path.basename(file.path);
      const s3Key = `movies/${content.id}/${file.audioType}/${fileName}`;

      // Upload para S3
      const { videoUrl, fileSize } = await uploadToS3(file.path, s3Key);

      // Criar/atualizar registro no banco
      await createContentLanguage(content.id, videoUrl, file.language, file.audioType, fileSize);

      console.log(`  ✅ Versão ${file.audioType} processada com sucesso`);
    } catch (error) {
      console.error(`  ❌ Erro ao processar ${file.audioType}:`, error.message);
    }
  }
}

async function main() {
  console.log('\n🚀 Iniciando upload de vídeos para S3...\n');
  console.log(`Bucket: ${BUCKET_NAME}`);
  console.log(`Região: ${process.env.AWS_REGION}`);
  console.log(`Total de filmes: ${videoFiles.length}`);
  console.log(`Total de arquivos: ${videoFiles.reduce((sum, m) => sum + m.files.length, 0)}`);

  const startTime = Date.now();

  for (const movieData of videoFiles) {
    try {
      await processMovie(movieData);
    } catch (error) {
      console.error(`\n❌ Erro ao processar "${movieData.title}":`, error);
    }
  }

  const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
  console.log(`\n${'='.repeat(80)}`);
  console.log(`✅ Processo concluído em ${duration} minutos!`);
  console.log(`${'='.repeat(80)}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });
