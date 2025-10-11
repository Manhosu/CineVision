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

const logFile = fs.createWriteStream('upload-log.txt', { flags: 'w' });

function log(message) {
  const timestamp = new Date().toLocaleTimeString();
  const fullMessage = `[${timestamp}] ${message}`;
  console.log(fullMessage);
  logFile.write(fullMessage + '\n');
}

async function initiateMultipartUpload(contentLanguageId, filePath) {
  const fileName = path.basename(filePath);
  const fileSize = fs.statSync(filePath).size;

  log(`🚀 Iniciando novo upload multipart...`);
  log(`   Arquivo: ${fileName}`);
  log(`   Tamanho: ${(fileSize / (1024 * 1024)).toFixed(2)} MB`);

  const response = await axios.post(
    `${API_URL}/content-language-upload/initiate-multipart`,
    {
      content_language_id: contentLanguageId,
      file_name: fileName,
      file_size: fileSize,
      content_type: 'video/mp4'
    }
  );

  return {
    uploadId: response.data.uploadId,
    presignedUrls: response.data.presignedUrls,
    storageKey: response.data.storage_key
  };
}

async function uploadPart(presignedUrl, chunk, partNumber, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await axios.put(presignedUrl, chunk, {
        headers: { 'Content-Type': 'application/octet-stream' },
        timeout: 60000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      });
      return response.headers.etag;
    } catch (error) {
      if (attempt === retries) {
        throw new Error(`Falha no upload da parte ${partNumber} após ${retries} tentativas: ${error.message}`);
      }
      log(`   ⚠️  Parte ${partNumber} falhou, tentando novamente (${attempt}/${retries})...`);
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}

async function uploadVideoInParts(filePath, presignedUrls) {
  const totalParts = presignedUrls.length;
  const fileHandle = fs.openSync(filePath, 'r');
  const uploadedParts = [];

  try {
    for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
      const start = (partNumber - 1) * CHUNK_SIZE;
      const buffer = Buffer.alloc(CHUNK_SIZE);
      const bytesRead = fs.readSync(fileHandle, buffer, 0, CHUNK_SIZE, start);
      const chunk = buffer.slice(0, bytesRead);

      const presignedUrl = presignedUrls[partNumber - 1];
      const etag = await uploadPart(presignedUrl, chunk, partNumber);

      uploadedParts.push({
        ETag: etag.replace(/"/g, ''),
        PartNumber: partNumber
      });

      if (partNumber % 10 === 0 || partNumber === totalParts) {
        const progress = ((partNumber / totalParts) * 100).toFixed(1);
        log(`   ✅ Progresso: ${partNumber}/${totalParts} partes (${progress}%)`);
      }
    }
    return uploadedParts;
  } finally {
    fs.closeSync(fileHandle);
  }
}

async function completeMultipartUpload(contentLanguageId, uploadId, parts) {
  log(`🔄 Finalizando upload multipart...`);

  const response = await axios.post(
    `${API_URL}/content-language-upload/complete-multipart`,
    {
      content_language_id: contentLanguageId,
      upload_id: uploadId,
      parts: parts
    },
    {
      timeout: 120000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    }
  );
  return response.data;
}

async function uploadVideo(video) {
  const startTime = Date.now();

  log('');
  log('='.repeat(80));
  log(`🎬 Processando: ${video.name}`);
  log(`   Language ID: ${video.languageId}`);
  log('='.repeat(80));
  log('');

  try {
    // Iniciar upload multipart
    const { uploadId, presignedUrls, storageKey } = await initiateMultipartUpload(
      video.languageId,
      video.path
    );

    log(`✅ Upload iniciado com sucesso!`);
    log(`   Upload ID: ${uploadId}`);
    log(`   Storage Key: ${storageKey}`);
    log(`   Total de partes: ${presignedUrls.length}`);
    log('');

    // Upload das partes
    const parts = await uploadVideoInParts(video.path, presignedUrls);

    log('');
    log(`✅ Todas as ${parts.length} partes foram enviadas!`);
    log('');

    // Completar upload
    const result = await completeMultipartUpload(video.languageId, uploadId, parts);

    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);

    log('');
    log(`✅ Upload completado com sucesso!`);
    log(`   Video URL: ${result.data.video_url}`);
    log(`   Tempo decorrido: ${duration} minutos`);
    log('');

    return { success: true, video: video.name };
  } catch (error) {
    log(`❌ Erro ao processar ${video.name}: ${error.message}`);
    if (error.response) {
      log(`   Status: ${error.response.status}`);
      log(`   Resposta: ${JSON.stringify(error.response.data)}`);
    }
    return { success: false, video: video.name, error: error.message };
  }
}

async function main() {
  const startTime = Date.now();

  log('🎥 INICIANDO UPLOAD DE "A HORA DO MAL"');
  log(`📊 Total de vídeos: ${VIDEOS.length}`);
  log('');

  const results = [];

  for (const video of VIDEOS) {
    const result = await uploadVideo(video);
    results.push(result);

    // Aguardar 5 segundos entre uploads
    if (video !== VIDEOS[VIDEOS.length - 1]) {
      log('⏳ Aguardando 5 segundos antes do próximo vídeo...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  // Resumo final
  const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
  const successful = results.filter(r => r.success).length;

  log('');
  log('='.repeat(80));
  log('📋 RESUMO FINAL');
  log('='.repeat(80));

  results.forEach(r => {
    log(r.success ? `✅ ${r.video}` : `❌ ${r.video}`);
  });

  log('');
  log(`✨ ${successful}/${VIDEOS.length} vídeos enviados com sucesso!`);
  log(`⏱️  Tempo total: ${totalTime} minutos`);
  log('');

  logFile.end();
  process.exit(successful === VIDEOS.length ? 0 : 1);
}

main().catch(error => {
  log(`❌ Erro fatal: ${error.message}`);
  logFile.end();
  process.exit(1);
});
