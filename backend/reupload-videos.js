const { S3Client, CopyObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { createClient } = require('@supabase/supabase-js');

const s3Client = new S3Client({
  region: 'us-east-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const supabase = createClient(
  'https://szghyvnbmjlquznxhqum.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6Z2h5dm5ibWpscXV6bnhocXVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3NDk5OTksImV4cCI6MjA3NDMyNTk5OX0._VqIPIYTflB8j8bdShAqet5GGSgXeP1auh1Mj3mLfLs'
);

async function reuploadVideos() {
  console.log('🔄 Re-upload de Vídeos com Permissões Corretas\n');
  console.log('=' .repeat(60));

  // Buscar todos os vídeos do banco
  const { data: contentLanguages, error } = await supabase
    .from('content_languages')
    .select(`
      id,
      language_code,
      language_type,
      video_storage_key,
      content_id
    `)
    .not('video_storage_key', 'is', null);

  // Buscar títulos dos conteúdos
  const contentIds = [...new Set(contentLanguages.map(cl => cl.content_id))];
  const { data: contents } = await supabase
    .from('content')
    .select('id, title')
    .in('id', contentIds);

  // Mapear títulos
  const contentMap = {};
  contents.forEach(c => contentMap[c.id] = c);

  // Adicionar títulos aos content_languages
  contentLanguages.forEach(cl => {
    cl.content = contentMap[cl.content_id];
  });

  if (error) {
    console.error('❌ Erro ao buscar vídeos:', error.message);
    return;
  }

  if (!contentLanguages || contentLanguages.length === 0) {
    console.error('❌ Nenhum vídeo encontrado no banco de dados');
    return;
  }

  console.log(`\n📊 Encontrados ${contentLanguages.length} vídeos para re-upload\n`);

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < contentLanguages.length; i++) {
    const item = contentLanguages[i];
    const videoKey = item.video_storage_key;

    console.log(`\n[${i + 1}/${contentLanguages.length}] 🎬 ${item.content.title} - ${item.language_type} (${item.language_code})`);
    console.log(`📁 Key: ${videoKey}`);

    try {
      // 1. Verificar se o arquivo existe
      console.log('   🔍 Verificando arquivo...');
      const headCommand = new HeadObjectCommand({
        Bucket: 'cinevision-video',
        Key: videoKey,
      });

      const headResponse = await s3Client.send(headCommand);
      const fileSize = headResponse.ContentLength;
      const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(2);

      console.log(`   ✅ Arquivo existe (${fileSizeMB} MB)`);

      // 2. Copiar o objeto para ele mesmo com ACL correto
      console.log('   📋 Copiando com permissões corretas...');

      const copyCommand = new CopyObjectCommand({
        Bucket: 'cinevision-video',
        CopySource: `cinevision-video/${videoKey}`,
        Key: videoKey,
        MetadataDirective: 'COPY',
        ACL: 'private', // ACL privado (presigned URLs funcionam)
        ContentType: headResponse.ContentType || 'video/mp4',
        CacheControl: headResponse.CacheControl,
        ContentDisposition: headResponse.ContentDisposition,
      });

      await s3Client.send(copyCommand);

      console.log('   ✅ Re-upload concluído com permissões corretas!');
      successCount++;

    } catch (error) {
      console.error(`   ❌ Erro:`, error.message);
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n📊 RESUMO:\n');
  console.log(`   ✅ Sucesso: ${successCount} vídeos`);
  console.log(`   ❌ Erros: ${errorCount} vídeos`);
  console.log(`   📦 Total: ${contentLanguages.length} vídeos`);
  console.log('');

  if (successCount === contentLanguages.length) {
    console.log('🎉🎉🎉 TODOS OS VÍDEOS FORAM ATUALIZADOS! 🎉🎉🎉\n');
    console.log('🧪 Agora teste as presigned URLs:\n');
    console.log('   cd backend && node test-presigned-url.js\n');
  } else {
    console.log('⚠️ Alguns vídeos falharam. Verifique os erros acima.\n');
  }
}

reuploadVideos();
