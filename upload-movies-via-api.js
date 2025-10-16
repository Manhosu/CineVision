const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

// Configurações
const API_BASE_URL = 'http://localhost:3001/api';
const MOVIES_DIR = 'E:/movies';
const USER_EMAIL = 'cinevision@teste.com';

// Lista de filmes (excluindo Superman)
const MOVIES = [
  "FILME_  Lilo & Stitch (2025)",
  "FILME_ A Hora do Mal (2025)",
  "FILME_ A Longa Marcha - Caminhe ou Morra (2025)",
  "FILME_ Como Treinar o Seu Dragão (2025)",
  "FILME_ Demon Slayer - Castelo Infinito (2025)",
  "FILME_ F1 - O Filme (2025)",
  "FILME_ Invocação do Mal 4_ O Último Ritual (2025)",
  "FILME_ Jurassic World_ Recomeço (2025)",
  "FILME_ Quarteto Fantástico 4 - Primeiros Passos (2025)",
];

function cleanTitle(folderName) {
  // Remove 'FILME_' e ano
  let title = folderName.replace(/^FILME_\s*/, '');
  title = title.replace(/\s*\(\d{4}\)$/, '');
  return title.trim();
}

function getYear(folderName) {
  const match = folderName.match(/\((\d{4})\)/);
  return match ? parseInt(match[1]) : 2025;
}

function findVideoFiles(movieDir) {
  const files = fs.readdirSync(movieDir);
  const videos = {};

  for (const file of files) {
    if (file.match(/\.(mp4|mkv|avi)$/i)) {
      if (file.toUpperCase().includes('DUBLADO')) {
        videos.dubbed = path.join(movieDir, file);
      } else if (file.toUpperCase().includes('LEGENDADO')) {
        videos.subtitled = path.join(movieDir, file);
      }
    }
  }

  return videos;
}

function findCoverImage(movieDir) {
  const files = fs.readdirSync(movieDir);

  for (const file of files) {
    if (file.match(/\.(jpg|jpeg|png|webp)$/i)) {
      if (file.match(/poster|capa|cover/i)) {
        return path.join(movieDir, file);
      }
    }
  }

  // Se não encontrar, pega a primeira imagem
  for (const file of files) {
    if (file.match(/\.(jpg|jpeg|png|webp)$/i)) {
      return path.join(movieDir, file);
    }
  }

  return null;
}

async function createContent(title, year, coverUrl) {
  console.log('  Creating content record...');

  const response = await axios.post(`${API_BASE_URL}/content`, {
    title: title,
    description: `${title} (${year})`,
    release_year: year,
    content_type: 'movie',
    poster_url: coverUrl,
    price_cents: 1500,
    currency: 'BRL',
    status: 'ACTIVE',
    is_online: true
  });

  console.log(`  ✅ Content created: ${response.data.id}`);
  return response.data.id;
}

async function uploadFileToS3(filePath, bucket, key) {
  console.log(`  Uploading ${path.basename(filePath)} to S3...`);
  console.log(`  File size: ${(fs.statSync(filePath).size / (1024 ** 3)).toFixed(2)} GB`);

  const formData = new FormData();
  formData.append('file', fs.createReadStream(filePath));
  formData.append('bucket', bucket);
  formData.append('key', key);

  const response = await axios.post(`${API_BASE_URL}/upload/s3`, formData, {
    headers: formData.getHeaders(),
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    timeout: 600000 // 10 minutes
  });

  console.log(`  ✅ Uploaded: ${response.data.url}`);
  return { url: response.data.url, key: key };
}

async function createContentLanguage(contentId, languageType, videoUrl, videoKey) {
  console.log(`  Creating ${languageType} language record...`);

  const response = await axios.post(`${API_BASE_URL}/content-languages`, {
    content_id: contentId,
    language_type: languageType,
    language_code: languageType === 'dubbed' ? 'pt-BR' : 'en-US',
    language_name: languageType === 'dubbed' ? 'Português (Brasil)' : 'English (US)',
    video_url: videoUrl,
    video_storage_key: videoKey,
    upload_status: 'completed',
    is_active: true,
    is_default: languageType === 'dubbed'
  });

  console.log(`  ✅ Language created: ${response.data.id}`);
  return response.data.id;
}

