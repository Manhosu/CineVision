const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

// Load credentials from environment variables
require('dotenv').config();

async function testSimplePresigned() {
  console.log('🔧 Teste de Presigned URL Simplificado\n');

  const s3Client = new S3Client({
    region: 'us-east-2',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    },
    // Forçar assinatura v4
    signatureVersion: 'v4'
  });

  const videoKey = 'videos/c7ed9623-7bcb-4c13-91b7-6f96b76facd1/languages/dubbed-pt-BR/1760228827742-Lilo-Stitch-2025-DUBLADO.mp4';

  // Teste 1: Presigned URL simples
  console.log('📋 Teste 1: Presigned URL padrão\n');

  const command = new GetObjectCommand({
    Bucket: 'cinevision-video',
    Key: videoKey,
  });

  const url1 = await getSignedUrl(s3Client, command, {
    expiresIn: 3600,
    signableHeaders: new Set(['host']),
  });

  console.log('URL gerada:', url1.substring(0, 100) + '...\n');

  try {
    const response1 = await fetch(url1, { method: 'HEAD' });
    console.log('✅ Status:', response1.status, response1.statusText, '\n');

    if (response1.status === 200) {
      console.log('✅✅✅ FUNCIONOU! ✅✅✅\n');
      return true;
    }
  } catch (error) {
    console.log('❌ Erro:', error.message, '\n');
  }

  // Teste 2: Com endpoint específico
  console.log('\n📋 Teste 2: Com endpoint regional específico\n');

  const s3Client2 = new S3Client({
    region: 'us-east-2',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    },
    endpoint: 'https://s3.us-east-2.amazonaws.com',
    forcePathStyle: false
  });

  const command2 = new GetObjectCommand({
    Bucket: 'cinevision-video',
    Key: videoKey,
  });

  const url2 = await getSignedUrl(s3Client2, command2, {
    expiresIn: 3600
  });

  console.log('URL gerada:', url2.substring(0, 100) + '...\n');

  try {
    const response2 = await fetch(url2, { method: 'HEAD' });
    console.log('✅ Status:', response2.status, response2.statusText, '\n');

    if (response2.status === 200) {
      console.log('✅✅✅ FUNCIONOU! ✅✅✅\n');
      return true;
    }
  } catch (error) {
    console.log('❌ Erro:', error.message, '\n');
  }

  console.log('\n❌ Nenhum método funcionou.\n');
  console.log('🔍 Próximo passo: Verificar se há políticas SCP ou permissões de negação na conta AWS.\n');

  return false;
}

testSimplePresigned();
