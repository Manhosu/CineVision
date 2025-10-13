const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const s3Client = new S3Client({
  region: 'us-east-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

async function testWithNewFile() {
  try {
    console.log('🔧 Teste com arquivo novo\n');

    const testKey = `test-presigned/test-${Date.now()}.txt`;
    const testContent = 'This is a test file for presigned URL';

    // 1. Upload arquivo de teste
    console.log('📤 1. Fazendo upload de arquivo de teste...');
    const putCommand = new PutObjectCommand({
      Bucket: 'cinevision-video',
      Key: testKey,
      Body: testContent,
      ContentType: 'text/plain'
    });

    await s3Client.send(putCommand);
    console.log('✅ Upload concluído:', testKey, '\n');

    // 2. Gerar presigned URL
    console.log('🔑 2. Gerando presigned URL...');
    const getCommand = new GetObjectCommand({
      Bucket: 'cinevision-video',
      Key: testKey,
    });

    const presignedUrl = await getSignedUrl(s3Client, getCommand, {
      expiresIn: 3600,
    });

    console.log('✅ URL gerada:', presignedUrl.substring(0, 100), '...\n');

    // 3. Testar acesso à URL
    console.log('🧪 3. Testando acesso à URL...\n');
    const response = await fetch(presignedUrl);
    const text = await response.text();

    console.log('📊 Status:', response.status, response.statusText);
    console.log('📦 Content-Type:', response.headers.get('content-type'));

    if (response.status === 200) {
      console.log('📄 Conteúdo baixado:', text);
      console.log('\n✅✅✅ PRESIGNED URL FUNCIONOU! ✅✅✅\n');
      return true;
    } else {
      console.log('📄 Resposta:', text);
      console.log('\n❌ Ainda retorna', response.status, '\n');
      return false;
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
    return false;
  }
}

testWithNewFile();
