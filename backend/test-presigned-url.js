const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

// Load credentials from environment variables
require('dotenv').config();

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

async function testPresignedUrl() {
  try {
    // Testar com um dos vídeos do Lilo & Stitch
    const videoKey = 'videos/c7ed9623-7bcb-4c13-91b7-6f96b76facd1/languages/dubbed-pt-BR/1760228827742-Lilo-Stitch-2025-DUBLADO.mp4';

    console.log('🔄 Gerando URL assinada para:', videoKey);

    const command = new GetObjectCommand({
      Bucket: 'cinevision-video',
      Key: videoKey,
    });

    const presignedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 14400, // 4 horas
    });

    console.log('\n✅ URL assinada gerada com sucesso!');
    console.log('\n📋 URL:', presignedUrl);
    console.log('\n🔍 Testando acesso à URL...\n');

    // Testar acesso à URL
    const response = await fetch(presignedUrl, { method: 'HEAD' });

    console.log('📊 Status:', response.status, response.statusText);
    console.log('📦 Content-Type:', response.headers.get('content-type'));
    console.log('📏 Content-Length:', response.headers.get('content-length'), 'bytes');

    if (response.status === 200) {
      console.log('\n✅✅✅ SUCESSO! O vídeo está acessível! ✅✅✅\n');
      return true;
    } else {
      console.log('\n❌ ERRO: Status não é 200 OK\n');
      return false;
    }

  } catch (error) {
    console.error('❌ Erro ao testar URL:', error.message);
    return false;
  }
}

testPresignedUrl();
