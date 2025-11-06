// Script para testar credenciais AWS S3
require('dotenv').config();
const { S3Client, CreateMultipartUploadCommand, ListBucketsCommand } = require('@aws-sdk/client-s3');

const region = process.env.AWS_REGION || 'us-east-2';
const bucket = process.env.S3_RAW_BUCKET || 'cinevision-raw';
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

console.log('\n🔍 Testando credenciais AWS S3...\n');

if (!accessKeyId || !secretAccessKey) {
  console.log('❌ Credenciais AWS não encontradas no .env');
  console.log('   Certifique-se que AWS_ACCESS_KEY_ID e AWS_SECRET_ACCESS_KEY estão configurados');
  process.exit(1);
}

console.log('📋 Configuração:');
console.log(`   AWS_REGION: ${region}`);
console.log(`   S3_RAW_BUCKET: ${bucket}`);
console.log(`   AWS_ACCESS_KEY_ID: ${accessKeyId.substring(0, 8)}...${accessKeyId.substring(accessKeyId.length - 4)}`);
console.log(`   AWS_SECRET_ACCESS_KEY: ${secretAccessKey.substring(0, 4)}...${secretAccessKey.substring(secretAccessKey.length - 4)}`);
console.log('');

const s3Client = new S3Client({
  region,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

async function testCredentials() {
  try {
    // Teste 1: Listar buckets (teste básico de autenticação)
    console.log('🧪 Teste 1: Listar buckets (autenticação básica)...');
    const listCommand = new ListBucketsCommand({});
    const listResult = await s3Client.send(listCommand);
    console.log(`✅ Autenticação OK - ${listResult.Buckets?.length || 0} buckets encontrados`);

    // Verificar se o bucket necessário existe
    const bucketExists = listResult.Buckets?.some(b => b.Name === bucket);
    if (bucketExists) {
      console.log(`✅ Bucket '${bucket}' encontrado!`);
    } else {
      console.log(`⚠️  Bucket '${bucket}' NÃO encontrado na lista`);
      console.log('   Buckets disponíveis:', listResult.Buckets?.map(b => b.Name).join(', '));
    }
    console.log('');

    // Teste 2: Iniciar multipart upload (teste específico para o erro)
    console.log('🧪 Teste 2: Iniciar multipart upload (teste completo)...');
    const testKey = `raw/test/test-${Date.now()}.txt`;
    const createCommand = new CreateMultipartUploadCommand({
      Bucket: bucket,
      Key: testKey,
      ContentType: 'text/plain',
      Metadata: {
        test: 'true',
        timestamp: new Date().toISOString(),
      },
    });

    const result = await s3Client.send(createCommand);
    console.log(`✅ Multipart upload iniciado com sucesso!`);
    console.log(`   Upload ID: ${result.UploadId}`);
    console.log(`   Key: ${testKey}`);
    console.log('');

    console.log('🎉 TODAS AS CREDENCIAIS ESTÃO FUNCIONANDO CORRETAMENTE!');
    console.log('');
    console.log('✅ Próximos passos:');
    console.log('   1. As credenciais locais estão OK');
    console.log('   2. Atualize as mesmas credenciais no Render');
    console.log('   3. Acesse: https://dashboard.render.com/web/srv-d3mp4ibipnbc73ctm470');
    console.log('   4. Vá em "Environment" e atualize AWS_ACCESS_KEY_ID e AWS_SECRET_ACCESS_KEY');
    console.log('   5. Aguarde redeploy e teste o upload de episódios novamente');

  } catch (error) {
    console.log('\n❌ ERRO AO TESTAR CREDENCIAIS AWS!\n');

    if (error.name === 'InvalidAccessKeyId') {
      console.log('🔴 Problema: AWS_ACCESS_KEY_ID está incorreto ou inválido');
      console.log('   Solução: Verifique se copiou corretamente a Access Key do AWS IAM');
    } else if (error.name === 'SignatureDoesNotMatch') {
      console.log('🔴 Problema: AWS_SECRET_ACCESS_KEY está incorreto');
      console.log('   Solução: Verifique se copiou corretamente a Secret Key do AWS IAM');
    } else if (error.name === 'NoSuchBucket') {
      console.log('🔴 Problema: Bucket não existe ou você não tem permissão');
      console.log(`   Bucket: ${bucket}`);
      console.log('   Solução: Verifique o nome do bucket ou crie um novo');
    } else if (error.name === 'AccessDenied') {
      console.log('🔴 Problema: Credenciais válidas mas sem permissão no bucket');
      console.log('   Solução: O usuário IAM precisa de permissões s3:PutObject e s3:ListMultipartUploadParts');
    } else {
      console.log('🔴 Erro desconhecido:', error.name);
      console.log('   Mensagem:', error.message);
    }

    console.log('\n📋 Detalhes do erro:');
    console.log(error);

    console.log('\n⚠️  Este é o MESMO erro que está acontecendo no Render!');
    console.log('   As credenciais AWS configuradas estão incorretas.');
    process.exit(1);
  }
}

testCredentials();
