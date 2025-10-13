const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');

async function testDownload() {
  console.log('🔧 Teste de Download Direto (sem presigned URL)\n');

  const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-2',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
  });

  const videoKey = 'videos/c7ed9623-7bcb-4c13-91b7-6f96b76facd1/languages/dubbed-pt-BR/1760228827742-Lilo-Stitch-2025-DUBLADO.mp4';

  try {
    console.log('📥 Tentando baixar primeiros 1000 bytes do vídeo...\n');

    const command = new GetObjectCommand({
      Bucket: 'cinevision-video',
      Key: videoKey,
      Range: 'bytes=0-999'
    });

    const response = await s3Client.send(command);

    console.log('✅ Download FUNCIONOU!');
    console.log('📊 Status:', response.$metadata.httpStatusCode);
    console.log('📦 Content-Type:', response.ContentType);
    console.log('📏 Content-Length:', response.ContentLength);
    console.log('📄 Content-Range:', response.ContentRange);
    console.log('');
    console.log('✅✅✅ Acesso direto via SDK funciona perfeitamente! ✅✅✅');
    console.log('');
    console.log('⚠️ MAS presigned URLs não funcionam.');
    console.log('');
    console.log('🔍 Isso indica um problema muito específico:');
    console.log('   - Pode ser Session Policy');
    console.log('   - Pode ser SCP (Service Control Policy)');
    console.log('   - Pode ser alguma configuração de conta AWS');
    console.log('');

    return true;

  } catch (error) {
    console.error('❌ Erro:', error.name, '-', error.message);
    return false;
  }
}

testDownload();
