require('dotenv').config();
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const s3Client = new S3Client({
  region: 'us-east-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

async function test() {
  console.log('🔍 TESTE: Arquivo médio (200 MB)\n');

  const testKey = `test-medium/medium-${Date.now()}.bin`;

  console.log('   📝 Criando arquivo de 200 MB...');
  const buffer = Buffer.alloc(200 * 1024 * 1024);

  await s3Client.send(new PutObjectCommand({
    Bucket: 'cinevision-video',
    Key: testKey,
    Body: buffer,
    ContentType: 'application/octet-stream',
  }));

  console.log('   ✅ Upload completado\n');

  const getCmd = new GetObjectCommand({
    Bucket: 'cinevision-video',
    Key: testKey,
  });

  const presignedUrl = await getSignedUrl(s3Client, getCmd, {
    expiresIn: 3600,
  });

  console.log('   🔑 Presigned URL gerada\n');

  const response = await fetch(presignedUrl, { method: 'HEAD' });

  console.log(`   📡 Status: ${response.status}\n`);

  if (response.status === 200) {
    console.log('   ✅ ARQUIVO 200MB: FUNCIONOU!\n');
  } else {
    console.log('   ❌ ARQUIVO 200MB: FALHOU\n');
  }

  console.log('🎬 TESTE: Vídeo real\n');

  const videoKey = 'videos/c7ed9623-7bcb-4c13-91b7-6f96b76facd1/languages/dubbed-pt-BR/1760228827742-Lilo-Stitch-2025-DUBLADO.mp4';

  const videoCmd = new GetObjectCommand({
    Bucket: 'cinevision-video',
    Key: videoKey,
  });

  const videoUrl = await getSignedUrl(s3Client, videoCmd, {
    expiresIn: 3600,
  });

  const videoResponse = await fetch(videoUrl, { method: 'HEAD' });

  console.log(`   📡 Status: ${videoResponse.status}\n`);

  if (videoResponse.status === 200) {
    console.log('   ✅ VÍDEO: FUNCIONOU!');
  } else {
    console.log('   ❌ VÍDEO: FALHOU');
  }
}

test().catch(console.error);
