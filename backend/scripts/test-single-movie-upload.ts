/**
 * Test Script: Upload Single Movie (Superman)
 *
 * Este script testa o upload de um único filme antes de executar o upload em massa.
 * Use para validar que tudo está funcionando corretamente.
 */

import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';

// Load environment variables
config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const VIDEO_BUCKET = process.env.S3_VIDEO_BUCKET || 'cinevision-storage';
const COVERS_BUCKET = process.env.S3_COVERS_BUCKET || 'cinevision-capas';

async function testSupabaseConnection() {
  console.log('🔍 Testando conexão com Supabase...');
  try {
    const { data, error } = await supabase
      .from('content')
      .select('count')
      .limit(1);

    if (error) throw error;
    console.log('✅ Conexão com Supabase OK');
    return true;
  } catch (error) {
    console.error('❌ Erro ao conectar com Supabase:', error.message);
    return false;
  }
}

async function testS3Connection() {
  console.log('🔍 Testando conexão com S3...');
  try {
    // Try to put a small test object
    const testKey = `test-${Date.now()}.txt`;
    const command = new PutObjectCommand({
      Bucket: VIDEO_BUCKET,
      Key: testKey,
      Body: Buffer.from('test'),
    });

    await s3Client.send(command);
    console.log('✅ Conexão com S3 OK');
    console.log(`   Bucket: ${VIDEO_BUCKET}`);
    return true;
  } catch (error) {
    console.error('❌ Erro ao conectar com S3:', error.message);
    console.error('   Verifique suas credenciais AWS no .env');
    return false;
  }
}

async function checkMoviesFolder() {
  console.log('🔍 Verificando pasta de filmes...');
  const MOVIES_DIR = 'E:/movies';

  if (!fs.existsSync(MOVIES_DIR)) {
    console.error(`❌ Pasta não encontrada: ${MOVIES_DIR}`);
    return false;
  }

  const supermanFolder = path.join(MOVIES_DIR, 'FILME_ Superman (2025)');
  if (!fs.existsSync(supermanFolder)) {
    console.error(`❌ Pasta do Superman não encontrada: ${supermanFolder}`);
    return false;
  }

  const files = fs.readdirSync(supermanFolder);
  console.log('✅ Pasta encontrada');
  console.log(`   Arquivos: ${files.join(', ')}`);

  return true;
}

async function uploadSmallPoster() {
  console.log('\n📸 Testando upload de poster...');
  const posterPath = 'E:/movies/FILME_ Superman (2025)/POSTER.png';

  if (!fs.existsSync(posterPath)) {
    console.log('⚠️  Poster não encontrado');
    return null;
  }

  try {
    const fileBuffer = fs.readFileSync(posterPath);
    const key = `posters/test-superman-${Date.now()}.png`;

    const command = new PutObjectCommand({
      Bucket: COVERS_BUCKET,
      Key: key,
      Body: fileBuffer,
      ContentType: 'image/png',
    });

    await s3Client.send(command);
    const url = `https://${COVERS_BUCKET}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;
    console.log('✅ Poster enviado com sucesso!');
    console.log(`   URL: ${url}`);
    return url;
  } catch (error) {
    console.error('❌ Erro ao enviar poster:', error.message);
    return null;
  }
}

async function createTestMovieRecord(posterUrl: string | null) {
  console.log('\n📝 Criando registro de teste no banco...');

  try {
    const { data, error } = await supabase
      .from('content')
      .insert({
        title: 'Superman (TESTE)',
        description: 'Filme de teste - Superman 2025',
        release_year: 2025,
        poster_url: posterUrl,
        thumbnail_url: posterUrl,
        backdrop_url: posterUrl,
        price_cents: 1500,
        content_type: 'movie',
        status: 'PUBLISHED',
        is_online: true,
        quality: 'HD',
        format: 'MKV',
        category: 'Ação',
        weekly_sales: 0,
        views_count: 0,
        genres: ['Ação', 'Ficção Científica'],
      })
      .select()
      .single();

    if (error) throw error;

    console.log('✅ Registro criado com sucesso!');
    console.log(`   ID: ${data.id}`);
    console.log(`   Título: ${data.title}`);
    return data.id;
  } catch (error) {
    console.error('❌ Erro ao criar registro:', error.message);
    return null;
  }
}

async function main() {
  console.log('🧪 CineVision - Teste de Upload de Filme\n');
  console.log('='.repeat(60));
  console.log('Este script testa as seguintes funcionalidades:');
  console.log('  1. Conexão com Supabase');
  console.log('  2. Conexão com AWS S3');
  console.log('  3. Acesso à pasta de filmes');
  console.log('  4. Upload de poster');
  console.log('  5. Criação de registro no banco');
  console.log('='.repeat(60) + '\n');

  // Test connections
  const supabaseOk = await testSupabaseConnection();
  if (!supabaseOk) {
    console.log('\n❌ Teste falhou: Verifique configuração do Supabase');
    process.exit(1);
  }

  const s3Ok = await testS3Connection();
  if (!s3Ok) {
    console.log('\n❌ Teste falhou: Verifique configuração do AWS S3');
    process.exit(1);
  }

  const folderOk = await checkMoviesFolder();
  if (!folderOk) {
    console.log('\n❌ Teste falhou: Verifique pasta de filmes');
    process.exit(1);
  }

  // Upload poster
  const posterUrl = await uploadSmallPoster();

  // Create test record
  const contentId = await createTestMovieRecord(posterUrl);

  console.log('\n' + '='.repeat(60));
  if (contentId) {
    console.log('✅ TESTE BEM-SUCEDIDO!');
    console.log('\nVocê pode prosseguir com o upload completo executando:');
    console.log('  npx tsx scripts/bulk-upload-movies.ts');
    console.log('\nPara limpar o registro de teste, execute:');
    console.log(`  DELETE FROM content WHERE id = '${contentId}';`);
  } else {
    console.log('❌ TESTE FALHOU');
    console.log('Verifique os erros acima antes de prosseguir.');
  }
  console.log('='.repeat(60));
}

main().catch(console.error);
