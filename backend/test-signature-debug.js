require('dotenv').config();
const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const https = require('https');
const { parse } = require('url');

console.log('🔍 DEBUG: Assinatura da Presigned URL\n');
console.log('='.repeat(70));

async function debugSignature() {
  const s3Client = new S3Client({
    region: 'us-east-2',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });

  // Criar arquivo de teste
  const testKey = `test-signature-debug/test-${Date.now()}.txt`;

  console.log('\n📝 Criando arquivo de teste...');
  await s3Client.send(new PutObjectCommand({
    Bucket: 'cinevision-video',
    Key: testKey,
    Body: 'Debugging presigned URL signature',
    ContentType: 'text/plain',
  }));
  console.log('✅ Arquivo criado');

  // Gerar presigned URL
  console.log('\n🔐 Gerando presigned URL...');
  const getCmd = new GetObjectCommand({
    Bucket: 'cinevision-video',
    Key: testKey,
  });

  const presignedUrl = await getSignedUrl(s3Client, getCmd, {
    expiresIn: 3600,
  });

  console.log('✅ URL gerada\n');

  // Analisar URL
  const urlObj = new URL(presignedUrl);
  console.log('📋 ANÁLISE DA URL:');
  console.log(`   Host: ${urlObj.hostname}`);
  console.log(`   Path: ${urlObj.pathname}`);
  console.log('');
  console.log('   Parâmetros de autenticação:');
  console.log(`   • X-Amz-Algorithm: ${urlObj.searchParams.get('X-Amz-Algorithm')}`);
  console.log(`   • X-Amz-Credential: ${urlObj.searchParams.get('X-Amz-Credential')}`);
  console.log(`   • X-Amz-Date: ${urlObj.searchParams.get('X-Amz-Date')}`);
  console.log(`   • X-Amz-Expires: ${urlObj.searchParams.get('X-Amz-Expires')} segundos`);
  console.log(`   • X-Amz-SignedHeaders: ${urlObj.searchParams.get('X-Amz-SignedHeaders')}`);
  console.log(`   • X-Amz-Signature: ${urlObj.searchParams.get('X-Amz-Signature')?.substring(0, 20)}...`);

  // Verificar hora do sistema
  console.log('\n⏰ VERIFICAÇÃO DE HORA:');
  const now = new Date();
  const amzDate = urlObj.searchParams.get('X-Amz-Date');
  console.log(`   Hora do sistema: ${now.toISOString()}`);
  console.log(`   Hora na URL (X-Amz-Date): ${amzDate}`);

  if (amzDate) {
    const urlYear = amzDate.substring(0, 4);
    const urlMonth = amzDate.substring(4, 6);
    const urlDay = amzDate.substring(6, 8);
    const urlHour = amzDate.substring(9, 11);
    const urlMin = amzDate.substring(11, 13);
    const urlSec = amzDate.substring(13, 15);
    const urlDateTime = new Date(`${urlYear}-${urlMonth}-${urlDay}T${urlHour}:${urlMin}:${urlSec}Z`);

    const timeDiff = Math.abs(now.getTime() - urlDateTime.getTime()) / 1000;
    console.log(`   Diferença: ${timeDiff.toFixed(0)} segundos`);

    if (timeDiff > 900) { // 15 minutos
      console.log('   ⚠️  ATENÇÃO: Diferença maior que 15 minutos!');
      console.log('   → Isso pode causar erro de assinatura');
    } else {
      console.log('   ✅ Diferença aceitável');
    }
  }

  // Fazer requisição detalhada
  console.log('\n📡 FAZENDO REQUISIÇÃO HTTP DETALHADA:');

  return new Promise((resolve) => {
    const urlParsed = parse(presignedUrl);

    const options = {
      hostname: urlParsed.hostname,
      path: urlParsed.path,
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    };

    const req = https.request(options, (res) => {
      console.log(`   Status: ${res.statusCode} ${res.statusMessage}`);
      console.log('   Headers de resposta:');

      Object.keys(res.headers).forEach(key => {
        console.log(`   • ${key}: ${res.headers[key]}`);
      });

      let body = '';
      res.on('data', chunk => {
        body += chunk;
      });

      res.on('end', () => {
        if (body) {
          console.log('\n   Corpo da resposta:');
          console.log(body.substring(0, 500));
        }

        console.log('\n' + '='.repeat(70));
        console.log('\n💡 DIAGNÓSTICO:\n');

        if (res.statusCode === 403) {
          console.log('❌ Erro 403 - Possíveis causas:');
          console.log('');

          if (res.headers['x-amz-error-code']) {
            console.log(`   Código de erro S3: ${res.headers['x-amz-error-code']}`);
          }

          if (res.headers['x-amz-error-message']) {
            console.log(`   Mensagem: ${res.headers['x-amz-error-message']}`);
          }

          console.log('');
          console.log('   1. SignatureDoesNotMatch → Problema na assinatura');
          console.log('   2. AccessDenied → Problema de permissão IAM');
          console.log('   3. InvalidAccessKeyId → Credencial incorreta');
          console.log('   4. RequestTimeTooSkewed → Hora do sistema incorreta');
        } else if (res.statusCode === 200) {
          console.log('✅ Presigned URL funcionando!');
        }

        console.log('\n' + '='.repeat(70) + '\n');
        resolve();
      });
    });

    req.on('error', (error) => {
      console.log(`   ❌ Erro de requisição: ${error.message}`);
      resolve();
    });

    req.end();
  });
}

debugSignature().catch(console.error);
