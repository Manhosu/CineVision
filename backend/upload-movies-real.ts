import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// AWS Configuration
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

// Supabase Configuration
const supabaseUrl = 'https://szghyvnbmjlquznxhqum.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6Z2h5dm5ibWpscXV6bnhocXVtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODc0OTk5OSwiZXhwIjoyMDc0MzI1OTk5fQ.p9_G_CjLg8h2CVZqteKLdK9WUFKFdXSqTuTolHFiWGc';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const BUCKET_NAME = 'cinevision-filmes';
const MOVIES_DIR = 'E:/movies';

// Mapping of folder names to database titles
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
  console.log(`📤 Uploading ${path.basename(filePath)} to S3...`);

  const fileStream = fs.createReadStream(filePath);
  const fileStats = fs.statSync(filePath);

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: s3Key,
    Body: fileStream,
    ContentType: 'video/x-matroska',
    ContentLength: fileStats.size,
  });

  await s3Client.send(command);

  const s3Url = `https://${BUCKET_NAME}.s3.us-east-1.amazonaws.com/${s3Key}`;
  console.log(`✅ Upload complete: ${s3Url}`);

  return s3Url;
}

async function updateContentVideoUrl(title: string, videoUrl: string) {
  console.log(`💾 Updating database for "${title}"...`);

  const { data, error } = await supabase
    .from('content')
    .update({
      video_url: videoUrl,
      processing_status: 'completed',
      updated_at: new Date().toISOString(),
    })
    .eq('title', title)
    .select();

  if (error) {
    console.error(`❌ Error updating ${title}:`, error);
    throw error;
  }

  console.log(`✅ Database updated for "${title}"`);
  return data;
}

async function processMovie(folderName: string, dbTitle: string) {
  console.log(`\n🎬 Processing: ${dbTitle}`);
  console.log(`📁 Folder: ${folderName}`);

  const folderPath = path.join(MOVIES_DIR, folderName);
  const files = fs.readdirSync(folderPath);

  // Find DUBLADO file (prefer .mkv, fallback to .mp4)
  const dubladoFile = files.find(f =>
    f.includes('DUBLADO') && (f.endsWith('.mkv') || f.endsWith('.mp4'))
  );

  if (!dubladoFile) {
    console.log(`⚠️  No DUBLADO file found in ${folderName}`);
    return;
  }

  const filePath = path.join(folderPath, dubladoFile);
  const fileStats = fs.statSync(filePath);
  const fileSizeMB = (fileStats.size / (1024 * 1024)).toFixed(2);

  console.log(`📦 File: ${dubladoFile} (${fileSizeMB} MB)`);

  // Generate S3 key
  const sanitizedTitle = dbTitle.toLowerCase()
    .replace(/[:\s]+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
  const fileExt = path.extname(dubladoFile);
  const s3Key = `videos/${sanitizedTitle}-2025-dubbed${fileExt}`;

  // Upload to S3
  const s3Url = await uploadFileToS3(filePath, s3Key);

  // Update database
  await updateContentVideoUrl(dbTitle, s3Url);

  console.log(`✅ ${dbTitle} - COMPLETE`);
}

async function main() {
  console.log('🎬 Starting Real Movie Upload Process...\n');
  console.log(`📂 Source: ${MOVIES_DIR}`);
  console.log(`☁️  Bucket: ${BUCKET_NAME}`);
  console.log(`🗃️  Database: ${supabaseUrl}\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const [folderName, dbTitle] of Object.entries(movieMapping)) {
    try {
      await processMovie(folderName, dbTitle);
      successCount++;
    } catch (error) {
      console.error(`❌ Failed to process ${dbTitle}:`, error);
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 UPLOAD SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${errorCount}`);
  console.log(`📝 Total: ${successCount + errorCount}`);
  console.log('='.repeat(60));
}

main().catch(console.error);
