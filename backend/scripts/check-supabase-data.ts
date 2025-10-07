import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSupabaseData() {
  console.log('🔍 Verificando dados no Supabase...\n');

  try {
    // Check content table
    console.log('📊 Verificando tabela content:');
    const { data: contentData, error: contentError } = await supabase
      .from('content')
      .select('*')
      .limit(10);

    if (contentError) {
      console.error('❌ Erro ao buscar dados da tabela content:', contentError);
    } else {
      console.log(`✅ Encontrados ${contentData?.length || 0} registros na tabela content`);
      if (contentData && contentData.length > 0) {
        console.log('📋 Primeiros registros:');
        contentData.forEach((item, index) => {
          console.log(`  ${index + 1}. ${item.title} (${item.content_type || item.type}) - Status: ${item.status}`);
        });
      }
    }

    console.log('\n📊 Verificando filmes especificamente:');
    const { data: moviesData, error: moviesError } = await supabase
      .from('content')
      .select('*')
      .eq('content_type', 'movie')
      .limit(10);

    if (moviesError) {
      console.error('❌ Erro ao buscar filmes:', moviesError);
    } else {
      console.log(`✅ Encontrados ${moviesData?.length || 0} filmes`);
      if (moviesData && moviesData.length > 0) {
        moviesData.forEach((movie, index) => {
          console.log(`  ${index + 1}. ${movie.title} - Poster: ${movie.poster_url ? 'Sim' : 'Não'}`);
        });
      }
    }

    console.log('\n📊 Verificando séries especificamente:');
    const { data: seriesData, error: seriesError } = await supabase
      .from('content')
      .select('*')
      .eq('content_type', 'series')
      .limit(10);

    if (seriesError) {
      console.error('❌ Erro ao buscar séries:', seriesError);
    } else {
      console.log(`✅ Encontradas ${seriesData?.length || 0} séries`);
    }

    // Check storage buckets
    console.log('\n📦 Verificando buckets de storage:');
    const { data: bucketsData, error: bucketsError } = await supabase.storage.listBuckets();

    if (bucketsError) {
      console.error('❌ Erro ao listar buckets:', bucketsError);
    } else {
      console.log(`✅ Encontrados ${bucketsData?.length || 0} buckets:`);
      bucketsData?.forEach(bucket => {
        console.log(`  - ${bucket.name} (${bucket.public ? 'público' : 'privado'})`);
      });
    }

    // Check movies bucket specifically
    if (bucketsData?.some(b => b.name === 'movies')) {
      console.log('\n🎬 Verificando arquivos no bucket movies:');
      const { data: filesData, error: filesError } = await supabase.storage
        .from('movies')
        .list('', { limit: 10 });

      if (filesError) {
        console.error('❌ Erro ao listar arquivos:', filesError);
      } else {
        console.log(`✅ Encontrados ${filesData?.length || 0} arquivos no bucket movies`);
        filesData?.forEach(file => {
          console.log(`  - ${file.name} (${(file.metadata?.size || 0) / 1024 / 1024} MB)`);
        });
      }
    }

  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

// Run the check
checkSupabaseData().catch(console.error);