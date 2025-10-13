const { S3Client, CopyObjectCommand, DeleteObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const s3Client = new S3Client({
  region: 'us-east-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const correctContentId = 'da5a57f3-a4d8-41d7-bffd-3f46042b55ea';
const wrongContentId = 'f8e60daf-1e94-43b4-b9fe-c6f96c8f5a9c';

const files = [
  {
    oldKey: `videos/${wrongContentId}/languages/dubbed-pt-BR/1760228833502-Monster-2025-DUBLADO.mp4`,
    newKey: `videos/${correctContentId}/languages/dubbed-pt-BR/1760228833502-Monster-2025-DUBLADO.mp4`,
    languageId: 'aeb48abb-d62e-4811-ac3c-8fb766f7fb1b',
  },
  {
    oldKey: `videos/${wrongContentId}/languages/subtitled-pt-BR/1760228833502-Monster-2025-LEGENDADO.mp4`,
    newKey: `videos/${correctContentId}/languages/subtitled-pt-BR/1760228833502-Monster-2025-LEGENDADO.mp4`,
    languageId: 'b57ef5b4-1eec-4dd2-a978-24612c5c2d37',
  },
];

async function fixPaths() {
  console.log('🔧 CORRIGINDO PATHS DO "A HORA DO MAL"\n');
  console.log('='.repeat(70) + '\n');

  console.log('Content ID correto (DB):', correctContentId);
  console.log('Content ID errado (S3):', wrongContentId);
  console.log();

  for (const file of files) {
    console.log('📁', file.oldKey.split('/').pop());
    console.log('   Old key:', file.oldKey);
    console.log('   New key:', file.newKey);

    try {
      // Verificar se o arquivo antigo existe
      await s3Client.send(new HeadObjectCommand({
        Bucket: 'cinevision-video',
        Key: file.oldKey,
      }));
      console.log('   ✅ Arquivo antigo existe');

      // Copiar para o novo local
      console.log('   📋 Copiando para novo local...');
      await s3Client.send(new CopyObjectCommand({
        Bucket: 'cinevision-video',
        CopySource: `cinevision-video/${file.oldKey}`,
        Key: file.newKey,
        ContentType: 'video/mp4',
        CacheControl: 'max-age=31536000',
      }));
      console.log('   ✅ Copiado');

      // Verificar se a cópia funcionou
      await s3Client.send(new HeadObjectCommand({
        Bucket: 'cinevision-video',
        Key: file.newKey,
      }));
      console.log('   ✅ Novo arquivo verificado');

      // Deletar arquivo antigo
      console.log('   🗑️  Deletando arquivo antigo...');
      await s3Client.send(new DeleteObjectCommand({
        Bucket: 'cinevision-video',
        Key: file.oldKey,
      }));
      console.log('   ✅ Arquivo antigo deletado');

      // Atualizar database
      console.log('   💾 Atualizando database...');
      const { error } = await supabase
        .from('content_languages')
        .update({
          video_storage_key: file.newKey,
          video_url: `https://cinevision-video.s3.us-east-2.amazonaws.com/${file.newKey}`,
        })
        .eq('id', file.languageId);

      if (error) {
        console.log('   ❌ Erro ao atualizar DB:', error.message);
      } else {
        console.log('   ✅ Database atualizado');
      }

    } catch (error) {
      console.log('   ❌ Erro:', error.message);
    }

    console.log();
  }

  console.log('='.repeat(70));
  console.log('\n✅ CORREÇÃO CONCLUÍDA!\n');
  console.log('Executando auditoria final...\n');
}

fixPaths().catch(console.error);
