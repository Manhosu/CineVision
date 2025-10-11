const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const API_URL = 'http://localhost:3001/api/v1';
const ADMIN_EMAIL = 'admin@cinevision.com';
const ADMIN_PASSWORD = 'Admin@123';

const MOVIES = [
  {
    title: 'A Hora do Mal',
    description: 'Um thriller sobrenatural perturbador que explora os limites do terror psicológico e do horror.',
    synopsis: 'Em uma noite aparentemente tranquila, eventos inexplicáveis começam a se desenrolar em uma casa isolada. O que parecia ser apenas coincidência logo se revela como algo muito mais sinistro e aterrorizante.',
    releaseYear: 2025,
    duration: 98,
    classification: '16',
    genres: ['Terror', 'Suspense', 'Thriller'],
    director: 'Director Name',
    cast: ['Actor 1', 'Actor 2'],
    folder: 'E:/movies/FILME_ A Hora do Mal (2025)',
    posterFile: 'POSTER.png',
    videos: [
      { file: 'A Hora do Mal (2025) - DUBLADO.mp4', language: 'pt-BR', audioType: 'dubbed' },
      { file: 'A Hora do Mal (2025) - LEGENDADO.mp4', language: 'pt-BR', audioType: 'subtitled' }
    ]
  },
  {
    title: 'Lilo & Stitch',
    description: 'Uma emocionante aventura sobre família, amizade e pertencimento.',
    synopsis: 'Uma menina havaiana solitária adota o que ela pensa ser um cachorro, mas na verdade é uma criatura alienígena geneticamente modificada que fugiu de uma prisão intergaláctica.',
    releaseYear: 2025,
    duration: 85,
    classification: 'Livre',
    genres: ['Animação', 'Aventura', 'Família'],
    director: 'Director Name',
    cast: ['Voice Actor 1', 'Voice Actor 2'],
    folder: 'E:/movies/FILME_  Lilo & Stitch (2025)',
    posterFile: 'POSTER.png',
    videos: [
      { file: 'Lilo & Stitch (2025) - DUBLADO.mp4', language: 'pt-BR', audioType: 'dubbed' },
      { file: 'Lilo & Stitch (2025) - LEGENDADO.mp4', language: 'pt-BR', audioType: 'subtitled' }
    ]
  }
];

let authToken = null;

