const fs = require('fs');
const path = require('path');

// Configuration
const API_URL = 'http://localhost:3001';
const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsImtpZCI6IkZ5V2Fzekw4Q2R0YjRERWQiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL3N6Z2h5dm5ibWpscXV6bnhocXVtLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiI2MWNmOGQzNS0yNjkyLTQ1MDctOTc4NC0xNzZhM2ZjMDQ3Y2QiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzYwMDYwNzM0LCJpYXQiOjE3NjAwNTcxMzQsImVtYWlsIjoiZWR1YXJkb2dlbGlzdGFAZ21haWwuY29tIiwicGhvbmUiOiIiLCJhcHBfbWV0YWRhdGEiOnsicHJvdmlkZXIiOiJlbWFpbCIsInByb3ZpZGVycyI6WyJlbWFpbCJdfSwidXNlcl9tZXRhZGF0YSI6eyJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwibmFtZSI6IkVkdWFyZG8gR2VsaXN0YSIsInJvbGUiOiJ1c2VyIn0sInJvbGUiOiJhdXRoZW50aWNhdGVkIiwiYWFsIjoiYWFsMSIsImFtciI6W3sibWV0aG9kIjoicGFzc3dvcmQiLCJ0aW1lc3RhbXAiOjE3NjAwNTA5OTl9XSwic2Vzc2lvbl9pZCI6IjZiNjFjOWI5LThhMTQtNDE1NC1iZThkLTZmZGM0MDdiODY2OSIsImlzX2Fub255bW91cyI6ZmFsc2V9.2PxzZQuYCDGA_7vHrcka5YdTG-7lhs1_T61MR9D4nLg';

// Test file - using a small test video
const TEST_VIDEO_PATH = 'E:/movies/FILME_ Superman (2025)/Superman (2025) - LEGENDADO.mp4';

async function testPresignedUpload() {
  console.log('='.repeat(80));
  console.log('TESTE DE UPLOAD DIRETO PARA S3 VIA URL PRÉ-ASSINADA');
  console.log('='.repeat(80));
  console.log('');

  const startTime = Date.now();

  try {
    // Step 1: Get file info
    const stats = fs.statSync(TEST_VIDEO_PATH);
    const fileSize = stats.size;
    const fileSizeGB = (fileSize / (1024 * 1024 * 1024)).toFixed(2);
    const fileName = path.basename(TEST_VIDEO_PATH);

    console.log(`📁 Arquivo: ${fileName}`);
    console.log(`📦 Tamanho: ${fileSizeGB} GB (${fileSize} bytes)`);
    console.log('');

    // Step 2: Request presigned URL
    console.log('⏳ Solicitando URL pré-assinada...');
    const presignedResponse = await fetch(`${API_URL}/api/v1/admin/upload/presigned-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`
      },
      body: JSON.stringify({
        filename: fileName,
        contentType: 'video/mp4'
      })
    });

    if (!presignedResponse.ok) {
      const error = await presignedResponse.text();
      throw new Error(`Erro ao obter URL pré-assinada: ${error}`);
    }

    const { uploadUrl, fileUrl, key, expiresIn } = await presignedResponse.json();
    console.log('✅ URL pré-assinada obtida com sucesso!');
    console.log(`   - S3 Key: ${key}`);
    console.log(`   - Expira em: ${expiresIn} segundos`);
    console.log('');

    // Step 3: Upload file directly to S3
    console.log('📤 Iniciando upload direto para S3...');
    const fileBuffer = fs.readFileSync(TEST_VIDEO_PATH);

    const uploadStartTime = Date.now();
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      body: fileBuffer,
      headers: {
        'Content-Type': 'video/mp4'
      }
    });

    const uploadEndTime = Date.now();
    const uploadDuration = ((uploadEndTime - uploadStartTime) / 1000).toFixed(2);
    const uploadSpeedMBps = (fileSize / (1024 * 1024) / (uploadDuration)).toFixed(2);

    if (!uploadResponse.ok) {
      throw new Error(`Erro no upload: ${uploadResponse.status} ${uploadResponse.statusText}`);
    }

    console.log('✅ Upload concluído com sucesso!');
    console.log(`   - Tempo: ${uploadDuration} segundos`);
    console.log(`   - Velocidade: ${uploadSpeedMBps} MB/s`);
    console.log(`   - HTTP Status: ${uploadResponse.status}`);
    console.log('');

    // Step 4: Display results
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('='.repeat(80));
    console.log('RESULTADO DO TESTE');
    console.log('='.repeat(80));
    console.log(`✅ Status: SUCESSO`);
    console.log(`📁 Arquivo: ${fileName}`);
    console.log(`📦 Tamanho: ${fileSizeGB} GB`);
    console.log(`⏱️  Tempo Total: ${totalTime} segundos`);
    console.log(`🚀 Velocidade Média: ${uploadSpeedMBps} MB/s`);
    console.log(`🔗 URL do Arquivo: ${fileUrl}`);
    console.log(`🗝️  S3 Key: ${key}`);
    console.log(`📊 HTTP Status: ${uploadResponse.status}`);
    console.log('='.repeat(80));

    // Save report
    const report = {
      success: true,
      file: {
        name: fileName,
        size: fileSize,
        sizeGB: fileSizeGB,
        path: TEST_VIDEO_PATH
      },
      upload: {
        method: 'presigned-url-direct-s3',
        duration: uploadDuration,
        speedMBps: uploadSpeedMBps,
        httpStatus: uploadResponse.status
      },
      urls: {
        fileUrl,
        s3Key: key
      },
      timestamps: {
        started: new Date(startTime).toISOString(),
        completed: new Date().toISOString(),
        totalSeconds: totalTime
      }
    };

    fs.writeFileSync('upload-test-report.json', JSON.stringify(report, null, 2));
    console.log('\n📄 Relatório salvo em: upload-test-report.json');

  } catch (error) {
    console.error('\n❌ ERRO:', error.message);
    process.exit(1);
  }
}

// Run test
testPresignedUpload();
