// Teste simplificado - apenas multipart upload (o que realmente precisamos)
require('dotenv').config();
const { S3Client, CreateMultipartUploadCommand, AbortMultipartUploadCommand } = require('@aws-sdk/client-s3');

const region = process.env.AWS_REGION || 'us-east-2';
const bucket = process.env.S3_RAW_BUCKET || 'cinevision-raw';
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

console.log('\n🔍 Testando multipart upload AWS S3...\n');

if (!accessKeyId || !secretAccessKey) {
  console.log('❌ Credenciais AWS não encontradas no .env');
  process.exit(1);
}

console.log('📋 Configuração:');
console.log(`   AWS_REGION: ${region}`);
console.log(`   S3_RAW_BUCKET: ${bucket}`);
console.log(`   AWS_ACCESS_KEY_ID: ${accessKeyId.substring(0, 8)}...`);
console.log('');

const s3Client = new S3Client({
  region,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

async function testMultipartUpload() {
  let uploadId = null;
  const testKey = `raw/test/credentials-test-${Date.now()}.txt`;

  try {
    console.log('🧪 Teste: Iniciar multipart upload no bucket...');

    const createCommand = new CreateMultipartUploadCommand({
      Bucket: bucket,
      Key: testKey,
      ContentType: 'text/plain',
      Metadata: {
        test: 'credentials-validation',
        timestamp: new Date().toISOString(),
      },
    });

    const result = await s3Client.send(createCommand);
    uploadId = result.UploadId;

    console.log(`✅ SUCESSO! Multipart upload iniciado!`);
    console.log(`   Upload ID: ${uploadId}`);
    console.log(`   Bucket: ${bucket}`);
    console.log(`   Key: ${testKey}`);
    console.log('');

    // Limpar o teste
    console.log('🧹 Limpando teste...');
    const abortCommand = new AbortMultipartUploadCommand({
      Bucket: bucket,
      Key: testKey,
      UploadId: uploadId,
    });
    await s3Client.send(abortCommand);
    console.log('✅ Teste limpo com sucesso');
    console.log('');

    console.log('🎉 CREDENCIAIS FUNCIONANDO PERFEITAMENTE NO AMBIENTE LOCAL!');
    console.log('');
    console.log('✅ Conclusão:');
    console.log('   - As credenciais LOCAIS estão corretas e funcionando');
    console.log('   - O problema está APENAS no Render');
    console.log('   - As credenciais no Render estão INCORRETAS ou DESATUALIZADAS');
    console.log('');
    console.log('🔧 Próximos passos URGENTES:');
    console.log('   1. Acesse: https://dashboard.render.com/web/srv-d3mp4ibipnbc73ctm470');
    console.log('   2. Clique em "Environment"');
    console.log('   3. Atualize AWS_ACCESS_KEY_ID com o valor do .env local');
    console.log('   4. Atualize AWS_SECRET_ACCESS_KEY com o valor do .env local');
    console.log('   5. Clique em "Save Changes"');
    console.log('   6. Aguarde redeploy automático (2-3 minutos)');
    console.log('   7. Teste o upload dos episódios novamente');

  } catch (error) {
    console.log('\n❌ ERRO NO TESTE DE MULTIPART UPLOAD!\n');

    if (error.name === 'InvalidAccessKeyId') {
      console.log('🔴 AWS_ACCESS_KEY_ID está incorreto');
    } else if (error.name === 'SignatureDoesNotMatch') {
      console.log('🔴 AWS_SECRET_ACCESS_KEY está incorreto');
      console.log('   ESTE É O MESMO ERRO DO RENDER!');
    } else if (error.name === 'NoSuchBucket') {
      console.log('🔴 Bucket não existe:', bucket);
    } else if (error.name === 'AccessDenied') {
      console.log('🔴 Sem permissão para criar multipart upload');
      console.log('   O usuário IAM precisa de: s3:PutObject, s3:ListMultipartUploadParts');
    } else {
      console.log('🔴 Erro:', error.name);
    }

    console.log('\n📋 Detalhes:');
    console.log('   Mensagem:', error.message);
    console.log('   Code:', error.Code);

    if (uploadId) {
      console.log('\n🧹 Tentando limpar upload incompleto...');
      try {
        await s3Client.send(new AbortMultipartUploadCommand({
          Bucket: bucket,
          Key: testKey,
          UploadId: uploadId,
        }));
      } catch (e) {
        // Ignore cleanup errors
      }
    }

    process.exit(1);
  }
}

testMultipartUpload();
