const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function uploadPoster() {
  console.log('📤 Iniciando upload do poster do Quarteto Fantástico...\n');

  const s3Client = new S3Client({
    region: 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
  });

  const posterPath = 'C:/tmp/quarteto-fantastico-primeiros-passos-2025.png';

  if (!fs.existsSync(posterPath)) {
    console.error('❌ Arquivo não encontrado:', posterPath);
    process.exit(1);
  }

  const fileContent = fs.readFileSync(posterPath);
  const fileSizeMB = (fileContent.length / (1024 * 1024)).toFixed(2);

  console.log(`📁 Arquivo: ${path.basename(posterPath)}`);
  console.log(`📊 Tamanho: ${fileSizeMB} MB\n`);

  try {
    const command = new PutObjectCommand({
      Bucket: 'cinevision-cover',
      Key: 'posters/quarteto-fantastico-primeiros-passos-2025.png',
      Body: fileContent,
      ContentType: 'image/png',
      // ACL removido
    });

    console.log('⏳ Fazendo upload...');
    await s3Client.send(command);

    const url = 'https://cinevision-cover.s3.us-east-1.amazonaws.com/posters/quarteto-fantastico-primeiros-passos-2025.png';
    console.log('\n✅ Upload concluído com sucesso!');
    console.log(`🔗 URL: ${url}\n`);

    // Verificar se está acessível
    console.log('🔍 Verificando acesso público...');
    const https = require('https');

    https.get(url, (res) => {
      if (res.statusCode === 200) {
        console.log('✅ Poster acessível publicamente!');
      } else {
        console.log(`⚠️  Status: ${res.statusCode}`);
      }
      process.exit(0);
    }).on('error', (err) => {
      console.error('❌ Erro ao verificar:', err.message);
      process.exit(1);
    });

  } catch (error) {
    console.error('❌ Erro ao fazer upload:', error.message);

    if (error.Code === 'AccessDenied') {
      console.log('\n💡 Dica: Verifique as permissões do bucket S3 e as credenciais AWS no .env');
    }

    process.exit(1);
  }
}

uploadPoster();