async function login() {
  console.log('🔐 Fazendo login como admin...');
  try {
    const response = await axios.post(`${API_URL}/supabase-auth/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });
    authToken = response.data.access_token;
    console.log('✅ Login realizado com sucesso');
    return authToken;
  } catch (error) {
    console.error('❌ Erro no login:', error.response?.data || error.message);
    throw error;
  }
}

async function uploadPoster(posterPath) {
  console.log('📤 Uploading poster...');
  try {
    const formData = new FormData();
    formData.append('image', fs.createReadStream(posterPath));
    formData.append('type', 'poster');

    const response = await axios.post(`${API_URL}/admin/api/images/upload`, formData, {
      headers: {
        ...formData.getHeaders(),
        'Authorization': `Bearer ${authToken}`
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });

    console.log('✅ Poster uploaded:', response.data.url);
    return response.data.url;
  } catch (error) {
    console.error('❌ Erro no upload do poster:', error.response?.data || error.message);
    throw error;
  }
}

async function createContent(movie, posterUrl) {
  console.log(`🎬 Criando conteúdo: ${movie.title}...`);
  try {
    const response = await axios.post(`${API_URL}/admin/content/create`, {
      title: movie.title,
      description: movie.description,
      synopsis: movie.synopsis,
      poster_url: posterUrl,
      type: 'movie',
      releaseYear: movie.releaseYear,
      duration: movie.duration,
      classification: movie.classification,
      genres: movie.genres,
      director: movie.director,
      cast: movie.cast,
      categoryIds: []
    }, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Conteúdo criado com ID:', response.data.id);
    return response.data.id;
  } catch (error) {
    console.error('❌ Erro ao criar conteúdo:', error.response?.data || error.message);
    throw error;
  }
}

async function uploadVideo(contentId, videoPath, language, audioType) {
  const fileName = path.basename(videoPath);
  const fileSize = fs.statSync(videoPath).size;

  console.log(`\n📹 Iniciando upload: ${fileName}`);
  console.log(`   Tamanho: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   Idioma: ${language}, Tipo: ${audioType}`);

  try {
    // Step 1: Initiate multipart upload
    console.log('   1️⃣ Iniciando multipart upload...');
    const initResponse = await axios.post(`${API_URL}/admin/uploads/initiate`, {
      contentId,
      language,
      audioType,
      fileName,
      fileSize
    }, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });

    const { uploadId, languageId } = initResponse.data;
    console.log(`   ✅ Upload iniciado - ID: ${uploadId}`);

    // Step 2: Upload parts
    const CHUNK_SIZE = 100 * 1024 * 1024; // 100MB chunks
    const totalParts = Math.ceil(fileSize / CHUNK_SIZE);
    const uploadedParts = [];

    console.log(`   2️⃣ Uploading ${totalParts} partes...`);

    for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
      const start = (partNumber - 1) * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, fileSize);

      // Get presigned URL for this part
      const urlResponse = await axios.post(`${API_URL}/admin/uploads/part-url`, {
        uploadId,
        languageId,
        partNumber
      }, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      const presignedUrl = urlResponse.data.url;

      // Read chunk
      const chunk = fs.readFileSync(videoPath, {
        start,
        end: end - 1
      });

      // Upload chunk
      const uploadResponse = await axios.put(presignedUrl, chunk, {
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Length': chunk.length
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      });

      const etag = uploadResponse.headers.etag;
      uploadedParts.push({ PartNumber: partNumber, ETag: etag });

      const progress = ((partNumber / totalParts) * 100).toFixed(1);
      console.log(`   ⏳ Parte ${partNumber}/${totalParts} (${progress}%)`);
    }

    // Step 3: Complete upload
    console.log('   3️⃣ Finalizando upload...');
    await axios.post(`${API_URL}/admin/uploads/complete`, {
      uploadId,
      languageId,
      parts: uploadedParts
    }, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`   ✅ Upload completo: ${fileName}`);
    return languageId;

  } catch (error) {
    console.error(`   ❌ Erro no upload do vídeo:`, error.response?.data || error.message);
    throw error;
  }
}

async function publishContent(contentId) {
  console.log(`\n📢 Publicando conteúdo...`);
  try {
    await axios.put(`${API_URL}/admin/content/${contentId}/publish`, {}, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    console.log('✅ Conteúdo publicado com sucesso');
  } catch (error) {
    console.error('❌ Erro ao publicar conteúdo:', error.response?.data || error.message);
    throw error;
  }
}

async function uploadMovie(movie) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🎬 UPLOADING: ${movie.title}`);
  console.log('='.repeat(60));

  try {
    // Upload poster
    const posterPath = path.join(movie.folder, movie.posterFile);
    const posterUrl = await uploadPoster(posterPath);

    // Create content
    const contentId = await createContent(movie, posterUrl);

    // Upload all video versions
    for (const video of movie.videos) {
      const videoPath = path.join(movie.folder, video.file);
      await uploadVideo(contentId, videoPath, video.language, video.audioType);
    }

    // Publish content
    await publishContent(contentId);

    console.log(`\n✅ ${movie.title} - UPLOAD COMPLETO!`);
    return contentId;

  } catch (error) {
    console.error(`\n❌ Erro ao processar ${movie.title}:`, error.message);
    throw error;
  }
}

async function main() {
  console.log('🚀 Iniciando upload de filmes finais...\n');

  try {
    // Login
    await login();

    // Upload each movie
    for (const movie of MOVIES) {
      await uploadMovie(movie);
    }

    console.log('\n' + '='.repeat(60));
    console.log('🎉 TODOS OS FILMES FORAM ENVIADOS COM SUCESSO!');
    console.log('='.repeat(60));
    console.log('\nFilmes disponíveis:');
    MOVIES.forEach(m => console.log(`  ✅ ${m.title}`));

  } catch (error) {
    console.error('\n❌ Erro fatal:', error.message);
    process.exit(1);
  }
}

main();
