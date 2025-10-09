import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!
);

interface MovieMapping {
  folderName: string;
  dbTitle: string;
  contentId?: string;
}

const movieMappings: MovieMapping[] = [
  { folderName: 'FILME_ A Hora do Mal (2025)', dbTitle: 'A Hora do Mal' },
  { folderName: 'FILME_ A Longa Marcha - Caminhe ou Morra (2025)', dbTitle: 'A Longa Marcha - Caminhe ou Morra' },
  { folderName: 'FILME_ Como Treinar o Seu Dragão (2025)', dbTitle: 'Como Treinar o Seu Dragão' },
  { folderName: 'FILME_ Demon Slayer - Castelo Infinito (2025)', dbTitle: 'Demon Slayer - Castelo Infinito' },
  { folderName: 'FILME_ F1 - O Filme (2025)', dbTitle: 'F1 - O Filme' },
  { folderName: 'FILME_ Invocação do Mal 4_ O Último Ritual (2025)', dbTitle: 'Invocação do Mal 4: O Último Ritual' },
  { folderName: 'FILME_ Jurassic World_ Recomeço (2025)', dbTitle: 'Jurassic World: Recomeço' },
  { folderName: 'FILME_ Quarteto Fantástico 4 - Primeiros Passos (2025)', dbTitle: 'Quarteto Fantástico 4 - Primeiros Passos' },
];

async function uploadVideoToS3(filePath: string, s3Key: string): Promise<string> {
  console.log(`📤 Uploading ${path.basename(filePath)} to S3...`);

  const fileStream = fs.createReadStream(filePath);
  const stats = fs.statSync(filePath);

  const uploadParams = {
    Bucket: process.env.S3_VIDEO_BUCKET!,
    Key: s3Key,
    Body: fileStream,
    ContentType: 'video/x-matroska',
  };

  await s3Client.send(new PutObjectCommand(uploadParams));

  const s3Url = `https://${process.env.S3_VIDEO_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;
  console.log(`✅ Uploaded: ${s3Url}`);

  return s3Url;
}

async function updateContentInDatabase(contentId: string, videoUrl: string) {
  const { error } = await supabase
    .from('content')
    .update({
      video_url: videoUrl,
      processing_status: 'completed',
      updated_at: new Date().toISOString(),
    })
    .eq('id', contentId);

  if (error) {
    console.error(`❌ Error updating content ${contentId}:`, error);
    throw error;
  }

  console.log(`✅ Database updated for content ID: ${contentId}`);
}

async function processMovie(mapping: MovieMapping) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🎬 Processing: ${mapping.dbTitle}`);
  console.log(`${'='.repeat(60)}`);

  // Get content ID from database
  const { data: content, error: fetchError } = await supabase
    .from('content')
    .select('id')
    .eq('title', mapping.dbTitle)
    .single();

  if (fetchError || !content) {
    console.error(`❌ Movie not found in database: ${mapping.dbTitle}`);
    return;
  }

  const contentId = content.id;
  console.log(`📋 Content ID: ${contentId}`);

  // Find video file
  const movieDir = path.join('E:', 'movies', mapping.folderName);

  if (!fs.existsSync(movieDir)) {
    console.error(`❌ Directory not found: ${movieDir}`);
    return;
  }

  const files = fs.readdirSync(movieDir);
  const videoFile = files.find(f => f.includes('DUBLADO') && (f.endsWith('.mkv') || f.endsWith('.mp4')));

  if (!videoFile) {
    console.error(`❌ Video file not found in: ${movieDir}`);
    return;
  }

  const videoPath = path.join(movieDir, videoFile);
  console.log(`📁 Found video: ${videoFile}`);

  const fileStats = fs.statSync(videoPath);
  console.log(`📊 File size: ${(fileStats.size / (1024 * 1024 * 1024)).toFixed(2)} GB`);

  // Generate S3 key
  const sanitizedTitle = mapping.dbTitle
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const ext = path.extname(videoFile);
  const s3Key = `videos/${sanitizedTitle}-2025-dubbed${ext}`;

  // Upload to S3
  const videoUrl = await uploadVideoToS3(videoPath, s3Key);

  // Update database
  await updateContentInDatabase(contentId, videoUrl);

  console.log(`✅ Successfully processed: ${mapping.dbTitle}\n`);
}

async function main() {
  console.log('🚀 Starting bulk movie upload process...\n');
  console.log(`📦 S3 Bucket: ${process.env.S3_VIDEO_BUCKET}`);
  console.log(`🌍 Region: ${process.env.AWS_REGION}`);
  console.log(`📊 Total movies to process: ${movieMappings.length}\n`);

  for (const mapping of movieMappings) {
    try {
      await processMovie(mapping);
    } catch (error) {
      console.error(`❌ Failed to process ${mapping.dbTitle}:`, error);
      console.log('⏭️  Continuing with next movie...\n');
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('🎉 Bulk upload process completed!');
  console.log('='.repeat(60));
}

main().catch(console.error);
