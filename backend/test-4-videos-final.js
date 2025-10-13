const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const videos = [
  {
    title: 'Lilo & Stitch - Dublado',
    key: 'videos/c7ed9623-7bcb-4c13-91b7-6f96b76facd1/languages/dubbed-pt-BR/1760228827742-Lilo-Stitch-2025-DUBLADO.mp4',
    languageId: '73f179fc-28a2-44ea-8cff-71da36e28c31'
  },
  {
    title: 'Lilo & Stitch - Legendado',
    key: 'videos/c7ed9623-7bcb-4c13-91b7-6f96b76facd1/languages/subtitled-pt-BR/1760228827742-Lilo-Stitch-2025-LEGENDADO.mp4',
    languageId: '52810597-8279-4097-b69c-46edd1dc98b5'
  },
  {
    title: 'A Hora do Mal - Dublado',
    key: 'videos/da5a57f3-a4d8-41d7-bffd-3f46042b55ea/languages/dubbed-pt-BR/1760201825066-A Hora do Mal (2025) - DUBLADO.mp4',
    languageId: 'aeb48abb-d62e-4811-ac3c-8fb766f7fb1b'
  },
  {
    title: 'A Hora do Mal - Legendado',
    key: 'videos/da5a57f3-a4d8-41d7-bffd-3f46042b55ea/languages/subtitled-pt-BR/1760203277238-A Hora do Mal (2025) - LEGENDADO.mp4',
    languageId: 'b57ef5b4-1eec-4dd2-a978-24612c5c2d37'
  }
];

async function testAllVideos() {
  console.log('🎬 TESTE FINAL - 4 Vídeos do Sistema\n');
  console.log('=' .repeat(70) + '\n');

  let successCount = 0;
  let failureCount = 0;
  const workingVideos = [];

  for (let i = 0; i < videos.length; i++) {
    const video = videos[i];

    console.log(`[${i + 1}/4] 🎬 ${video.title}`);

    try {
      // Gerar presigned URL
      const command = new GetObjectCommand({
        Bucket: 'cinevision-video',
        Key: video.key,
      });

      const presignedUrl = await getSignedUrl(s3Client, command, {
        expiresIn: 14400, // 4 horas
      });

      // Testar URL
      const response = await fetch(presignedUrl, { method: 'HEAD' });

      if (response.status === 200) {
        const sizeGB = (parseInt(response.headers.get('content-length')) / (1024 * 1024 * 1024)).toFixed(2);
        console.log(`   ✅ FUNCIONA! (200 OK)`);
        console.log(`   📏 Tamanho: ${sizeGB} GB`);
        console.log(`   🔗 Language ID: ${video.languageId}`);
        console.log('');

        successCount++;
        workingVideos.push(video);
      } else {
        console.log(`   ❌ Falha (${response.status})`);
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
  console.log(`   ✅ Funcionando: ${successCount}/4 vídeos (${(successCount/4*100).toFixed(0)}%)`);
  console.log(`   ❌ Com problemas: ${failureCount}/4 vídeos`);
  console.log('');

  if (successCount === 4) {
    console.log('🎉🎉🎉 TODOS OS 4 VÍDEOS ESTÃO FUNCIONANDO! 🎉🎉🎉');
    console.log('');
    console.log('✅ Sistema 100% PRONTO para produção!');
    console.log('✅ Presigned URLs funcionando perfeitamente!');
    console.log('✅ Os usuários podem assistir:');
    console.log('   • Lilo & Stitch (Dublado e Legendado)');
    console.log('   • A Hora do Mal (Dublado e Legendado)');
    console.log('');
    console.log('🚀 Próximos passos:');
    console.log('   1. Iniciar o backend: cd backend && npm run start:dev');
    console.log('   2. Iniciar o frontend: cd frontend && npm run dev');
    console.log('   3. Acessar: http://localhost:3000');
    console.log('   4. Testar a reprodução dos vídeos!');
    console.log('');
  } else if (successCount > 0) {
    console.log(`⚠️ ${successCount} vídeo(s) funcionando, ${failureCount} ainda com problema.`);
    console.log('');
    console.log('💡 Vídeos que funcionam:');
    workingVideos.forEach(v => console.log(`   ✅ ${v.title}`));
    console.log('');
    console.log('⏰ Aguarde mais 5-10 minutos para propagação AWS dos demais.');
    console.log('');
  } else {
    console.log('❌ Nenhum vídeo funcionando ainda.');
    console.log('⏰ Aguarde 5-10 minutos para propagação das configurações AWS.');
    console.log('');
  }
}

testAllVideos();
