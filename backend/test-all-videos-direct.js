const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { createClient } = require('@supabase/supabase-js');

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const supabase = createClient(
  'https://szghyvnbmjlquznxhqum.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6Z2h5dm5ibWpscXV6bnhocXVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3NDk5OTksImV4cCI6MjA3NDMyNTk5OX0._VqIPIYTflB8j8bdShAqet5GGSgXeP1auh1Mj3mLfLs'
);

async function testAllVideos() {
  console.log('🎬 Testando TODOS os vídeos do sistema\n');
  console.log('=' .repeat(70) + '\n');

  // Buscar vídeos do banco
  const { data: videos, error } = await supabase
    .from('content_languages')
    .select(`
      id,
      language_type,
      language_code,
      video_storage_key,
      content:content_id (title)
    `)
    .not('video_storage_key', 'is', null)
    .in('content.title', ['A Hora do Mal', 'Lilo & Stitch']);

  if (error || !videos || videos.length === 0) {
    console.error('❌ Erro ao buscar vídeos:', error?.message || 'Nenhum vídeo encontrado');
    return;
  }

  console.log(`📊 Encontrados ${videos.length} vídeos\n`);

  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < videos.length; i++) {
    const video = videos[i];
    const title = video.content?.title || 'Desconhecido';
    const type = video.language_type === 'dubbed' ? 'Dublado' : 'Legendado';

    console.log(`[${i + 1}/${videos.length}] 🎬 ${title} - ${type}`);
    console.log(`📁 ${video.video_storage_key}`);

    try {
      // Gerar presigned URL
      console.log('   🔑 Gerando URL assinada...');

      const command = new GetObjectCommand({
        Bucket: 'cinevision-video',
        Key: video.video_storage_key,
      });

      const presignedUrl = await getSignedUrl(s3Client, command, {
        expiresIn: 14400, // 4 horas
      });

      console.log('   ✅ URL gerada');

      // Testar URL
      console.log('   🧪 Testando acesso...');

      const response = await fetch(presignedUrl, { method: 'HEAD' });

      if (response.status === 200) {
        console.log('   ✅ FUNCIONA! (200 OK)');
        console.log('   📏 Tamanho:', response.headers.get('content-length'), 'bytes');
        console.log('   📦 Tipo:', response.headers.get('content-type'));
        console.log('');
        successCount++;
      } else {
        console.log(`   ❌ Falha (${response.status} ${response.statusText})`);
        console.log('');
        failureCount++;
      }

    } catch (error) {
      console.log(`   ❌ Erro: ${error.message}`);
      console.log('');
      failureCount++;
    }
  }

  console.log('=' .repeat(70));
  console.log('\n📊 RESULTADO FINAL:\n');
  console.log(`   ✅ Funcionando: ${successCount}/${videos.length} vídeos`);
  console.log(`   ❌ Com problemas: ${failureCount}/${videos.length} vídeos`);
  console.log('');

  if (successCount === videos.length) {
    console.log('🎉🎉🎉 TODOS OS VÍDEOS ESTÃO FUNCIONANDO! 🎉🎉🎉');
    console.log('');
    console.log('✅ Sistema PRONTO para os usuários assistirem!');
    console.log('✅ Presigned URLs funcionando perfeitamente!');
    console.log('✅ Pode iniciar o frontend e testar a reprodução!');
    console.log('');
  } else {
    console.log('⚠️ Alguns vídeos ainda com problema.');
    console.log('💡 Aguarde mais alguns minutos para propagação AWS.');
    console.log('');
  }
}

testAllVideos();
