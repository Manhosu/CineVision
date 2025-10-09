import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import FormData from 'form-data';

const MOVIES_DIR = 'E:/movies';
const API_BASE_URL = 'http://localhost:3001/api/v1';
const EXCLUDED_MOVIES = ['Superman', 'Lilo & Stitch'];

interface MovieFolder {
  folderName: string;
  folderPath: string;
}

async function getMovieFolders(): Promise<MovieFolder[]> {
  const folders = fs.readdirSync(MOVIES_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => ({
      folderName: dirent.name,
      folderPath: path.join(MOVIES_DIR, dirent.name)
    }))
    .filter(folder => {
      // Exclude movies that contain excluded keywords
      return !EXCLUDED_MOVIES.some(excluded =>
        folder.folderName.toLowerCase().includes(excluded.toLowerCase())
      );
    });

  console.log(`Found ${folders.length} movie folders to upload (excluding: ${EXCLUDED_MOVIES.join(', ')})`);
  return folders;
}

async function uploadMovie(movieFolder: MovieFolder) {
  console.log(`\n=== Starting upload for: ${movieFolder.folderName} ===`);

  try {
    // Extract movie info from folder name
    const match = movieFolder.folderName.match(/FILME_\s*(.+?)\s*\((\d{4})\)/);
    if (!match) {
      console.log(`⚠️  Skipping ${movieFolder.folderName} - invalid format`);
      return;
    }

    const title = match[1].trim();
    const year = parseInt(match[2]);

    console.log(`Title: ${title}, Year: ${year}`);

    // Find poster and video files
    const files = fs.readdirSync(movieFolder.folderPath);
    const posterFile = files.find(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
    const videoFiles = files.filter(f => /\.(mp4|mkv|avi|mov)$/i.test(f));

    if (!posterFile) {
      console.log(`⚠️  No poster found for ${title}`);
      return;
    }

    if (videoFiles.length === 0) {
      console.log(`⚠️  No video files found for ${title}`);
      return;
    }

    console.log(`Poster: ${posterFile}`);
    console.log(`Videos: ${videoFiles.join(', ')}`);

    // Upload poster first
    const posterPath = path.join(movieFolder.folderPath, posterFile);
    const posterFormData = new FormData();
    posterFormData.append('file', fs.createReadStream(posterPath));
    posterFormData.append('type', 'poster');

    console.log('Uploading poster...');
    const posterResponse = await axios.post(
      `${API_BASE_URL}/admin/api/images/upload`,
      posterFormData,
      { headers: posterFormData.getHeaders(), maxContentLength: Infinity, maxBodyLength: Infinity }
    );

    const posterUrl = posterResponse.data.url;
    console.log(`✓ Poster uploaded: ${posterUrl}`);

    // Create content entry
    console.log('Creating content entry...');
    const contentResponse = await axios.post(`${API_BASE_URL}/admin/content/create`, {
      title,
      description: `${title} - Lançamento ${year}`,
      release_year: year,
      poster_url: posterUrl,
      thumbnail_url: posterUrl,
      backdrop_url: posterUrl,
      price_cents: 650 + Math.floor(Math.random() * 100),
      duration_minutes: 90 + Math.floor(Math.random() * 60),
      genres: ['Ação', 'Aventura'],
      category: 'Ação',
      quality: 'HD',
      format: path.extname(videoFiles[0]).slice(1).toUpperCase(),
      status: 'PUBLISHED'
    });

    const contentId = contentResponse.data.id;
    console.log(`✓ Content created with ID: ${contentId}`);

    // Upload video files as languages
    for (const videoFile of videoFiles) {
      const isDubbed = /dub|dublado/i.test(videoFile);
      const isSubtitled = /sub|legendado/i.test(videoFile);

      let languageType = 'dubbed';
      let languageName = 'Português (Brasil) - Dublado';

      if (isSubtitled) {
        languageType = 'subtitled';
        languageName = 'Português (Brasil) - Legendado';
      }

      console.log(`Uploading ${languageType} video: ${videoFile}...`);

      const videoPath = path.join(movieFolder.folderPath, videoFile);
      const videoStats = fs.statSync(videoPath);
      const fileSizeBytes = videoStats.size;

      console.log(`File size: ${(fileSizeBytes / 1024 / 1024 / 1024).toFixed(2)} GB`);

      // Initiate multipart upload
      const initiateResponse = await axios.post(
        `${API_BASE_URL}/content-language-upload/initiate-multipart`,
        {
          fileName: videoFile,
          fileType: 'video/' + path.extname(videoFile).slice(1).toLowerCase(),
          contentId,
          languageType,
          languageCode: 'pt-BR',
          languageName
        }
      );

      const { uploadId, key, languageId } = initiateResponse.data;
      console.log(`✓ Multipart upload initiated: ${uploadId}`);

      // Upload in chunks (100MB each)
      const chunkSize = 100 * 1024 * 1024; // 100MB
      const fileStream = fs.createReadStream(videoPath, { highWaterMark: chunkSize });
      const parts: Array<{ ETag: string; PartNumber: number }> = [];
      let partNumber = 1;
      let uploadedBytes = 0;

      for await (const chunk of fileStream) {
        const presignedResponse = await axios.post(
          `${API_BASE_URL}/content-language-upload/presigned-url`,
          { key, uploadId, partNumber }
        );

        const presignedUrl = presignedResponse.data.url;

        const uploadResponse = await axios.put(presignedUrl, chunk, {
          headers: { 'Content-Type': 'application/octet-stream' },
          maxContentLength: Infinity,
          maxBodyLength: Infinity
        });

        parts.push({
          ETag: uploadResponse.headers.etag.replace(/"/g, ''),
          PartNumber: partNumber
        });

        uploadedBytes += chunk.length;
        const progress = ((uploadedBytes / fileSizeBytes) * 100).toFixed(2);
        console.log(`Part ${partNumber} uploaded (${progress}%)`);

        partNumber++;
      }

      // Complete multipart upload
      console.log('Completing upload...');
      await axios.post(`${API_BASE_URL}/content-language-upload/complete-multipart`, {
        key,
        uploadId,
        parts
      });

      console.log(`✓ ${languageType} video uploaded successfully!`);
    }

    console.log(`\n✅ Successfully uploaded: ${title}\n`);

  } catch (error: any) {
    console.error(`\n❌ Error uploading ${movieFolder.folderName}:`, error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('BATCH MOVIE UPLOAD');
  console.log('='.repeat(60));

  const folders = await getMovieFolders();

  for (const folder of folders) {
    await uploadMovie(folder);
    // Small delay between uploads
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('\n' + '='.repeat(60));
  console.log('UPLOAD COMPLETE');
  console.log('='.repeat(60));
}

main().catch(console.error);
