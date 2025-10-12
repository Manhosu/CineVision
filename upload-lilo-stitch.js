const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: './backend/.env' });

// AWS Configuration
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

// Supabase Configuration
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BUCKET = 'cinevision-video';
const CONTENT_ID = 'c7ed9623-7bcb-4c13-91b7-6f96b76facd1'; // Lilo & Stitch content ID

const videos = [
  {
    localPath: 'E:/movies/FILME_  Lilo & Stitch (2025)/Lilo & Stitch (2025) - DUBLADO.mp4',
    languageId: '73f179fc-28a2-44ea-8cff-71da36e28c31',
    languageType: 'dubbed',
    s3Key: `videos/${CONTENT_ID}/languages/dubbed-pt-BR/${Date.now()}-Lilo-Stitch-2025-DUBLADO.mp4`
  },
  {
    localPath: 'E:/movies/FILME_  Lilo & Stitch (2025)/Lilo & Stitch (2025) - LEGENDADO.mp4',
    languageId: '52810597-8279-4097-b69c-46edd1dc98b5',
    languageType: 'subtitled',
    s3Key: `videos/${CONTENT_ID}/languages/subtitled-pt-BR/${Date.now()}-Lilo-Stitch-2025-LEGENDADO.mp4`
  }
];

async function uploadVideo(video) {
  console.log(`\n📤 Uploading ${video.languageType} version...`);
  console.log(`   Local: ${video.localPath}`);
  console.log(`   S3 Key: ${video.s3Key}`);

  try {
    // Read file
    const fileContent = fs.readFileSync(video.localPath);
    const fileSizeInBytes = fs.statSync(video.localPath).size;
    const fileSizeInMB = (fileSizeInBytes / (1024 * 1024)).toFixed(2);

    console.log(`   Size: ${fileSizeInMB} MB`);

    // Upload to S3
    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: video.s3Key,
      Body: fileContent,
      ContentType: 'video/mp4',
    });

    await s3Client.send(command);
    console.log(`   ✅ Uploaded to S3`);

    // Update database
    const s3Url = `https://${BUCKET}.s3.us-east-2.amazonaws.com/${video.s3Key}`;

    const { error } = await supabase
      .from('content_languages')
      .update({
        video_storage_key: video.s3Key,
        video_url: s3Url,
        updated_at: new Date().toISOString()
      })
      .eq('id', video.languageId);

    if (error) {
      console.error(`   ❌ Database update failed:`, error);
    } else {
      console.log(`   ✅ Database updated`);
      console.log(`   URL: ${s3Url}`);
    }

    return true;
  } catch (error) {
    console.error(`   ❌ Upload failed:`, error.message);
    return false;
  }
}

async function main() {
  console.log('🎬 Starting Lilo & Stitch video upload...\n');
  console.log(`Bucket: ${BUCKET}`);
  console.log(`Region: us-east-2`);
  console.log(`Content ID: ${CONTENT_ID}\n`);

  let successCount = 0;

  for (const video of videos) {
    const success = await uploadVideo(video);
    if (success) successCount++;

    // Wait a bit between uploads
    if (videos.indexOf(video) < videos.length - 1) {
      console.log('\n⏳ Waiting 2 seconds before next upload...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log(`\n\n✅ Upload completed: ${successCount}/${videos.length} videos uploaded successfully`);
}

main().catch(console.error);
