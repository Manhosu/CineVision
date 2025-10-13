const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

async function testComparison() {
  console.log('🔍 TESTE COMPARATIVO - Por que vídeos grandes não funcionam?\n');

  // Teste 1: Arquivo pequeno (sabemos que funciona)
  console.log('📄 TESTE 1: Arquivo pequeno (37 bytes)\n');

  const smallUrl = await getSignedUrl(
    s3Client,
    new GetObjectCommand({
      Bucket: 'cinevision-video',
      Key: 'test-presigned/test-1760245374237.txt'
    }),
    { expiresIn: 3600 }
  );

  const resp1 = await fetch(smallUrl, { method: 'HEAD' });
  console.log(`   Status: ${resp1.status}`);
  console.log(`   ✅ Arquivo pequeno: ${resp1.status === 200 ? 'FUNCIONA' : 'FALHA'}\n`);

  // Teste 2: Vídeo grande (sabemos que não funciona)
  console.log('🎬 TESTE 2: Vídeo grande (1.8 GB)\n');

  const largeUrl = await getSignedUrl(
    s3Client,
    new GetObjectCommand({
      Bucket: 'cinevision-video',
      Key: 'videos/c7ed9623-7bcb-4c13-91b7-6f96b76facd1/languages/dubbed-pt-BR/1760228827742-Lilo-Stitch-2025-DUBLADO.mp4'
    }),
    { expiresIn: 3600 }
  );

  const resp2 = await fetch(largeUrl, { method: 'HEAD' });
  console.log(`   Status: ${resp2.status}`);
  console.log(`   ❌ Vídeo grande: ${resp2.status === 200 ? 'FUNCIONA' : 'FALHA'}\n`);

  // Teste 3: Criar arquivo médio (10 MB) AGORA e testar
  console.log('📦 TESTE 3: Criar arquivo de 10 MB AGORA e testar\n');

  const mediumKey = `test-presigned/medium-${Date.now()}.bin`;
  const buffer10MB = Buffer.alloc(10 * 1024 * 1024, 0);

  console.log('   📤 Fazendo upload de 10 MB...');
  await s3Client.send(new PutObjectCommand({
    Bucket: 'cinevision-video',
    Key: mediumKey,
    Body: buffer10MB,
    ContentType: 'application/octet-stream'
  }));
  console.log('   ✅ Upload concluído');

  const mediumUrl = await getSignedUrl(
    s3Client,
    new GetObjectCommand({
      Bucket: 'cinevision-video',
      Key: mediumKey
    }),
    { expiresIn: 3600 }
  );

  const resp3 = await fetch(mediumUrl, { method: 'HEAD' });
  console.log(`   Status: ${resp3.status}`);
  console.log(`   ${resp3.status === 200 ? '✅' : '❌'} Arquivo 10MB: ${resp3.status === 200 ? 'FUNCIONA' : 'FALHA'}\n`);

  // Análise
  console.log('=' .repeat(70));
  console.log('\n📊 ANÁLISE:\n');

  if (resp1.status === 200 && resp3.status === 200 && resp2.status === 403) {
    console.log('❗ Arquivos NOVOS funcionam (pequenos e médios)');
    console.log('❗ Vídeos ANTIGOS não funcionam');
    console.log('');
    console.log('💡 CAUSA PROVÁVEL:');
    console.log('   Os vídeos foram enviados com configurações antigas (ACL: private)');
    console.log('   que ainda estão ativas nos objetos mesmo após mudanças no bucket.');
    console.log('');
    console.log('✅ SOLUÇÃO:');
    console.log('   Tornar bucket PÚBLICO temporariamente para testar');
    console.log('   OU usar CloudFront ao invés de presigned URLs do S3');
    console.log('');
  } else {
    console.log('🤔 Padrão diferente do esperado...');
    console.log('');
  }
}

testComparison();
