const { createClient } = require('@supabase/supabase-js');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const s3Client = new S3Client({
  region: 'us-east-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

async function auditDatabase() {
  console.log('🔍 AUDITORIA DO BANCO DE DADOS\n');
  console.log('='.repeat(70) + '\n');

  // Buscar os filmes corretos
  const contentIds = [
    'c7ed9623-7bcb-4c13-91b7-6f96b76facd1', // Lilo & Stitch
    'da5a57f3-a4d8-41d7-bffd-3f46042b55ea', // A Hora do Mal
  ];

  const issues = [];

  for (const contentId of contentIds) {
    const { data: content, error: contentError } = await supabase
      .from('content')
      .select('id, title, price_cents, availability, processing_status')
      .eq('id', contentId)
      .single();

    if (contentError) {
      console.log('❌ Erro ao buscar content:', contentError.message);
      continue;
    }

    console.log('🎬', content.title);
    console.log('   ID:', content.id);
    console.log('   Price:', (content.price_cents / 100).toFixed(2), 'BRL');
    console.log('   Availability:', content.availability);
    console.log('   Processing:', content.processing_status);

    const { data: languages, error: langError } = await supabase
      .from('content_languages')
      .select('*')
      .eq('content_id', contentId);

    if (langError) {
      console.log('   ❌ Erro ao buscar languages:', langError.message);
      continue;
    }

    console.log('   Languages:', languages.length);
    console.log();

    for (const lang of languages) {
      console.log('   📝', lang.language_type, '-', lang.language_code);
      console.log('      ID:', lang.id);
      console.log('      Active:', lang.is_active ? '✅' : '❌');
      console.log('      Default:', lang.is_default ? '✅' : '❌');

      // Verificar video_url
      if (lang.video_url) {
        console.log('      video_url: ✅', lang.video_url.substring(0, 50) + '...');
      } else {
        console.log('      video_url: ❌ NULL');
        issues.push({
          content: content.title,
          language: lang.language_type,
          issue: 'video_url is NULL',
        });
      }

      // Verificar video_storage_key
      if (lang.video_storage_key) {
        console.log('      storage_key: ✅', lang.video_storage_key.substring(0, 50) + '...');

        // Extrair content_id do storage_key
        const match = lang.video_storage_key.match(/videos\/([^\/]+)\//);
        if (match) {
          const storageContentId = match[1];
          if (storageContentId !== contentId) {
            console.log('      ⚠️  MISMATCH: storage_key usa content_id diferente!');
            console.log('         DB content_id:', contentId);
            console.log('         Storage content_id:', storageContentId);
            issues.push({
              content: content.title,
              language: lang.language_type,
              issue: 'content_id mismatch between DB and S3 path',
              dbContentId: contentId,
              storageContentId: storageContentId,
            });
          } else {
            console.log('      ✅ Content ID matches');
          }
        }

        // Testar se o arquivo existe no S3 e gerar presigned URL
        try {
          const cmd = new GetObjectCommand({
            Bucket: 'cinevision-video',
            Key: lang.video_storage_key,
          });

          const presignedUrl = await getSignedUrl(s3Client, cmd, { expiresIn: 14400 });
          const response = await fetch(presignedUrl, {
            method: 'GET',
            headers: { 'Range': 'bytes=0-1023' },
          });

          if (response.status === 206 || response.status === 200) {
            console.log('      ✅ S3 file exists and accessible');
          } else {
            console.log('      ❌ S3 file not accessible:', response.status);
            issues.push({
              content: content.title,
              language: lang.language_type,
              issue: 'S3 file not accessible',
              status: response.status,
            });
          }
        } catch (error) {
          console.log('      ❌ S3 error:', error.message);
          issues.push({
            content: content.title,
            language: lang.language_type,
            issue: 'S3 error: ' + error.message,
          });
        }
      } else {
        console.log('      storage_key: ❌ NULL');
        issues.push({
          content: content.title,
          language: lang.language_type,
          issue: 'video_storage_key is NULL',
        });
      }

      console.log();
    }

    console.log();
  }

  console.log('='.repeat(70));
  console.log('\n📊 RESUMO DA AUDITORIA:\n');

  if (issues.length === 0) {
    console.log('✅ Nenhum problema encontrado! Todos os dados estão corretos.\n');
  } else {
    console.log('❌ Problemas encontrados:', issues.length, '\n');
    issues.forEach((issue, index) => {
      console.log(`${index + 1}. ${issue.content} - ${issue.language}`);
      console.log('   Issue:', issue.issue);
      if (issue.dbContentId) {
        console.log('   DB Content ID:', issue.dbContentId);
        console.log('   Storage Content ID:', issue.storageContentId);
      }
      console.log();
    });
  }

  return issues;
}

auditDatabase().catch(console.error);
