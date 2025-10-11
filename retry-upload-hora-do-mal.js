const axios = require('axios');
const fs = require('fs');
const path = require('path');

const API_URL = 'http://localhost:3001/api/v1';
const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks

// Language IDs já existentes no banco
const VIDEOS = [
  {
    languageId: 'aeb48abb-d62e-4811-ac3c-8fb766f7fb1b',
    path: 'E:/movies/FILME_ A Hora do Mal (2025)/A Hora do Mal (2025) - DUBLADO.mp4',
    name: 'Português (Brasil) - Dublado'
  },
  {
    languageId: 'b57ef5b4-1eec-4dd2-a978-24612c5c2d37',
    path: 'E:/movies/FILME_ A Hora do Mal (2025)/A Hora do Mal (2025) - LEGENDADO.mp4',
    name: 'Português (Brasil) - Legendado'
  }
];

async function initiateMultipartUpload(contentLanguageId, filePath) {
  const fileName = path.basename(filePath);
  const fileSize = fs.statSync(filePath).size;

  console.log(`\n🚀 Iniciando novo upload multipart...`);
  console.log(`   Arquivo: ${fileName}`);
  console.log(`   Tamanho: ${(fileSize / (1024 * 1024)).toFixed(2)} MB`);

  try {
    const response = await axios.post(
      `${API_URL}/content-language-upload/initiate-multipart`,
      {
        content_language_id: contentLanguageId,
        file_name: fileName,
        file_size: fileSize,
        content_type: 'video/mp4'
      }
    );

    console.log('✅ Upload iniciado');
    console.log(`   Upload ID: ${response.data.uploadId}`);
    console.log(`   Storage Key: ${response.data.storage_key}`);
    console.log(`   Total de partes: ${response.data.presignedUrls.length}`);

    return {
      uploadId: response.data.uploadId,
      presignedUrls: response.data.presignedUrls,
      storageKey: response.data.storage_key
    };
  } catch (error) {
    console.error('❌ Erro ao iniciar upload:', error.response?.data || error.message);
    throw error;
  }
}

async function uploadPart(presignedUrl, chunk, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await axios.put(presignedUrl, chunk, {
        headers: {
          'Content-Type': 'application/octet-stream',
        },
        timeout: 60000, // 60 segundos
      });
      return response.headers.etag;
    } catch (error) {
      if (attempt === retries) {
        console.error(`❌ Falha após ${retries} tentativas:`, error.message);
        throw error;
      }
      console.log(`   ⚠️  Tentativa ${attempt} falhou, tentando novamente...`);
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // backoff exponencial
    }
  }
}

async function uploadVideoInParts(filePath, presignedUrls) {
  const totalParts = presignedUrls.length;
  console.log(`\n📤 Fazendo upload do vídeo em ${totalParts} partes...`);

  const fileHandle = fs.openSync(filePath, 'r');
  const uploadedParts = [];

  try {
    for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
      const start = (partNumber - 1) * CHUNK_SIZE;
      const buffer = Buffer.alloc(CHUNK_SIZE);
      const bytesRead = fs.readSync(fileHandle, buffer, 0, CHUNK_SIZE, start);
      const chunk = buffer.slice(0, bytesRead);

      const presignedUrl = presignedUrls[partNumber - 1];
      const etag = await uploadPart(presignedUrl, chunk);

      uploadedParts.push({
        ETag: etag.replace(/"/g, ''),
        PartNumber: partNumber
      });

      const progress = ((partNumber / totalParts) * 100).toFixed(1);
      const sizeMB = (bytesRead / (1024 * 1024)).toFixed(2);

      // Mostrar progresso a cada 10 partes ou na última parte
      if (partNumber % 10 === 0 || partNumber === totalParts) {
        console.log(`   ✅ Progresso: ${partNumber}/${totalParts} partes (${progress}%)`);
      }
    }

    console.log(`   ✅ Todas as ${totalParts} partes enviadas com sucesso!`);
    return uploadedParts;
  } finally {
    fs.closeSync(fileHandle);
  }
}

async function completeMultipartUpload(contentLanguageId, uploadId, parts) {
  console.log('\n✨ Finalizando upload no S3...');
  try {
    const response = await axios.post(
      `${API_URL}/content-language-upload/complete-multipart`,
      {
        content_language_id: contentLanguageId,
        upload_id: uploadId,
        parts: parts
      },
      {
        timeout: 120000, // 2 minutos para completar
      }
    );
    console.log('✅ Upload finalizado com sucesso!');
    console.log(`   URL do vídeo: ${response.data.data.video_url}`);
    return response.data;
  } catch (error) {
    console.error('❌ Erro ao finalizar upload:', error.response?.data || error.message);
    throw error;
  }
}

async function uploadVideo(video) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🎬 Processando: ${video.name}`);
  console.log(`   Language ID: ${video.languageId}`);
  console.log(`${'='.repeat(80)}`);

  try {
    // 1. Iniciar novo upload multipart
    const { uploadId, presignedUrls, storageKey } = await initiateMultipartUpload(video.languageId, video.path);

    // 2. Upload das partes
    const parts = await uploadVideoInParts(video.path, presignedUrls);

    // 3. Finalizar upload
    await completeMultipartUpload(video.languageId, uploadId, parts);

    console.log(`\n✅ ${video.name} - UPLOAD COMPLETO!`);
    return true;
  } catch (error) {
    console.error(`\n❌ Erro ao processar ${video.name}:`, error.message);
    return false;
  }
}

async function main() {
  console.log('🎥 REINICIANDO UPLOAD DE "A HORA DO MAL"');
  console.log(`📊 Total de vídeos: ${VIDEOS.length}\n`);

  const startTime = Date.now();

  try {
    // Processar cada vídeo
    const results = [];
    for (const video of VIDEOS) {
      const success = await uploadVideo(video);
      results.push({ video: video.name, success });

      // Aguardar 5 segundos entre uploads
      if (results.length < VIDEOS.length) {
        console.log('\n⏳ Aguardando 5 segundos antes do próximo vídeo...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    // Resumo final
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000 / 60).toFixed(2);

    console.log(`\n${'='.repeat(80)}`);
    console.log('📋 RESUMO FINAL');
    console.log(`${'='.repeat(80)}`);
    results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      console.log(`${status} ${result.video}`);
    });

    const successCount = results.filter(r => r.success).length;
    console.log(`\n✨ ${successCount}/${VIDEOS.length} vídeos enviados com sucesso!`);
    console.log(`⏱️  Tempo total: ${duration} minutos`);

  } catch (error) {
    console.error('\n❌ ERRO FATAL:', error.message);
    process.exit(1);
  }
}

main();
