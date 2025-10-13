require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// IDs DOS FILMES DUPLICADOS PARA DELETAR
const DUPLICATE_IDS_TO_DELETE = [
  '92f208c7-b480-47d2-bef1-b6b0da9e27d2', // A Hora do Mal (duplicata com dados incompletos)
  '92dff8b7-7ae0-4864-937b-5d21f71d9002', // Lilo & Stitch (duplicata sem informações)
  '4b0b1b46-8571-44c9-8df8-7c70edbc84e1'  // Quarteto Fantástico (duplicata sem informações)
];

// CORREÇÃO DO POSTER URL DO QUARTETO FANTÁSTICO
const POSTER_URL_FIX = {
  movieId: 'f1465fe2-8b04-4522-8c97-56b725270312',
  correctUrl: 'https://cinevision-cover.s3.us-east-1.amazonaws.com/posters/quarteto-fantastico-primeiros-passos-2025.png'
};

async function fixDuplicateMovies() {
  console.log('🎬 Iniciando correção de duplicatas e erros...\n');

  try {
    // 1. DELETAR FILMES DUPLICADOS
    console.log('📋 Etapa 1: Deletando filmes duplicados...');

    for (const movieId of DUPLICATE_IDS_TO_DELETE) {
      const { data: movie, error: fetchError } = await supabase
        .from('content')
        .select('title')
        .eq('id', movieId)
        .single();

      if (fetchError) {
        console.log(`  ⚠️  Filme ${movieId} não encontrado (pode já ter sido deletado)`);
        continue;
      }

      const { error: deleteError } = await supabase
        .from('content')
        .delete()
        .eq('id', movieId);

      if (deleteError) {
        console.error(`  ❌ Erro ao deletar "${movie.title}":`, deleteError.message);
      } else {
        console.log(`  ✅ Deletado: "${movie.title}" (ID: ${movieId})`);
      }
    }

    console.log('\n📋 Etapa 2: Corrigindo URL do poster do Quarteto Fantástico...');

    const { data: updatedMovie, error: updateError } = await supabase
      .from('content')
      .update({
        poster_url: POSTER_URL_FIX.correctUrl,
        thumbnail_url: POSTER_URL_FIX.correctUrl
      })
      .eq('id', POSTER_URL_FIX.movieId)
      .select('title')
      .single();

    if (updateError) {
      console.error(`  ❌ Erro ao atualizar poster:`, updateError.message);
    } else {
      console.log(`  ✅ Poster atualizado: "${updatedMovie.title}"`);
      console.log(`     Nova URL: ${POSTER_URL_FIX.correctUrl}`);
    }

    // 3. VERIFICAR RESULTADO FINAL
    console.log('\n📋 Etapa 3: Verificando resultado final...');

    const { data: allMovies, error: listError } = await supabase
      .from('content')
      .select('id, title, description, price_cents, categories:content_categories(category:categories(name))')
      .eq('content_type', 'movie')
      .order('title');

    if (listError) {
      console.error('❌ Erro ao listar filmes:', listError.message);
      return;
    }

    console.log(`\n✅ Total de filmes no banco: ${allMovies.length}\n`);
    console.log('📊 Lista de filmes após limpeza:\n');

    allMovies.forEach((movie, index) => {
      const priceFormatted = (movie.price_cents / 100).toFixed(2);
      const hasDescription = movie.description ? '✅' : '❌';
      const categoryCount = movie.categories?.length || 0;

      console.log(`${index + 1}. "${movie.title}"`);
      console.log(`   💰 Preço: R$ ${priceFormatted}`);
      console.log(`   📝 Descrição: ${hasDescription}`);
      console.log(`   🏷️  Categorias: ${categoryCount}`);
      console.log('');
    });

    // 4. VERIFICAR SE AINDA EXISTEM DUPLICATAS
    console.log('🔍 Verificando se ainda existem duplicatas...\n');

    const titleCounts = {};
    allMovies.forEach(movie => {
      const normalizedTitle = movie.title.toLowerCase().trim();
      titleCounts[normalizedTitle] = (titleCounts[normalizedTitle] || 0) + 1;
    });

    const duplicates = Object.entries(titleCounts).filter(([_, count]) => count > 1);

    if (duplicates.length === 0) {
      console.log('✅ Nenhuma duplicata encontrada!\n');
    } else {
      console.log('⚠️  ATENÇÃO: Ainda existem duplicatas:\n');
      duplicates.forEach(([title, count]) => {
        console.log(`   - "${title}": ${count} registros`);
      });
      console.log('');
    }

    console.log('✅ Correção concluída com sucesso!\n');

  } catch (error) {
    console.error('❌ Erro durante a correção:', error);
    throw error;
  }
}

// Executar script
fixDuplicateMovies()
  .then(() => {
    console.log('🎉 Script finalizado!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script falhou:', error);
    process.exit(1);
  });
