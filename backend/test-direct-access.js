const { S3Client, HeadObjectCommand } = require('@aws-sdk/client-s3');

// Load credentials from environment variables
require('dotenv').config();

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

async function testDirectAccess() {
  try {
    const videoKey = 'videos/c7ed9623-7bcb-4c13-91b7-6f96b76facd1/languages/dubbed-pt-BR/1760228827742-Lilo-Stitch-2025-DUBLADO.mp4';

    console.log('🔄 Testando acesso direto ao objeto (sem presigned URL)...');
    console.log('📁 Key:', videoKey);
    console.log('🪣 Bucket: cinevision-video');
    console.log('');

    const command = new HeadObjectCommand({
      Bucket: 'cinevision-video',
      Key: videoKey,
    });

    const response = await s3Client.send(command);

    console.log('✅ Acesso direto FUNCIONOU!');
    console.log('📊 Status: 200 OK');
    console.log('📦 Content-Type:', response.ContentType);
    console.log('📏 Content-Length:', response.ContentLength, 'bytes');
    console.log('📅 Last-Modified:', response.LastModified);
    console.log('');
    console.log('✅✅✅ As credenciais cinevision-uploader TÊM permissão! ✅✅✅');
    console.log('');
    console.log('O problema está nas presigned URLs.');
    console.log('');
    return true;

  } catch (error) {
    console.error('❌ Erro ao acessar objeto:', error.name, '-', error.message);
    console.error('');
    console.error('As credenciais cinevision-uploader NÃO têm permissão.');
    console.error('');
    return false;
  }
}

testDirectAccess();
