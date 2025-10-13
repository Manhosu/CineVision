const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const s3Client = new S3Client({
  region: 'us-east-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

async function testSize(sizeKB) {
  try {
    const testKey = `test-presigned/size-test-${sizeKB}kb-${Date.now()}.bin`;
    const buffer = Buffer.alloc(sizeKB * 1024, 0);

    console.log(`📤 Testando ${sizeKB}KB...`);

    // Upload
    await s3Client.send(new PutObjectCommand({
      Bucket: 'cinevision-video',
      Key: testKey,
      Body: buffer,
      ContentType: 'application/octet-stream'
    }));

    // Presigned URL
    const presignedUrl = await getSignedUrl(
      s3Client,
      new GetObjectCommand({ Bucket: 'cinevision-video', Key: testKey }),
      { expiresIn: 3600 }
    );

    // Testar
    const response = await fetch(presignedUrl, { method: 'HEAD' });

    if (response.status === 200) {
      console.log(`   ✅ ${sizeKB}KB: 200 OK`);
      return true;
    } else {
      console.log(`   ❌ ${sizeKB}KB: ${response.status} Forbidden`);
      return false;
    }

  } catch (error) {
    console.log(`   ❌ ${sizeKB}KB: Error - ${error.message}`);
    return false;
  }
}

async function findLimit() {
  console.log('🔍 Procurando limite de tamanho para presigned URLs\n');

  const sizes = [
    1,      // 1KB
    10,     // 10KB
    50,     // 50KB
    100,    // 100KB
    500,    // 500KB
    1024,   // 1MB
    5120,   // 5MB
  ];

  for (const size of sizes) {
    const worked = await testSize(size);
    if (!worked) {
      console.log(`\n⚠️ Limite encontrado entre ${sizes[sizes.indexOf(size) - 1] || 0}KB e ${size}KB\n`);
      break;
    }
  }

  console.log('Teste concluído.\n');
}

findLimit();
