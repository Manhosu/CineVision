const axios = require('axios');
const fs = require('fs');
const path = require('path');

const API_URL = 'http://localhost:3001/api/v1';
const CONTENT_ID = 'da5a57f3-a4d8-41d7-bffd-3f46042b55ea';
const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks

const VIDEOS = [
  {
    path: 'E:/movies/FILME_ A Hora do Mal (2025)/A Hora do Mal (2025) - DUBLADO.mp4',
    language_type: 'dubbed',
    language_code: 'pt-BR',
    language_name: 'Português (Brasil) - Dublado',
    is_default: true
  },
  {
    path: 'E:/movies/FILME_ A Hora do Mal (2025)/A Hora do Mal (2025) - LEGENDADO.mp4',
    language_type: 'subtitled',
    language_code: 'pt-BR',
    language_name: 'Português (Brasil) - Legendado',
    is_default: false
  }
];

async function createLanguage(video) {
  console.log(`\n📝 Criando entrada de idioma: ${video.language_name}...`);
  try {
    const response = await axios.post(
      `${API_URL}/content-language-upload/language`,
      {
        content_id: CONTENT_ID,
        language_type: video.language_type,
        language_code: video.language_code,
        language_name: video.language_name,
        is_default: video.is_default
      }
    );
    console.log('✅ Idioma criado:', response.data.id);
    return response.data.id;
  } catch (error) {
    console.error('❌ Erro ao criar idioma:', error.response?.data || error.message);
    throw error;
  }
}

async function initiateMultipartUpload(contentLanguageId, filePath) {
  const fileName = path.basename(filePath);
  const fileSize = fs.statSync(filePath).size;

  console.log(`\n🚀 Iniciando upload multipart para ${fileName}...`);
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

async function getPresignedUrl(contentLanguageId, uploadId, partNumber) {
  try {
    const response = await axios.post(
      `${API_URL}/content-language-upload/presigned-url`,
      {
        content_language_id: contentLanguageId,
        upload_id: uploadId,
        part_number: partNumber
      }
    );
    return response.data.url;
  } catch (error) {
    console.error(`❌ Erro ao obter URL pré-assinada para parte ${partNumber}:`, error.response?.data || error.message);
    throw error;
  }
}

async function uploadPart(presignedUrl, chunk) {
  try {
    const response = await axios.put(presignedUrl, chunk, {
      headers: {
        'Content-Type': 'application/octet-stream',
      },
    });
    return response.headers.etag;
  } catch (error) {
    console.error('❌ Erro ao fazer upload da parte:', error.message);
    throw error;
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

      console.log(`   Parte ${partNumber}/${totalParts} (${(bytesRead / (1024 * 1024)).toFixed(2)} MB)...`);

      const presignedUrl = presignedUrls[partNumber - 1];
      const etag = await uploadPart(presignedUrl, chunk);

      uploadedParts.push({
        ETag: etag.replace(/"/g, ''),
        PartNumber: partNumber
      });

      const progress = ((partNumber / totalParts) * 100).toFixed(1);
      console.log(`   ✅ Parte ${partNumber}/${totalParts} concluída (${progress}%)`);
    }

    return uploadedParts;
  } finally {
    fs.closeSync(fileHandle);
  }
}

async function completeMultipartUpload(contentLanguageId, uploadId, parts) {
  console.log('\n✨ Finalizando upload...');
  try {
    const response = await axios.post(
      `${API_URL}/content-language-upload/complete-multipart`,
      {
        content_language_id: contentLanguageId,
        upload_id: uploadId,
        parts: parts
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
  console.log(`🎬 Processando: ${video.language_name}`);
  console.log(`${'='.repeat(80)}`);

  try {
    // 1. Criar entrada de idioma
    const languageId = await createLanguage(video);

    // 2. Iniciar upload multipart
    const { uploadId, presignedUrls, storageKey } = await initiateMultipartUpload(languageId, video.path);

    // 3. Upload das partes
    const parts = await uploadVideoInParts(video.path, presignedUrls);

    // 4. Finalizar upload
    await completeMultipartUpload(languageId, uploadId, parts);

    console.log(`\n✅ ${video.language_name} - UPLOAD COMPLETO!`);
    return true;
  } catch (error) {
    console.error(`\n❌ Erro ao processar ${video.language_name}:`, error.message);
    return false;
  }
}

async function main() {
  console.log('🎥 INICIANDO UPLOAD DE "A HORA DO MAL"');
  console.log(`📁 Content ID: ${CONTENT_ID}`);
  console.log(`📊 Total de vídeos: ${VIDEOS.length}`);

  try {
    // Processar cada vídeo
    const results = [];
    for (const video of VIDEOS) {
      const success = await uploadVideo(video);
      results.push({ video: video.language_name, success });
    }

    // Resumo final
    console.log(`\n${'='.repeat(80)}`);
    console.log('📋 RESUMO FINAL');
    console.log(`${'='.repeat(80)}`);
    results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      console.log(`${status} ${result.video}`);
    });

    const successCount = results.filter(r => r.success).length;
    console.log(`\n✨ ${successCount}/${VIDEOS.length} vídeos enviados com sucesso!`);

  } catch (error) {
    console.error('\n❌ ERRO FATAL:', error.message);
    process.exit(1);
  }
}

main();
