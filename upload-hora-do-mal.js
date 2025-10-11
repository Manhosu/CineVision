const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const API_URL = 'http://localhost:3001';
const CONTENT_ID = '92f208c7-b480-47d2-bef1-b6b0da9e27d2';

// Arquivos para upload
const FILES = [
  {
    path: 'E:/movies/FILME_ A Hora do Mal (2025)/A Hora do Mal (2025) - DUBLADO.mp4',
    languageType: 'DUBLADO',
    languageCode: 'pt-BR',
    languageName: 'Português (Brasil) - Dublado'
  },
  {
    path: 'E:/movies/FILME_ A Hora do Mal (2025)/A Hora do Mal (2025) - LEGENDADO.mp4',
    languageType: 'LEGENDADO',
    languageCode: 'pt-BR',
    languageName: 'Português (Brasil) - Legendado'
  }
];

// Tamanho de cada parte (5MB)
const PART_SIZE = 5 * 1024 * 1024;

async function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;

    const req = client.request(url, {
      method: options.method || 'GET',
      headers: options.headers || {},
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            json: () => Promise.resolve(JSON.parse(data)),
            text: () => Promise.resolve(data)
          });
        } catch (e) {
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            text: () => Promise.resolve(data)
          });
        }
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });
}

async function uploadFilePart(presignedUrl, buffer) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(presignedUrl);
    const client = urlObj.protocol === 'https:' ? https : http;

    const req = client.request(presignedUrl, {
      method: 'PUT',
      headers: {
        'Content-Length': buffer.length,
      },
    }, (res) => {
      const etag = res.headers['etag'];
      res.on('data', () => {}); // Consume response
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(etag);
        } else {
          reject(new Error(`Upload failed with status ${res.statusCode}`));
        }
      });
    });

    req.on('error', reject);
    req.write(buffer);
    req.end();
  });
}

async function uploadFile(fileInfo) {
  console.log(`\n📹 Iniciando upload: ${fileInfo.languageType}`);
  console.log(`📁 Arquivo: ${fileInfo.path}`);

  // Verificar se o arquivo existe
  if (!fs.existsSync(fileInfo.path)) {
    throw new Error(`Arquivo não encontrado: ${fileInfo.path}`);
  }

  const stats = fs.statSync(fileInfo.path);
  const fileSize = stats.size;
  const fileName = path.basename(fileInfo.path);

  console.log(`📊 Tamanho: ${(fileSize / 1024 / 1024 / 1024).toFixed(2)} GB`);

  // Calcular número de partes
  const totalParts = Math.ceil(fileSize / PART_SIZE);
  console.log(`📦 Partes: ${totalParts}`);

  // 1. Criar registro de language
  console.log('🆕 Criando registro de idioma...');
  const createLangResponse = await fetch(`${API_URL}/api/v1/content-language-upload/language`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      content_id: CONTENT_ID,
      language_type: fileInfo.languageType.toLowerCase() === 'dublado' ? 'dubbed' : 'subtitled',
      language_code: fileInfo.languageCode,
      language_name: fileInfo.languageName,
      is_default: false
    })
  });

  if (!createLangResponse.ok) {
    const error = await createLangResponse.text();
    throw new Error(`Falha ao criar idioma: ${error}`);
  }

  const langData = await createLangResponse.json();
  console.log(`✅ Idioma criado - ID: ${langData.id}`);

  // 2. Iniciar upload multipart
  console.log('🚀 Iniciando upload multipart...');
  const initResponse = await fetch(`${API_URL}/api/v1/content-language-upload/initiate-multipart`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      content_language_id: langData.id,
      file_name: fileName,
      file_size: fileSize,
      content_type: 'video/mp4'
    })
  });

  if (!initResponse.ok) {
    const error = await initResponse.text();
    throw new Error(`Falha ao iniciar upload: ${error}`);
  }

  const initData = await initResponse.json();
  console.log(`✅ Upload iniciado - Upload ID: ${initData.uploadId}`);

  // 2. Upload de cada parte
  const uploadedParts = [];
  const fileStream = fs.createReadStream(fileInfo.path, { highWaterMark: PART_SIZE });

  let partNumber = 1;

  for await (const chunk of fileStream) {
    process.stdout.write(`\r⬆️  Uploading parte ${partNumber}/${totalParts} (${((partNumber / totalParts) * 100).toFixed(1)}%)`);

    const presignedUrl = initData.presignedUrls[partNumber - 1];
    const etag = await uploadFilePart(presignedUrl, chunk);

    uploadedParts.push({
      PartNumber: partNumber,
      ETag: etag.replace(/"/g, '') // Remove quotes from ETag
    });

    partNumber++;
  }

  console.log('\n✅ Todas as partes enviadas!');

  // 3. Completar upload
  console.log('🔄 Finalizando upload...');
  const completeResponse = await fetch(`${API_URL}/api/v1/content-language-upload/complete-multipart`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      content_language_id: langData.id,
      upload_id: initData.uploadId,
      parts: uploadedParts
    })
  });

  if (!completeResponse.ok) {
    const error = await completeResponse.text();
    throw new Error(`Falha ao completar upload: ${error}`);
  }

  const completeData = await completeResponse.json();
  console.log(`✅ Upload completado com sucesso!`);
  console.log(`🔗 Video URL: ${completeData.videoUrl}`);

  return completeData;
}

async function main() {
  console.log('🎬 A Hora do Mal - Upload de Vídeos');
  console.log('=====================================\n');
  console.log(`📝 Content ID: ${CONTENT_ID}`);
  console.log(`🌐 API URL: ${API_URL}`);

  try {
    // Upload DUBLADO
    await uploadFile(FILES[0]);

    // Upload LEGENDADO
    await uploadFile(FILES[1]);

    console.log('\n✅ Todos os uploads concluídos com sucesso!');
    console.log('\n🎉 O filme "A Hora do Mal" agora tem ambas as versões disponíveis!');

  } catch (error) {
    console.error('\n❌ Erro:', error.message);
    process.exit(1);
  }
}

main();
