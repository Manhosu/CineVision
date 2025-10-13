const { S3Client, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { GetObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const videos = [
  {
    title: 'A Hora do Mal - Dublado',
    localPath: 'E:/movies/FILME_ A Hora do Mal (2025)/A Hora do Mal (2025) - DUBLADO.mp4',
    s3Key: 'videos/da5a57f3-a4d8-41d7-bffd-3f46042b55ea/languages/dubbed-pt-BR/1760201825066-A Hora do Mal (2025) - DUBLADO.mp4',
  },
  {
    title: 'A Hora do Mal - Legendado',
    localPath: 'E:/movies/FILME_ A Hora do Mal (2025)/A Hora do Mal (2025) - LEGENDADO.mp4',
    s3Key: 'videos/da5a57f3-a4d8-41d7-bffd-3f46042b55ea/languages/subtitled-pt-BR/1760203277238-A Hora do Mal (2025) - LEGENDADO.mp4',
  },
  {
    title: 'Lilo & Stitch - Dublado',
    localPath: 'E:/movies/FILME_  Lilo & Stitch (2025)/Lilo & Stitch (2025) - DUBLADO.mp4',
    s3Key: 'videos/c7ed9623-7bcb-4c13-91b7-6f96b76facd1/languages/dubbed-pt-BR/1760228827742-Lilo-Stitch-2025-DUBLADO.mp4',
  },
  {
    title: 'Lilo & Stitch - Legendado',
    localPath: 'E:/movies/FILME_  Lilo & Stitch (2025)/Lilo & Stitch (2025) - LEGENDADO.mp4',
    s3Key: 'videos/c7ed9623-7bcb-4c13-91b7-6f96b76facd1/languages/subtitled-pt-BR/1760228827742-Lilo-Stitch-2025-LEGENDADO.mp4',
  }
];

async function uploadWithMultipart(video) {
  const CHUNK_SIZE = 100 * 1024 * 1024; // 100 MB por parte

  console.log(`\n${'='.repeat(70)}`);
  console.log(`🎬 ${video.title}`);
  console.log(`${'='.repeat(70)}\n`);

  let uploadId;

  try {
    // 1. Verificar arquivo
    if (!fs.existsSync(video.localPath)) {
      console.log(`   ❌ Arquivo não encontrado: ${video.localPath}`);
      return false;
    }

    const stats = fs.statSync(video.localPath);
    const fileSizeGB = (stats.size / (1024 * 1024 * 1024)).toFixed(2);
    const totalParts = Math.ceil(stats.size / CHUNK_SIZE);

    console.log(`📁 Arquivo: ${fileSizeGB} GB`);
    console.log(`📦 Partes: ${totalParts} (100 MB cada)`);
    console.log('');

    // 2. Deletar arquivo antigo
    console.log('🗑️  Deletando arquivo antigo...');
    try {
      await s3Client.send(new DeleteObjectCommand({
        Bucket: 'cinevision-video',
        Key: video.s3Key,
      }));
      console.log('   ✅ Deletado');
    } catch (e) {
      console.log('   ⚠️  Não encontrado (ok)');
    }

    // 3. Iniciar multipart upload
    console.log('🚀 Iniciando multipart upload...');
    const createResponse = await s3Client.send(new CreateMultipartUploadCommand({
      Bucket: 'cinevision-video',
      Key: video.s3Key,
      ContentType: 'video/mp4',
      CacheControl: 'max-age=31536000',
      // ACL removida - deixar bucket definir automaticamente
    }));

    uploadId = createResponse.UploadId;
    console.log(`   ✅ Upload ID: ${uploadId.substring(0, 20)}...`);
    console.log('');

    // 4. Upload partes
    const parts = [];
    const fileHandle = fs.openSync(video.localPath, 'r');

    for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
      const start = (partNumber - 1) * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, stats.size);
      const buffer = Buffer.alloc(end - start);

      fs.readSync(fileHandle, buffer, 0, buffer.length, start);

      console.log(`📤 Parte ${partNumber}/${totalParts} (${(buffer.length / (1024 * 1024)).toFixed(1)} MB)...`);

      const uploadPartResponse = await s3Client.send(new UploadPartCommand({
        Bucket: 'cinevision-video',
        Key: video.s3Key,
        PartNumber: partNumber,
        UploadId: uploadId,
        Body: buffer,
      }));

      parts.push({
        PartNumber: partNumber,
        ETag: uploadPartResponse.ETag,
      });

      const progress = ((partNumber / totalParts) * 100).toFixed(1);
      console.log(`   ✅ Concluído (${progress}%)`);
    }

    fs.closeSync(fileHandle);
    console.log('');

    // 5. Completar upload
    console.log('🏁 Finalizando upload...');
    await s3Client.send(new CompleteMultipartUploadCommand({
      Bucket: 'cinevision-video',
      Key: video.s3Key,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts },
    }));

    console.log('   ✅ Upload completado!');
    console.log('');

    // 6. Testar presigned URL
    console.log('🧪 Testando presigned URL...');
    const presignedUrl = await getSignedUrl(
      s3Client,
      new GetObjectCommand({ Bucket: 'cinevision-video', Key: video.s3Key }),
      { expiresIn: 14400 }
    );

    const response = await fetch(presignedUrl, { method: 'HEAD' });

    if (response.status === 200) {
      console.log('   ✅✅✅ PRESIGNED URL FUNCIONA! (200 OK) ✅✅✅');
      console.log('');
      return true;
    } else {
      console.log(`   ⚠️  Status ${response.status} (aguarde propagação)`);
      console.log('');
      return false;
    }

  } catch (error) {
    console.error(`\n❌ ERRO: ${error.message}\n`);

    // Abortar upload se falhou
    if (uploadId) {
      try {
        await s3Client.send(new AbortMultipartUploadCommand({
          Bucket: 'cinevision-video',
          Key: video.s3Key,
          UploadId: uploadId,
        }));
        console.log('🔄 Upload abortado');
      } catch (abortError) {
        console.error('⚠️  Erro ao abortar:', abortError.message);
      }
    }

    return false;
  }
}

async function reuploadAll() {
  console.log('🚀 RE-UPLOAD COM MULTIPART (ARQUIVOS GRANDES)\n');
  console.log('⏱️  Tempo estimado: 15-20 minutos\n');

  let successCount = 0;

  for (let i = 0; i < videos.length; i++) {
    console.log(`\n📊 Vídeo ${i + 1}/${videos.length}\n`);

    const success = await uploadWithMultipart(videos[i]);

    if (success) {
      successCount++;
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('\n🏁 RESUMO FINAL:\n');
  console.log(`   ✅ Sucesso: ${successCount}/${videos.length} vídeos\n`);

  if (successCount === videos.length) {
    console.log('🎉🎉🎉 TODOS OS VÍDEOS PRONTOS! 🎉🎉🎉\n');
    console.log('✅ Sistema 100% funcional!');
    console.log('✅ Usuários podem assistir todos os filmes!\n');
  }
}

reuploadAll();
