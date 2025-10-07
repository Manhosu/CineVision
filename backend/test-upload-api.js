require('dotenv').config();
const axios = require('axios');

async function testBackendAndS3() {
  try {
    console.log('Testing backend and S3 configuration...');
    
    // Test if backend is running
    try {
      const healthCheck = await axios.get('http://localhost:3000/');
      console.log('✅ Backend is running:', healthCheck.status);
      console.log('Backend response type: HTML page (frontend)');
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        console.log('❌ Backend is not running on port 3000');
        console.log('Please start the backend with: npm run start:dev');
        return;
      }
      throw error;
    }
    
    // Test status endpoint
    try {
      const statusCheck = await axios.get('http://localhost:3000/status');
      console.log('✅ Status endpoint working:', statusCheck.status);
      console.log('Status response:', statusCheck.data);
    } catch (error) {
      console.log('⚠️  Status endpoint not available:', error.response?.status);
    }
    
    console.log('\n📋 S3 Configuration Summary:');
    console.log('- AWS_REGION:', process.env.AWS_REGION || 'us-east-1');
    console.log('- AWS_ACCESS_KEY_ID:', process.env.AWS_ACCESS_KEY_ID ? '✅ Set (' + process.env.AWS_ACCESS_KEY_ID.substring(0, 8) + '...)' : '❌ Not set');
    console.log('- AWS_SECRET_ACCESS_KEY:', process.env.AWS_SECRET_ACCESS_KEY ? '✅ Set (***hidden***)' : '❌ Not set');
    console.log('- S3_VIDEO_BUCKET:', process.env.S3_VIDEO_BUCKET || 'Not set');
    console.log('- S3_COVERS_BUCKET:', process.env.S3_COVERS_BUCKET || 'Not set');
    console.log('- S3_TRAILERS_BUCKET:', process.env.S3_TRAILERS_BUCKET || 'Not set');
    
    // Test S3 connection directly
    console.log('\n🔍 Testing S3 connection...');
    const { S3Client, ListBucketsCommand } = require('@aws-sdk/client-s3');
    
    const s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
    
    try {
      const listBucketsResponse = await s3Client.send(new ListBucketsCommand({}));
      console.log('✅ S3 connection successful!');
      console.log('Available buckets:', listBucketsResponse.Buckets.map(b => b.Name));
    } catch (s3Error) {
      console.log('❌ S3 connection failed:', s3Error.message);
    }
    
  } catch (error) {
    if (error.response) {
      console.log('❌ API Error:', error.response.status, error.response.data);
    } else {
      console.log('❌ Error:', error.message);
    }
  }
}

testBackendAndS3();