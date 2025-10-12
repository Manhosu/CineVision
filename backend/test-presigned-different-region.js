const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

// Load credentials from environment variables
require('dotenv').config();

async function testWithDifferentConfig() {
  try {
    console.log('🔧 Teste 1: Presigned URL gerada em us-east-2 (região do bucket)\n');

    const s3Client = new S3Client({
      region: 'us-east-2',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    });

    const videoKey = 'videos/c7ed9623-7bcb-4c13-91b7-6f96b76facd1/languages/dubbed-pt-BR/1760228827742-Lilo-Stitch-2025-DUBLADO.mp4';

    const command = new GetObjectCommand({
      Bucket: 'cinevision-video',
      Key: videoKey,
    });

    const presignedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 3600,
    });

    console.log('📋 URL gerada:', presignedUrl.substring(0, 150) + '...');

    // Extrair apenas o host e caminho
    const url = new URL(presignedUrl);
    console.log('🌐 Host:', url.host);
    console.log('📁 Path:', url.pathname);
    console.log('🔑 Tem assinatura?', url.searchParams.has('X-Amz-Signature') ? 'Sim' : 'Não');
    console.log('⏰ Expira em:', url.searchParams.get('X-Amz-Expires'), 'segundos');
    console.log('👤 Credencial:', url.searchParams.get('X-Amz-Credential'));
    console.log('');

    console.log('🧪 Testando acesso com fetch...\n');
    const response = await fetch(presignedUrl, { method: 'HEAD' });

    console.log('📊 Status:', response.status, response.statusText);

    if (response.status === 403) {
      console.log('\n❌ Ainda 403 Forbidden');
      console.log('\n🔍 Detalhes da resposta:');
      console.log('Headers:', Object.fromEntries(response.headers.entries()));

      // Tentar obter o corpo do erro
      const errorResponse = await fetch(presignedUrl);
      const errorBody = await errorResponse.text();
      console.log('\n📄 Corpo do erro:');
      console.log(errorBody);
    } else if (response.status === 200) {
      console.log('✅✅✅ FUNCIONOU! ✅✅✅');
      console.log('📦 Content-Type:', response.headers.get('content-type'));
      console.log('📏 Content-Length:', response.headers.get('content-length'));
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

testWithDifferentConfig();
