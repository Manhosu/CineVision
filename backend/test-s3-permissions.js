const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');

// Configurar cliente S3
const s3Client = new S3Client({
  region: 'us-east-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

async function testS3Permissions() {
  console.log('🧪 Testando permissões S3...\n');

  try {
    // Criar um arquivo de teste pequeno
    const testContent = Buffer.from('Test upload - ' + new Date().toISOString());
    const testKey = 'test-permissions/test-' + Date.now() + '.txt';

    console.log('📤 Tentando fazer upload de teste...');
    console.log('📍 Bucket: cinevision-video');
    console.log('📍 Key:', testKey);

    const command = new PutObjectCommand({
      Bucket: 'cinevision-video',
      Key: testKey,
      Body: testContent,
      ContentType: 'text/plain',
    });

    const response = await s3Client.send(command);

    console.log('\n✅ SUCESSO! Upload completado');
    console.log('📊 Response:', {
      ETag: response.ETag,
      VersionId: response.VersionId,
    });
    console.log('\n✅ As permissões S3 estão configuradas corretamente!');
    console.log('✅ Você pode prosseguir com os uploads de vídeos.\n');

    return true;
  } catch (error) {
    console.error('\n❌ ERRO ao testar permissões S3:');
    console.error('Tipo:', error.name);
    console.error('Mensagem:', error.message);

    if (error.name === 'AccessDenied') {
      console.error('\n⚠️  As permissões ainda não estão corretas.');
      console.error('⚠️  Verifique se você aplicou a política IAM no console AWS.');
      console.error('⚠️  A política deve estar anexada ao usuário "cinevision-uploader".\n');
    }

    return false;
  }
}

// Executar teste
testS3Permissions()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Erro fatal:', error);
    process.exit(1);
  });
