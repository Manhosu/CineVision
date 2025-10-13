require('dotenv').config();
const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

console.log('🔍 TESTE: Diferentes formatos de URL e regiões\n');
console.log('='.repeat(70));

async function testDifferentFormats() {
  // Criar arquivo de teste
  const testKey = `test-formats/test-${Date.now()}.txt`;

  console.log('\n📝 Criando arquivo de teste...');

  // Teste com região us-east-2
  const s3ClientEast2 = new S3Client({
    region: 'us-east-2',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });

  await s3ClientEast2.send(new PutObjectCommand({
    Bucket: 'cinevision-video',
    Key: testKey,
    Body: 'Test content for presigned URL',
    ContentType: 'text/plain',
  }));

  console.log('✅ Arquivo criado\n');

  // TESTE 1: URL estilo path (bucket no path)
  console.log('📊 TESTE 1: URL estilo PATH (s3.region.amazonaws.com/bucket/key)');
  try {
    const getCmd = new GetObjectCommand({
      Bucket: 'cinevision-video',
      Key: testKey,
    });

    const url = await getSignedUrl(s3ClientEast2, getCmd, {
      expiresIn: 3600,
    });

    console.log(`   URL: ${url.substring(0, 80)}...`);

    const response = await fetch(url, { method: 'HEAD' });
    console.log(`   Status: ${response.status} ${response.status === 200 ? '✅' : '❌'}`);

    if (response.status !== 200) {
      const text = await response.text();
      console.log(`   Erro: ${text.substring(0, 200)}`);
    }
  } catch (error) {
    console.log(`   ❌ Erro: ${error.message}`);
  }

  console.log('');

  // TESTE 2: Forçar URL estilo virtual-hosted
  console.log('📊 TESTE 2: URL estilo VIRTUAL-HOSTED (bucket.s3.region.amazonaws.com/key)');
  try {
    const s3ClientVirtual = new S3Client({
      region: 'us-east-2',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
      forcePathStyle: false, // força virtual-hosted style
    });

    const getCmd = new GetObjectCommand({
      Bucket: 'cinevision-video',
      Key: testKey,
    });

    const url = await getSignedUrl(s3ClientVirtual, getCmd, {
      expiresIn: 3600,
    });

    console.log(`   URL: ${url.substring(0, 80)}...`);

    const response = await fetch(url, { method: 'HEAD' });
    console.log(`   Status: ${response.status} ${response.status === 200 ? '✅' : '❌'}`);

    if (response.status !== 200) {
      const text = await response.text();
      console.log(`   Erro: ${text.substring(0, 200)}`);
    }
  } catch (error) {
    console.log(`   ❌ Erro: ${error.message}`);
  }

  console.log('');

  // TESTE 3: Usar s3.amazonaws.com (sem região específica)
  console.log('📊 TESTE 3: URL com endpoint genérico (s3.amazonaws.com)');
  try {
    const s3ClientGeneric = new S3Client({
      region: 'us-east-1', // região padrão
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });

    const getCmd = new GetObjectCommand({
      Bucket: 'cinevision-video',
      Key: testKey,
    });

    const url = await getSignedUrl(s3ClientGeneric, getCmd, {
      expiresIn: 3600,
    });

    console.log(`   URL: ${url.substring(0, 80)}...`);

    const response = await fetch(url, { method: 'HEAD' });
    console.log(`   Status: ${response.status} ${response.status === 200 ? '✅' : '❌'}`);

    if (response.status !== 200) {
      const text = await response.text();
      console.log(`   Erro: ${text.substring(0, 200)}`);
    }
  } catch (error) {
    console.log(`   ❌ Erro: ${error.message}`);
  }

  console.log('');

  // TESTE 4: Verificar se as credenciais estão corretas
  console.log('📊 TESTE 4: Verificar credenciais e permissões');
  console.log(`   AWS_ACCESS_KEY_ID: ${process.env.AWS_ACCESS_KEY_ID}`);
  console.log(`   AWS_SECRET (primeiros 10 chars): ${process.env.AWS_SECRET_ACCESS_KEY?.substring(0, 10)}...`);
  console.log(`   Região configurada: us-east-2`);

  // TESTE 5: Tentar acessar via SDK direto
  console.log('\n📊 TESTE 5: Acesso direto via SDK (sem presigned URL)');
  try {
    const { Body } = await s3ClientEast2.send(new GetObjectCommand({
      Bucket: 'cinevision-video',
      Key: testKey,
    }));

    const content = await Body.transformToString();
    console.log(`   ✅ Acesso direto funciona!`);
    console.log(`   Conteúdo: "${content}"`);
  } catch (error) {
    console.log(`   ❌ Acesso direto falhou: ${error.message}`);
  }

  console.log('\n' + '='.repeat(70));
  console.log('\n💡 CONCLUSÃO:\n');
  console.log('Se acesso direto funciona mas presigned URLs não:');
  console.log('   → Pode ser problema com a assinatura da URL');
  console.log('   → Pode ser problema com relógio do sistema (hora incorreta)');
  console.log('   → Pode ser problema com a região da assinatura');
  console.log('\n' + '='.repeat(70) + '\n');
}

testDifferentFormats().catch(console.error);