async function createPurchase(userEmail, contentId) {
  console.log(`  Creating purchase for ${userEmail}...`);

  // Get user ID
  const userResponse = await axios.get(`${API_BASE_URL}/users/by-email/${userEmail}`);
  const userId = userResponse.data.id;

  const response = await axios.post(`${API_BASE_URL}/purchases`, {
    user_id: userId,
    content_id: contentId,
    amount_cents: 1500,
    currency: 'BRL',
    status: 'COMPLETED'
  });

  console.log(`  ✅ Purchase created: ${response.data.id}`);
  return response.data.id;
}

async function processMovie(movieFolder) {
  console.log('\n================================================================================');
  console.log(`Processing: ${movieFolder}`);
  console.log('================================================================================');

  const movieDir = path.join(MOVIES_DIR, movieFolder);
  const title = cleanTitle(movieFolder);
  const year = getYear(movieFolder);

  console.log(`Title: ${title}`);
  console.log(`Year: ${year}`);

  // Find files
  const videos = findVideoFiles(movieDir);
  const cover = findCoverImage(movieDir);

  console.log(`Videos found: ${Object.keys(videos).length}`);
  for (const [lang, filePath] of Object.entries(videos)) {
    console.log(`  - ${lang}: ${path.basename(filePath)}`);
  }

  if (cover) {
    console.log(`Cover: ${path.basename(cover)}`);
  }

  try {
    // Upload cover
    let coverUrl = null;
    if (cover) {
      const timestamp = Date.now();
      const coverKey = `covers/movies/${title.toLowerCase().replace(/ /g, '-')}-${timestamp}${path.extname(cover)}`;
      const result = await uploadFileToS3(cover, 'cinevision-cover', coverKey);
      coverUrl = result.url;
    }

    // Create content
    const contentId = await createContent(title, year, coverUrl);

    // Upload videos and create language records
    for (const [langType, videoPath] of Object.entries(videos)) {
      const timestamp = Date.now();
      const videoKey = `videos/movies/${title.toLowerCase().replace(/ /g, '-')}-${langType}-${timestamp}${path.extname(videoPath)}`;
      const result = await uploadFileToS3(videoPath, 'cinevision-video', videoKey);
      await createContentLanguage(contentId, langType, result.url, result.key);
    }

    // Create purchase
    await createPurchase(USER_EMAIL, contentId);

    console.log(`\n✅ Movie '${title}' processed successfully!`);
    console.log(`   Content ID: ${contentId}`);

    return { status: 'success', contentId };
  } catch (error) {
    console.error(`\n❌ FAILED: ${title}`);
    console.error(`   Error: ${error.message}`);
    return { status: 'failed', error: error.message };
  }
}

async function main() {
  console.log('CineVision - Batch Movie Upload');
  console.log(`Movies directory: ${MOVIES_DIR}`);
  console.log(`Movies to process: ${MOVIES.length}`);
  console.log();

  const results = [];

  for (let i = 0; i < MOVIES.length; i++) {
    const movieFolder = MOVIES[i];
    console.log(`\n[${i + 1}/${MOVIES.length}] Starting: ${movieFolder}`);

    const result = await processMovie(movieFolder);
    results.push({ movie: movieFolder, ...result });
  }

  // Summary
  console.log('\n================================================================================');
  console.log('UPLOAD SUMMARY');
  console.log('================================================================================');

  const successCount = results.filter(r => r.status === 'success').length;
  const failedCount = results.filter(r => r.status === 'failed').length;

  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Failed: ${failedCount}`);
  console.log();

  for (const result of results) {
    const icon = result.status === 'success' ? '✅' : '❌';
    console.log(`${icon} ${result.movie}`);
    if (result.status === 'success') {
      console.log(`   Content ID: ${result.contentId}`);
    } else {
      console.log(`   Error: ${result.error}`);
    }
  }

  console.log('\n================================================================================');
}

main().catch(console.error);
