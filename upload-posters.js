const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');

const s3Client = new S3Client({
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const BUCKET_NAME = 'cinevision-capas';

const posters = [
  {
    localPath: 'E:/movies/FILME_  Lilo & Stitch (2025)/POSTER.png',
    s3Key: 'posters/lilo---stitch-2025.png',
    title: 'Lilo & Stitch'
  },
  {
    localPath: 'E:/movies/FILME_ A Hora do Mal (2025)/POSTER.png',
    s3Key: 'posters/a-hora-do-mal-2025.png',
    title: 'A Hora do Mal'
  }
];

async function uploadPoster(poster) {
  try {
    console.log(`\nUpload do pôster: ${poster.title}`);
    console.log(`Arquivo local: ${poster.localPath}`);
    console.log(`Destino S3: s3://${BUCKET_NAME}/${poster.s3Key}`);

    // Verificar se o arquivo existe
    if (!fs.existsSync(poster.localPath)) {
      console.error(`❌ Arquivo não encontrado: ${poster.localPath}`);
      return false;
    }

    // Ler o arquivo
    const fileContent = fs.readFileSync(poster.localPath);
    const fileSizeKB = (fileContent.length / 1024).toFixed(2);
    console.log(`Tamanho: ${fileSizeKB} KB`);

    // Upload para S3
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: poster.s3Key,
      Body: fileContent,
      ContentType: 'image/png',
      ACL: 'public-read'
    });

    await s3Client.send(command);

    const publicUrl = `https://${BUCKET_NAME}.s3.us-east-1.amazonaws.com/${poster.s3Key}`;
    console.log(`✅ Upload concluído!`);
    console.log(`URL pública: ${publicUrl}`);

    return true;
  } catch (error) {
    console.error(`❌ Erro ao fazer upload: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('=== Upload de Pôsteres para S3 ===\n');

  let successCount = 0;
  let failCount = 0;

  for (const poster of posters) {
    const success = await uploadPoster(poster);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
  }

  console.log('\n=== Resumo ===');
  console.log(`✅ Sucesso: ${successCount}`);
  console.log(`❌ Falha: ${failCount}`);
  console.log(`Total: ${posters.length}`);
}

main().catch(console.error);
