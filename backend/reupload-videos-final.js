require('dotenv').config();
const { S3Client, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const fs = require('fs');
const path = require('path');

const s3Client = new S3Client({
  region: 'us-east-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const videos = [
  {
    title: 'A Hora do Mal - Dublado',
    localPath: 'E:/movies/FILME_ A Hora do Mal (2025)/A Hora do Mal (2025) - DUBLADO.mp4',
    s3Key: 'videos/f8e60daf-1e94-43b4-b9fe-c6f96c8f5a9c/languages/dubbed-pt-BR/1760228833502-Monster-2025-DUBLADO.mp4',
    languageId: 'ab6cf46c-5fe1-43b6-a65c-8a39a28c03a5'
  },
  {
    title: 'A Hora do Mal - Legendado',
    localPath: 'E:/movies/FILME_ A Hora do Mal (2025)/A Hora do Mal (2025) - LEGENDADO.mp4',
    s3Key: 'videos/f8e60daf-1e94-43b4-b9fe-c6f96c8f5a9c/languages/subtitled-pt-BR/1760228833502-Monster-2025-LEGENDADO.mp4',
    languageId: '70bb9d7d-4bb1-4d31-ac23-5a1bb7b1e0b6'
  },
  {
    title: 'Lilo & Stitch - Dublado',
    localPath: 'E:/movies/FILME_  Lilo & Stitch (2025)/Lilo & Stitch (2025) - DUBLADO.mp4',
    s3Key: 'videos/c7ed9623-7bcb-4c13-91b7-6f96b76facd1/languages/dubbed-pt-BR/1760228827742-Lilo-Stitch-2025-DUBLADO.mp4',
    languageId: '73f179fc-28a2-44ea-8cff-71da36e28c31'
  },
  {
    title: 'Lilo & Stitch - Legendado',
    localPath: 'E:/movies/FILME_  Lilo & Stitch (2025)/Lilo & Stitch (2025) - LEGENDADO.mp4',
    s3Key: 'videos/c7ed9623-7bcb-4c13-91b7-6f96b76facd1/languages/subtitled-pt-BR/1760228827742-Lilo-Stitch-2025-LEGENDADO.mp4',
    languageId: 'ea2be99e-ca53-4734-8fa9-fc0e4ad74a08'
  },
];

async function uploadVideoMultipart(video) {
  console.log('\n' + '='.repeat(70));
  console.log(`🎬 ${video.title}`);
  console.log('='.repeat(70) + '\n');

  if (!fs.existsSync(video.localPath)) {
    console.log(`❌ Arquivo não encontrado: ${video.localPath}`);
    return false;
  }

  const stats = fs.statSync(video.localPath);
  const fileSizeInBytes = stats.size;
  const fileSizeInGB = (fileSizeInBytes / (1024 * 1024 * 1024)).toFixed(2);

  console.log(`📁 Arquivo: ${fileSizeInGB} GB`);

  // Calcular número de partes (100MB cada)
  const chunkSize = 100 * 1024 * 1024; // 100MB
  const numParts = Math.ceil(fileSizeInBytes / chunkSize);
  console.log(`📦 Partes: ${numParts} (100 MB cada)\n`);

  try {
    // Deletar arquivo antigo
    console.log('🗑️  Deletando arquivo antigo...');
    try {
      await s3Client.send(new DeleteObjectCommand({
        Bucket: 'cinevision-video',
        Key: video.s3Key,
      }));
      console.log('   ✅ Deletado');
    } catch (err) {
      if (err.name !== 'NoSuchKey') {
        console.log(`   ⚠️  Erro ao deletar: ${err.message}`);
      }
    }

    // Iniciar multipart upload
    console.log('🚀 Iniciando multipart upload...');
    const createResponse = await s3Client.send(new CreateMultipartUploadCommand({
      Bucket: 'cinevision-video',
      Key: video.s3Key,
      ContentType: 'video/mp4',
      CacheControl: 'max-age=31536000',
      // SEM ACL - usar configuração do bucket
    }));

    const uploadId = createResponse.UploadId;
    console.log(`   ✅ Upload ID: ${uploadId.substring(0, 20)}...\n`);

    // Upload de cada parte
    const uploadedParts = [];
    const fileStream = fs.createReadStream(video.localPath, { highWaterMark: chunkSize });

    let partNumber = 1;
    let totalUploaded = 0;

    for await (const chunk of fileStream) {
      console.log(`📤 Parte ${partNumber}/${numParts} (${(chunk.length / 1024 / 1024).toFixed(1)} MB)...`);

      const uploadPartResponse = await s3Client.send(new UploadPartCommand({
        Bucket: 'cinevision-video',
        Key: video.s3Key,
        UploadId: uploadId,
        PartNumber: partNumber,
        Body: chunk,
      }));

      uploadedParts.push({
        ETag: uploadPartResponse.ETag,
        PartNumber: partNumber,
      });

      totalUploaded += chunk.length;
      const percentComplete = ((totalUploaded / fileSizeInBytes) * 100).toFixed(1);
      console.log(`   ✅ Concluído (${percentComplete}%)`);

      partNumber++;
    }

    // Finalizar multipart upload
    console.log('\n🏁 Finalizando upload...');
    await s3Client.send(new CompleteMultipartUploadCommand({
      Bucket: 'cinevision-video',
      Key: video.s3Key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: uploadedParts,
      },
    }));

    console.log('   ✅ Upload completado!\n');

    // Testar presigned URL
    console.log('🧪 Testando presigned URL...');
    const getCommand = new GetObjectCommand({
      Bucket: 'cinevision-video',
      Key: video.s3Key,
    });

    const presignedUrl = await getSignedUrl(s3Client, getCommand, {
      expiresIn: 14400, // 4 horas
    });

    const response = await fetch(presignedUrl, { method: 'HEAD' });

    if (response.status === 200) {
      console.log(`   ✅ Status ${response.status} - FUNCIONANDO!`);
      return true;
    } else {
      console.log(`   ⚠️  Status ${response.status}`);
      return false;
    }

  } catch (error) {
    console.log(`   ❌ Erro: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('🚀 RE-UPLOAD FINAL - PRESIGNED URLs FUNCIONANDO\n');
  console.log('⏱️  Tempo estimado: 15-20 minutos\n');

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < videos.length; i++) {
    console.log(`\n📊 Vídeo ${i + 1}/${videos.length}\n`);

    const success = await uploadVideoMultipart(videos[i]);

    if (success) {
      successCount++;
    } else {
      failCount++;
    }
  }

  console.log('\n' + '='.repeat(70) + '\n');
  console.log('🏁 RESUMO FINAL:\n');
  console.log(`   ✅ Sucesso: ${successCount}/${videos.length} vídeos`);
  console.log(`   ❌ Falhas: ${failCount}/${videos.length} vídeos`);
  console.log('\n' + '='.repeat(70) + '\n');

  if (successCount === videos.length) {
    console.log('🎉 TODOS OS VÍDEOS FORAM RE-UPLOADADOS COM SUCESSO!');
    console.log('✅ Presigned URLs funcionando para todos os vídeos!');
  } else {
    console.log('⚠️  Alguns vídeos falharam. Verifique os logs acima.');
  }
}

main().catch(console.error);
