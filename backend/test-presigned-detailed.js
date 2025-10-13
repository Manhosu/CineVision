require('dotenv').config();
const { S3Client, GetObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const s3Client = new S3Client({
  region: 'us-east-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

async function testPresignedUrl() {
  console.log('🔍 TESTE DETALHADO DE PRESIGNED URL\n');

  const testKey = 'videos/c7ed9623-7bcb-4c13-91b7-6f96b76facd1/languages/dubbed-pt-BR/1760228827742-Lilo-Stitch-2025-DUBLADO.mp4';

  console.log('📋 Informações:');
  console.log(`   Bucket: cinevision-video`);
  console.log(`   Key: ${testKey}`);
  console.log(`   Region: us-east-2`);
  console.log(`   User: cinevision-uploader`);
  console.log('');

  // Teste 1: HeadObject direto (sem presigned URL)
  console.log('📊 TESTE 1: HeadObject direto');
  try {
    const headCommand = new HeadObjectCommand({
      Bucket: 'cinevision-video',
      Key: testKey,
    });

    const headResult = await s3Client.send(headCommand);
    console.log('   ✅ Acesso direto via SDK: SUCESSO');
    console.log(`   📦 Tamanho: ${(headResult.ContentLength / 1024 / 1024 / 1024).toFixed(2)} GB`);
    console.log(`   📝 Content-Type: ${headResult.ContentType}`);
    console.log(`   🔒 Server-Side Encryption: ${headResult.ServerSideEncryption || 'None'}`);
  } catch (error) {
    console.log('   ❌ Acesso direto via SDK: FALHA');
    console.log(`   Erro: ${error.message}`);
  }
  console.log('');

  // Teste 2: Presigned URL curta (1 hora)
  console.log('📊 TESTE 2: Presigned URL (1 hora)');
  try {
    const getCommand = new GetObjectCommand({
      Bucket: 'cinevision-video',
      Key: testKey,
    });

    const presignedUrl = await getSignedUrl(s3Client, getCommand, {
      expiresIn: 3600,
    });

    console.log('   ✅ URL gerada com sucesso');
    console.log(`   🔗 URL: ${presignedUrl.substring(0, 100)}...`);
    console.log('');
    console.log('   🌐 Testando acesso HTTP...');

    const response = await fetch(presignedUrl, { method: 'HEAD' });

    if (response.status === 200) {
      console.log('   ✅ Presigned URL: FUNCIONANDO');
      console.log(`   📦 Content-Length: ${response.headers.get('content-length')} bytes`);
      console.log(`   📝 Content-Type: ${response.headers.get('content-type')}`);
    } else {
      console.log(`   ❌ Presigned URL: FALHA (Status ${response.status})`);
      const errorText = await response.text();
      console.log(`   Resposta: ${errorText.substring(0, 200)}`);
    }
  } catch (error) {
    console.log('   ❌ Erro ao gerar/testar presigned URL');
    console.log(`   Erro: ${error.message}`);
  }
  console.log('');

  // Teste 3: Presigned URL longa (4 horas)
  console.log('📊 TESTE 3: Presigned URL (4 horas)');
  try {
    const getCommand = new GetObjectCommand({
      Bucket: 'cinevision-video',
      Key: testKey,
    });

    const presignedUrl = await getSignedUrl(s3Client, getCommand, {
      expiresIn: 14400,
    });

    const response = await fetch(presignedUrl, { method: 'HEAD' });

    if (response.status === 200) {
      console.log('   ✅ Presigned URL 4h: FUNCIONANDO');
    } else {
      console.log(`   ❌ Presigned URL 4h: FALHA (Status ${response.status})`);
    }
  } catch (error) {
    console.log('   ❌ Erro: ' + error.message);
  }
  console.log('');

  console.log('======================================================================');
  console.log('');
  console.log('💡 DIAGNÓSTICO:');
  console.log('');
  console.log('Se acesso direto via SDK funciona mas presigned URL falha:');
  console.log('   → Block Public Access pode estar bloqueando presigned URLs');
  console.log('   → Configuração de ACL pode estar incorreta');
  console.log('   → Política do bucket pode estar bloqueando');
  console.log('');
}

testPresignedUrl().catch(console.error);
