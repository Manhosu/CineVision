const { S3Client, CopyObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { GetObjectCommand } = require('@aws-sdk/client-s3');

const s3Client = new S3Client({
  region: 'us-east-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

// Vídeos para corrigir permissões
const videos = [
  {
    title: 'Lilo & Stitch - Dublado',
    key: 'videos/c7ed9623-7bcb-4c13-91b7-6f96b76facd1/languages/dubbed-pt-BR/1760228827742-Lilo-Stitch-2025-DUBLADO.mp4'
  },
  {
    title: 'Lilo & Stitch - Legendado',
    key: 'videos/c7ed9623-7bcb-4c13-91b7-6f96b76facd1/languages/subtitled-pt-BR/1760228827742-Lilo-Stitch-2025-LEGENDADO.mp4'
  },
  {
    title: 'A Hora do Mal - Dublado',
    key: 'videos/da5a57f3-a4d8-41d7-bffd-3f46042b55ea/languages/dubbed-pt-BR/1760201825066-A Hora do Mal (2025) - DUBLADO.mp4'
  },
  {
    title: 'A Hora do Mal - Legendado',
    key: 'videos/da5a57f3-a4d8-41d7-bffd-3f46042b55ea/languages/subtitled-pt-BR/1760203277238-A Hora do Mal (2025) - LEGENDADO.mp4'
  }
];

async function fixPermissions() {
  console.log('🔧 Corrigindo Permissões dos Vídeos\n');
  console.log('=' .repeat(70));

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < videos.length; i++) {
    const video = videos[i];

    console.log(`\n[${i + 1}/${videos.length}] 🎬 ${video.title}`);
    console.log(`📁 ${video.key}`);

    try {
      // 1. Verificar se existe
      console.log('   🔍 Verificando...');
      const headCommand = new HeadObjectCommand({
        Bucket: 'cinevision-video',
        Key: video.key,
      });

      const headResponse = await s3Client.send(headCommand);
      const fileSizeMB = (headResponse.ContentLength / (1024 * 1024)).toFixed(2);
      console.log(`   ✅ Arquivo existe (${fileSizeMB} MB)`);

      // 2. Copiar com permissões corretas
      console.log('   📋 Atualizando permissões...');

      const copyCommand = new CopyObjectCommand({
        Bucket: 'cinevision-video',
        CopySource: `cinevision-video/${video.key}`,
        Key: video.key,
        MetadataDirective: 'REPLACE',
        ACL: 'private',
        ContentType: 'video/mp4',
        CacheControl: 'max-age=31536000',
      });

      await s3Client.send(copyCommand);
      console.log('   ✅ Permissões atualizadas!');

      // 3. Testar presigned URL
      console.log('   🧪 Testando presigned URL...');

      const getCommand = new GetObjectCommand({
        Bucket: 'cinevision-video',
        Key: video.key,
      });

      const presignedUrl = await getSignedUrl(s3Client, getCommand, {
        expiresIn: 3600,
      });

      const response = await fetch(presignedUrl, { method: 'HEAD' });

      if (response.status === 200) {
        console.log('   ✅ Presigned URL funciona! (200 OK)');
        successCount++;
      } else {
        console.log(`   ⚠️ Presigned URL retorna ${response.status}`);
        errorCount++;
      }

    } catch (error) {
      console.error(`   ❌ Erro:`, error.message);
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('\n📊 RESUMO:\n');
  console.log(`   ✅ Sucesso: ${successCount} vídeos`);
  console.log(`   ❌ Erros: ${errorCount} vídeos`);
  console.log(`   📦 Total: ${videos.length} vídeos\n`);

  if (successCount === videos.length) {
    console.log('🎉🎉🎉 TODOS OS VÍDEOS FUNCIONANDO! 🎉🎉🎉\n');
    console.log('✅ Sistema 100% pronto para produção!\n');
  } else {
    console.log('⚠️ Alguns vídeos ainda com problema.\n');
  }
}

fixPermissions();
