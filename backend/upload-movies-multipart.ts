import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

const supabaseUrl = 'https://szghyvnbmjlquznxhqum.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6Z2h5dm5ibWpscXV6bnhocXVtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODc0OTk5OSwiZXhwIjoyMDc0MzI1OTk5fQ.p9_G_CjLg8h2CVZqteKLdK9WUFKFdXSqTuTolHFiWGc';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const BUCKET_NAME = 'cinevision-filmes';
const MOVIES_DIR = 'E:/movies';

const movieMapping: Record<string, string> = {
  'FILME_  Lilo & Stitch (2025)': 'Lilo & Stitch',
  'FILME_ A Hora do Mal (2025)': 'A Hora do Mal',
  'FILME_ A Longa Marcha - Caminhe ou Morra (2025)': 'A Longa Marcha - Caminhe ou Morra',
  'FILME_ Como Treinar o Seu Dragão (2025)': 'Como Treinar o Seu Dragão',
  'FILME_ Demon Slayer - Castelo Infinito (2025)': 'Demon Slayer - Castelo Infinito',
  'FILME_ F1 - O Filme (2025)': 'F1 - O Filme',
  'FILME_ Invocação do Mal 4_ O Último Ritual (2025)': 'Invocação do Mal 4: O Último Ritual',
  'FILME_ Jurassic World_ Recomeço (2025)': 'Jurassic World: Recomeço',
  'FILME_ Quarteto Fantástico 4 - Primeiros Passos (2025)': 'Quarteto Fantástico 4 - Primeiros Passos',
};

async function uploadFileToS3(filePath: string, s3Key: string): Promise<string> {
  const fileStats = fs.statSync(filePath);
  const fileSizeMB = (fileStats.size / (1024 * 1024)).toFixed(2);

  console.log(`📤 Starting multipart upload: ${path.basename(filePath)} (${fileSizeMB} MB)`);

  const fileStream = fs.createReadStream(filePath);

  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: BUCKET_NAME,
      Key: s3Key,
      Body: fileStream,
      ContentType: 'video/x-matroska',
    },
    queueSize: 4,
    partSize: 10 * 1024 * 1024, // 10 MB parts
    leavePartsOnError: false,
  });

  upload.on('httpUploadProgress', (progress) => {
    if (progress.loaded && progress.total) {
      const percent = ((progress.loaded / progress.total) * 100).toFixed(1);
      const loadedMB = (progress.loaded / (1024 * 1024)).toFixed(1);
      const totalMB = (progress.total / (1024 * 1024)).toFixed(1);
      process.stdout.write(`\r   Progress: ${percent}% (${loadedMB}/${totalMB} MB)`);
    }
  });

  await upload.done();
  console.log('\n✅ Upload complete!');

  return `https://${BUCKET_NAME}.s3.us-east-1.amazonaws.com/${s3Key}`;
}

async function updateContentVideoUrl(title: string, videoUrl: string) {
  console.log(`💾 Updating database for "${title}"...`);

  const { error } = await supabase
    .from('content')
    .update({
      video_url: videoUrl,
      processing_status: 'completed',
      updated_at: new Date().toISOString(),
    })
    .eq('title', title);

  if (error) {
    console.error(`❌ Database error:`, error);
    throw error;
  }

  console.log(`✅ Database updated!`);
}

async function processMovie(folderName: string, dbTitle: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🎬 ${dbTitle}`);
  console.log(`${'='.repeat(60)}`);

  const folderPath = path.join(MOVIES_DIR, folderName);
  const files = fs.readdirSync(folderPath);

  const dubladoFile = files.find(f =>
    f.includes('DUBLADO') && (f.endsWith('.mkv') || f.endsWith('.mp4'))
  );

  if (!dubladoFile) {
    console.log(`⚠️  No DUBLADO file found`);
    return;
  }

  const filePath = path.join(folderPath, dubladoFile);

  const sanitizedTitle = dbTitle.toLowerCase()
    .replace(/[:\s]+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
  const fileExt = path.extname(dubladoFile);
  const s3Key = `videos/${sanitizedTitle}-2025-dubbed${fileExt}`;

  const s3Url = await uploadFileToS3(filePath, s3Key);
  await updateContentVideoUrl(dbTitle, s3Url);

  console.log(`✅ ${dbTitle} - COMPLETE\n`);
}

async function main() {
  console.log('🎬 Starting Movie Upload with Multipart Upload...\n');
  console.log(`📂 Source: ${MOVIES_DIR}`);
  console.log(`☁️  Bucket: ${BUCKET_NAME}\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const [folderName, dbTitle] of Object.entries(movieMapping)) {
    try {
      await processMovie(folderName, dbTitle);
      successCount++;
    } catch (error) {
      console.error(`\n❌ Failed: ${dbTitle}`, error);
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 FINAL SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${errorCount}`);
  console.log('='.repeat(60));
}

main().catch(console.error);
