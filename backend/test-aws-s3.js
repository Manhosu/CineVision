const { S3Client, ListBucketsCommand, GetBucketLocationCommand, GetBucketCorsCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
require('dotenv').config();

// Configure AWS S3 Client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

async function testS3Connection() {
  try {
    console.log('Testing S3 connection...');
    
    // Test bucket access
    const listBucketsCommand = new ListBucketsCommand({});
    const buckets = await s3Client.send(listBucketsCommand);
    console.log('✅ S3 connection successful!');
    console.log('Available buckets:', buckets.Buckets.map(b => b.Name));
    
    // Test specific bucket access
    const bucketName = process.env.S3_VIDEO_BUCKET;
    console.log(`\nTesting access to bucket: ${bucketName}`);
    
    const getBucketLocationCommand = new GetBucketLocationCommand({ Bucket: bucketName });
    const bucketLocation = await s3Client.send(getBucketLocationCommand);
    console.log(`✅ Bucket location: ${bucketLocation.LocationConstraint || 'us-east-1'}`);
    
    // Test CORS configuration
    try {
      const getBucketCorsCommand = new GetBucketCorsCommand({ Bucket: bucketName });
      const corsConfig = await s3Client.send(getBucketCorsCommand);
      console.log('✅ CORS configuration found:', JSON.stringify(corsConfig, null, 2));
    } catch (error) {
      console.log('⚠️  CORS configuration not found or accessible');
    }
    
    // Test presigned URL generation
    const putObjectCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: 'test-upload.txt',
      ContentType: 'text/plain'
    });
    
    const presignedUrl = await getSignedUrl(s3Client, putObjectCommand, { expiresIn: 3600 });
    
    console.log('✅ Presigned URL generated successfully');
    console.log('Sample presigned URL (first 100 chars):', presignedUrl.substring(0, 100) + '...');
    
  } catch (error) {
    console.error('❌ S3 connection failed:', error.message);
  }
}

testS3Connection();