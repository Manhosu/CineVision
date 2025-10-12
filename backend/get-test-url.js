const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

// Load credentials from environment variables
require('dotenv').config();

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

async function getUrl() {
  const videoKey = 'videos/c7ed9623-7bcb-4c13-91b7-6f96b76facd1/languages/dubbed-pt-BR/1760228827742-Lilo-Stitch-2025-DUBLADO.mp4';

  const command = new GetObjectCommand({
    Bucket: 'cinevision-video',
    Key: videoKey,
  });

  const presignedUrl = await getSignedUrl(s3Client, command, {
    expiresIn: 14400,
  });

  console.log(presignedUrl);
}

getUrl();
