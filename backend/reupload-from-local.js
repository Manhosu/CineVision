const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { GetObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');

const s3Client = new S3Client({
  region: 'us-east-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const videos = [
  {
    title: 'A Hora do Mal - Dublado',
    localPath: 'E:/movies/FILME_ A Hora do Mal (2025)/A Hora do Mal (2025) - DUBLADO.mp4',
    s3Key: 'videos/da5a57f3-a4d8-41d7-bffd-3f46042b55ea/languages/dubbed-pt-BR/1760201825066-A Hora do Mal (2025) - DUBLADO.mp4',
    languageId: 'aeb48abb-d62e-4811-ac3c-8fb766f7fb1b'
  },
  {
    title: 'A Hora do Mal - Legendado',
    localPath: 'E:/movies/FILME_ A Hora do Mal (2025)/A Hora do Mal (2025) - LEGENDADO.mp4',
    s3Key: 'videos/da5a57f3-a4d8-41d7-bffd-3f46042b55ea/languages/subtitled-pt-BR/1760203277238-A Hora do Mal (2025) - LEGENDADO.mp4',
    languageId: 'b57ef5b4-1eec-4dd2-a978-24612c5c2d37'
  },
  {
    title: 'Lilo & Stitch - Dublado',
    localPath: 'E:/movies/FILME_  Lilo & Stitch (2025)/Lilo & Stitch (2025) - DUBLADO.mp4',
    s3Key: 'videos/c7ed9623-7bcb-4c13-91b7-6f96b76facd1/languages/dubbed-pt-BR/1760228827742-Lilo-Stitch-2025-DUBLADO.mp4',
    languageId: '73f179fc-28a2-44ea-8cff-71da36e28c31'
  },
  {
    title: 'Lilo & Stitch - Legendado',
    localPath: 'E:/movies/FILME_  Lilo & Stitch (2025)/Lilo & Stitch (2025) - LEGENDADO.mp4',
    s3Key: 'videos/c7ed9623-7bcb-4c13-91b7-6f96b76facd1/languages/subtitled-pt-BR/1760228827742-Lilo-Stitch-2025-LEGENDADO.mp4',
    languageId: '52810597-8279-4097-b69c-46edd1dc98b5'
  }
];

async function reuploadVideo(video) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🎬 ${video.title}`);
  console.log(`${'='.repeat(70)}\n`);

  try {
    // 1. Verificar se arquivo local existe
    console.log('📁 Verificando arquivo local...');
    if (!fs.existsSync(video.localPath)) {
      console.log(`   ❌ Arquivo não encontrado: ${video.localPath}`);
      return false;
    }

    const stats = fs.statSync(video.localPath);
    const fileSizeGB = (stats.size / (1024 * 1024 * 1024)).toFixed(2);
    console.log(`   ✅ Arquivo encontrado (${fileSizeGB} GB)`);

    // 2. Ler arquivo
    console.log('📖 Lendo arquivo...');
    const fileContent = fs.readFileSync(video.localPath);
    console.log('   ✅ Arquivo carregado na memória');

    // 3. Deletar arquivo antigo do S3
    console.log('🗑️  Deletando arquivo antigo do S3...');
    try {
      await s3Client.send(new DeleteObjectCommand({
        Bucket: 'cinevision-video',
        Key: video.s3Key,
      }));
      console.log('   ✅ Arquivo antigo deletado');
    } catch (deleteError) {
      console.log('   ⚠️  Erro ao deletar (pode não existir):', deleteError.message);
    }

    // 4. Upload novo com permissões corretas
    console.log('📤 Fazendo upload com permissões corretas...');
    const uploadCommand = new PutObjectCommand({
      Bucket: 'cinevision-video',
      Key: video.s3Key,
      Body: fileContent,
      ContentType: 'video/mp4',
      CacheControl: 'max-age=31536000',
      ACL: 'private', // ACL privado - presigned URLs funcionam
    });

    const startTime = Date.now();
    await s3Client.send(uploadCommand);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`   ✅ Upload concluído em ${elapsed}s`);

    // 5. Testar presigned URL
    console.log('🧪 Testando presigned URL...');
    const getCommand = new GetObjectCommand({
      Bucket: 'cinevision-video',
      Key: video.s3Key,
    });

    const presignedUrl = await getSignedUrl(s3Client, getCommand, {
      expiresIn: 14400,
    });

    const response = await fetch(presignedUrl, { method: 'HEAD' });

    if (response.status === 200) {
      console.log('   ✅ Presigned URL FUNCIONA! (200 OK)');
      console.log(`   📏 Content-Length: ${response.headers.get('content-length')} bytes`);
      console.log('');
      console.log(`✅✅✅ ${video.title} PRONTO PARA USO! ✅✅✅`);
      return true;
    } else {
      console.log(`   ⚠️  Presigned URL retorna ${response.status} (aguarde propagação)`);
      return false;
    }

  } catch (error) {
    console.error(`\n❌ ERRO: ${error.message}\n`);
    return false;
  }
}

async function reuploadAll() {
  console.log('🚀 RE-UPLOAD DE TODOS OS VÍDEOS\n');
  console.log('⏱️  Tempo estimado: 15-20 minutos (6.4 GB total)\n');

  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < videos.length; i++) {
    console.log(`\n📊 Progresso: ${i + 1}/${videos.length}\n`);

    const success = await reuploadVideo(videos[i]);

    if (success) {
      successCount++;
    } else {
      failureCount++;
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('\n🏁 RESUMO FINAL:\n');
  console.log(`   ✅ Sucesso: ${successCount}/${videos.length} vídeos`);
  console.log(`   ❌ Falhas: ${failureCount}/${videos.length} vídeos`);
  console.log('');

  if (successCount === videos.length) {
    console.log('🎉🎉🎉 TODOS OS VÍDEOS FORAM RE-ENVIADOS COM SUCESSO! 🎉🎉🎉');
    console.log('');
    console.log('✅ Sistema 100% FUNCIONAL!');
    console.log('✅ Presigned URLs funcionando!');
    console.log('✅ Usuários podem assistir todos os filmes!');
    console.log('');
    console.log('🚀 Próximos passos:');
    console.log('   1. Iniciar backend: cd backend && npm run start:dev');
    console.log('   2. Iniciar frontend: cd frontend && npm run dev');
    console.log('   3. Acessar: http://localhost:3000');
    console.log('   4. Testar reprodução dos vídeos!');
    console.log('');
  } else {
    console.log('⚠️  Alguns vídeos falharam ou ainda precisam de propagação.');
    console.log('');
  }
}

reuploadAll();
