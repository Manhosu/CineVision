require('dotenv').config();
const { STSClient, GetCallerIdentityCommand } = require('@aws-sdk/client-sts');
const { S3Client, ListBucketsCommand, GetBucketLocationCommand } = require('@aws-sdk/client-s3');

console.log('🔍 VERIFICAÇÃO: Identidade AWS e Permissões\n');
console.log('='.repeat(70));

async function verifyIdentity() {
  const stsClient = new STSClient({
    region: 'us-east-2',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });

  const s3Client = new S3Client({
    region: 'us-east-2',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });

  // TESTE 1: Verificar identidade
  console.log('\n📊 TESTE 1: Identificação do usuário AWS');
  try {
    const identity = await stsClient.send(new GetCallerIdentityCommand({}));

    console.log('   ✅ Identidade recuperada:');
    console.log(`   • Account: ${identity.Account}`);
    console.log(`   • User ID: ${identity.UserId}`);
    console.log(`   • ARN: ${identity.Arn}`);

    // Verificar se é usuário IAM ou role assumida
    if (identity.Arn.includes(':assumed-role/')) {
      console.log('   ⚠️  Esta é uma ROLE ASSUMIDA (não é usuário IAM direto)');
      console.log('   → Roles podem ter políticas de sessão que bloqueiam presigned URLs');
    } else if (identity.Arn.includes(':user/')) {
      console.log('   ✅ Este é um USUÁRIO IAM direto');
    }
  } catch (error) {
    console.log(`   ❌ Erro ao obter identidade: ${error.message}`);
    if (error.name === 'ExpiredToken') {
      console.log('   → Token de sessão expirado!');
    }
  }

  // TESTE 2: Listar buckets
  console.log('\n📊 TESTE 2: Permissão para listar buckets');
  try {
    const buckets = await s3Client.send(new ListBucketsCommand({}));
    console.log(`   ✅ Consegue listar ${buckets.Buckets.length} buckets`);

    const cinevisionBucket = buckets.Buckets.find(b => b.Name === 'cinevision-video');
    if (cinevisionBucket) {
      console.log(`   ✅ Bucket 'cinevision-video' encontrado`);
      console.log(`   • Criado em: ${cinevisionBucket.CreationDate}`);
    } else {
      console.log(`   ⚠️  Bucket 'cinevision-video' NÃO encontrado na lista`);
      console.log('   → Pode indicar problema de permissão ou região');
    }
  } catch (error) {
    console.log(`   ❌ Erro: ${error.message}`);
  }

  // TESTE 3: Verificar localização do bucket
  console.log('\n📊 TESTE 3: Localização do bucket cinevision-video');
  try {
    const location = await s3Client.send(new GetBucketLocationCommand({
      Bucket: 'cinevision-video',
    }));

    const bucketRegion = location.LocationConstraint || 'us-east-1';
    console.log(`   ✅ Região do bucket: ${bucketRegion}`);

    if (bucketRegion !== 'us-east-2') {
      console.log(`   ⚠️  ATENÇÃO: Bucket está em ${bucketRegion} mas estamos usando us-east-2`);
      console.log('   → Isso pode causar problemas com presigned URLs');
    } else {
      console.log(`   ✅ Região correta (us-east-2)`);
    }
  } catch (error) {
    console.log(`   ❌ Erro: ${error.message}`);
  }

  // TESTE 4: Verificar se há session token
  console.log('\n📊 TESTE 4: Verificar tipo de credencial');
  console.log(`   • AWS_ACCESS_KEY_ID: ${process.env.AWS_ACCESS_KEY_ID}`);
  console.log(`   • AWS_SECRET_ACCESS_KEY: ${process.env.AWS_SECRET_ACCESS_KEY ? '[SET]' : '[NOT SET]'}`);
  console.log(`   • AWS_SESSION_TOKEN: ${process.env.AWS_SESSION_TOKEN ? '[SET - usando credenciais temporárias]' : '[NOT SET - usando credenciais permanentes]'}`);

  if (process.env.AWS_SESSION_TOKEN) {
    console.log('');
    console.log('   ⚠️  ATENÇÃO: Session tokens (credenciais temporárias) podem não funcionar com presigned URLs!');
    console.log('   → Presigned URLs requerem credenciais PERMANENTES de usuário IAM');
    console.log('   → Session tokens expiram e invalidam as presigned URLs');
  } else {
    console.log('');
    console.log('   ✅ Usando credenciais permanentes (sem session token)');
  }

  console.log('\n' + '='.repeat(70));
  console.log('\n💡 PRÓXIMOS PASSOS:\n');
  console.log('Se o problema persistir com todas as configurações corretas:');
  console.log('   1. Verificar se há AWS Organizations SCPs bloqueando');
  console.log('   2. Verificar se há VPC Endpoint policies');
  console.log('   3. Tentar gerar presigned URL com outro usuário IAM');
  console.log('   4. Contatar suporte AWS para verificar logs do CloudTrail');
  console.log('\n' + '='.repeat(70) + '\n');
}

verifyIdentity().catch(console.error);
