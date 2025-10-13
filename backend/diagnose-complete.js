require('dotenv').config();
const { S3Client, GetObjectCommand, PutObjectCommand, GetObjectAclCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const s3Client = new S3Client({
  region: 'us-east-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

async function diagnoseComplete() {
  console.log('🔍 DIAGNÓSTICO COMPLETO - PRESIGNED URLs\n');
  console.log('='.repeat(70));
  console.log('\n📋 CONTEXTO DO PROBLEMA:\n');
  console.log('   ✅ Acesso direto via SDK funciona (HeadObject retorna 200)');
  console.log('   ❌ Presigned URLs retornam 403 Forbidden');
  console.log('   ✅ Block Public Access: TODAS as 4 opções DESMARCADAS');
  console.log('   ✅ ACLs habilitadas com "Bucket owner preferred"');
  console.log('   ✅ Credenciais: cinevision-uploader (AKIA5JDWE3OIGYJLP7VL)');
  console.log('   ✅ Bucket: cinevision-video (us-east-2)');
  console.log('\n' + '='.repeat(70));

  // TESTE 1: Criar arquivo PEQUENO e testar
  console.log('\n\n📊 TESTE 1: Criar arquivo PEQUENO (1KB) e testar presigned URL\n');

  const smallKey = `test-diagnose/small-${Date.now()}.txt`;
  console.log(`   📝 Criando arquivo: ${smallKey}`);

  try {
    await s3Client.send(new PutObjectCommand({
      Bucket: 'cinevision-video',
      Key: smallKey,
      Body: 'A'.repeat(1024), // 1KB
      ContentType: 'text/plain',
    }));
    console.log('   ✅ Arquivo criado com sucesso');

    // Testar presigned URL imediatamente
    const getCmd = new GetObjectCommand({
      Bucket: 'cinevision-video',
      Key: smallKey,
    });

    const presignedUrl = await getSignedUrl(s3Client, getCmd, { expiresIn: 3600 });
    console.log('   ✅ Presigned URL gerada');

    const response = await fetch(presignedUrl, { method: 'HEAD' });
    console.log(`\n   📡 Resposta HTTP: ${response.status}`);

    if (response.status === 200) {
      console.log('   ✅ PRESIGNED URL FUNCIONOU!');
    } else {
      console.log('   ❌ PRESIGNED URL FALHOU');
      const body = await response.text();
      console.log(`   📄 Corpo da resposta: ${body.substring(0, 300)}`);
    }
  } catch (error) {
    console.log(`   ❌ Erro: ${error.message}`);
  }

  // TESTE 2: Verificar ACL de um vídeo existente
  console.log('\n\n📊 TESTE 2: Verificar ACL de vídeo existente\n');

  const videoKey = 'videos/c7ed9623-7bcb-4c13-91b7-6f96b76facd1/languages/dubbed-pt-BR/1760228827742-Lilo-Stitch-2025-DUBLADO.mp4';
  console.log(`   📝 Verificando: ${videoKey.substring(0, 60)}...`);

  try {
    const aclCmd = new GetObjectAclCommand({
      Bucket: 'cinevision-video',
      Key: videoKey,
    });

    const aclResult = await s3Client.send(aclCmd);
    console.log('   ✅ ACL recuperada com sucesso');
    console.log(`   👤 Owner: ${aclResult.Owner.DisplayName || aclResult.Owner.ID.substring(0, 20)}`);
    console.log(`   🔐 Grants (${aclResult.Grants.length}):`);

    aclResult.Grants.forEach((grant, i) => {
      const grantee = grant.Grantee.Type === 'CanonicalUser'
        ? `CanonicalUser (${grant.Grantee.ID?.substring(0, 20)}...)`
        : grant.Grantee.URI || grant.Grantee.Type;
      console.log(`      ${i + 1}. ${grantee} → ${grant.Permission}`);
    });
  } catch (error) {
    console.log(`   ❌ Erro ao recuperar ACL: ${error.message}`);
    if (error.name === 'AccessDenied') {
      console.log('   ⚠️  User cinevision-uploader não tem permissão s3:GetObjectAcl');
    }
  }

  // TESTE 3: Analisar a estrutura da presigned URL
  console.log('\n\n📊 TESTE 3: Analisar estrutura da presigned URL\n');

  const getCmd = new GetObjectCommand({
    Bucket: 'cinevision-video',
    Key: videoKey,
  });

  const presignedUrl = await getSignedUrl(s3Client, getCmd, { expiresIn: 3600 });

  console.log('   🔗 Presigned URL gerada:');
  console.log(`   ${presignedUrl.substring(0, 100)}...`);
  console.log('');

  const url = new URL(presignedUrl);
  console.log('   📋 Parâmetros da URL:');
  console.log(`      • Host: ${url.hostname}`);
  console.log(`      • X-Amz-Algorithm: ${url.searchParams.get('X-Amz-Algorithm')}`);
  console.log(`      • X-Amz-Credential: ${url.searchParams.get('X-Amz-Credential')?.substring(0, 40)}...`);
  console.log(`      • X-Amz-Date: ${url.searchParams.get('X-Amz-Date')}`);
  console.log(`      • X-Amz-Expires: ${url.searchParams.get('X-Amz-Expires')} segundos`);
  console.log(`      • X-Amz-SignedHeaders: ${url.searchParams.get('X-Amz-SignedHeaders')}`);
  console.log(`      • X-Amz-Signature: ${url.searchParams.get('X-Amz-Signature')?.substring(0, 20)}...`);

  // TESTE 4: Comparar URLs com diferentes tempos de expiração
  console.log('\n\n📊 TESTE 4: Testar diferentes tempos de expiração\n');

  const expirationTimes = [60, 900, 3600, 14400]; // 1min, 15min, 1h, 4h

  for (const expTime of expirationTimes) {
    const cmd = new GetObjectCommand({
      Bucket: 'cinevision-video',
      Key: videoKey,
    });

    const url = await getSignedUrl(s3Client, cmd, { expiresIn: expTime });
    const response = await fetch(url, { method: 'HEAD' });

    const hours = Math.floor(expTime / 3600);
    const minutes = Math.floor((expTime % 3600) / 60);
    const timeStr = hours > 0 ? `${hours}h` : `${minutes}min`;

    console.log(`   ${response.status === 200 ? '✅' : '❌'} ${timeStr.padEnd(6)} → Status ${response.status}`);
  }

  // TESTE 5: Verificar se o problema é com vídeos grandes
  console.log('\n\n📊 TESTE 5: Testar arquivo MÉDIO (10MB)\n');

  const mediumKey = `test-diagnose/medium-${Date.now()}.bin`;
  console.log(`   📝 Criando arquivo de 10MB: ${mediumKey}`);

  try {
    const buffer = Buffer.alloc(10 * 1024 * 1024); // 10MB
    await s3Client.send(new PutObjectCommand({
      Bucket: 'cinevision-video',
      Key: mediumKey,
      Body: buffer,
      ContentType: 'application/octet-stream',
    }));
    console.log('   ✅ Arquivo de 10MB criado');

    const getCmd = new GetObjectCommand({
      Bucket: 'cinevision-video',
      Key: mediumKey,
    });

    const url = await getSignedUrl(s3Client, getCmd, { expiresIn: 3600 });
    const response = await fetch(url, { method: 'HEAD' });

    console.log(`   📡 Status: ${response.status}`);
    if (response.status === 200) {
      console.log('   ✅ Arquivo 10MB: FUNCIONOU');
    } else {
      console.log('   ❌ Arquivo 10MB: FALHOU');
    }
  } catch (error) {
    console.log(`   ❌ Erro: ${error.message}`);
  }

  // RESUMO FINAL
  console.log('\n\n' + '='.repeat(70));
  console.log('\n💡 ANÁLISE DOS RESULTADOS:\n');
  console.log('Se arquivos NOVOS funcionam mas vídeos ANTIGOS não:');
  console.log('   → Os vídeos foram criados com ACL incorreta');
  console.log('   → Solução: Re-upload dos vídeos');
  console.log('');
  console.log('Se NENHUM arquivo funciona (nem novos):');
  console.log('   → Há uma política de bucket bloqueando presigned URLs');
  console.log('   → Ou configuração de CORS/VPC endpoint');
  console.log('');
  console.log('Se TODOS os arquivos funcionam:');
  console.log('   → Era problema de propagação (resolvido!)');
  console.log('\n' + '='.repeat(70) + '\n');
}

diagnoseComplete().catch(console.error);
