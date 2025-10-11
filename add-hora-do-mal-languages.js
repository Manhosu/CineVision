const axios = require('axios');
const fs = require('fs');
const path = require('path');

const API_URL = 'http://localhost:3001/api/v1';
const CONTENT_ID = 'da5a57f3-a4d8-41d7-bffd-3f46042b55ea'; // A Hora do Mal ID
const MOVIE_FOLDER = 'E:/movies/FILME_ A Hora do Mal (2025)';

const VIDEOS = [
  {
    file: 'A Hora do Mal (2025) - DUBLADO.mp4',
    language: 'pt-BR',
    audioType: 'dubbed',
    languageName: 'Português (Brasil) - Dublado'
  },
  {
    file: 'A Hora do Mal (2025) - LEGENDADO.mp4',
    language: 'pt-BR',
    audioType: 'subtitled',
    languageName: 'Português (Brasil) - Legendado'
  }
];

async function uploadVideoLanguage(video) {
  const videoPath = path.join(MOVIE_FOLDER, video.file);
  const fileSize = fs.statSync(videoPath).size;

  console.log(`\n📹 Uploading: ${video.file}`);
  console.log(`   Size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   Language: ${video.languageName}`);

  try {
    // Step 1: Initiate multipart upload
    console.log('   1️⃣ Initiating multipart upload...');
    const initResponse = await axios.post(`${API_URL}/admin/uploads/initiate`, {
      contentId: CONTENT_ID,
      language: video.language,
      audioType: video.audioType,
      fileName: video.file,
      fileSize
    });

    const { uploadId, languageId } = initResponse.data;
    console.log(`   ✅ Upload initiated - ID: ${uploadId}`);

    // Step 2: Upload parts
    const CHUNK_SIZE = 100 * 1024 * 1024; // 100MB chunks
    const totalParts = Math.ceil(fileSize / CHUNK_SIZE);
    const uploadedParts = [];

    console.log(`   2️⃣ Uploading ${totalParts} parts...`);

    for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
      const start = (partNumber - 1) * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, fileSize);

      // Get presigned URL for this part
      const urlResponse = await axios.post(`${API_URL}/admin/uploads/part-url`, {
        uploadId,
        languageId,
        partNumber
      });

      const presignedUrl = urlResponse.data.url;

      // Read chunk
      const chunk = fs.readFileSync(videoPath, {
        start,
        end: end - 1
      });

      // Upload chunk to S3
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
      console.log(`   ⏳ Part ${partNumber}/${totalParts} (${progress}%)`);
    }

    // Step 3: Complete upload
    console.log('   3️⃣ Completing upload...');
    await axios.post(`${API_URL}/admin/uploads/complete`, {
      uploadId,
      languageId,
      parts: uploadedParts
    });

    console.log(`   ✅ Upload complete: ${video.file}\n`);
    return true;

  } catch (error) {
    console.error(`   ❌ Error uploading video:`, error.response?.data || error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Adding language versions to A Hora do Mal...\n');
  console.log(`Content ID: ${CONTENT_ID}`);
  console.log(`Folder: ${MOVIE_FOLDER}\n`);
  console.log('='.repeat(60));

  for (const video of VIDEOS) {
    await uploadVideoLanguage(video);
  }

  console.log('\n' + '='.repeat(60));
  console.log('🎉 ALL LANGUAGE VERSIONS UPLOADED!');
  console.log('='.repeat(60));
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error.message);
  process.exit(1);
});
