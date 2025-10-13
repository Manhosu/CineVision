require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function cleanAllDuplicates() {
  console.log('🎬 Iniciando limpeza completa de duplicatas...\n');

  try {
    // 1. BUSCAR TODOS OS FILMES
    const { data: allMovies, error: fetchError } = await supabase
      .from('content')
      .select('id, title, description, created_at, categories:content_categories(category:categories(name)), video_url')
      .eq('content_type', 'movie')
      .order('title')
      .order('created_at', { ascending: false }); // Mais recentes primeiro

    if (fetchError) {
      console.error('❌ Erro ao buscar filmes:', fetchError.message);
      return;
    }

    console.log(`📊 Total de filmes encontrados: ${allMovies.length}\n`);

    // 2. AGRUPAR POR TÍTULO NORMALIZADO
    const moviesByTitle = {};

    allMovies.forEach(movie => {
      const normalizedTitle = movie.title
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' '); // Normalizar espaços

      if (!moviesByTitle[normalizedTitle]) {
        moviesByTitle[normalizedTitle] = [];
      }
      moviesByTitle[normalizedTitle].push(movie);
    });

    // 3. PROCESSAR DUPLICATAS
    let totalDeleted = 0;

    for (const [title, movies] of Object.entries(moviesByTitle)) {
      if (movies.length <= 1) {
        continue; // Sem duplicatas
      }

      console.log(`\n🔍 Encontradas ${movies.length} versões de: "${movies[0].title}"`);

      // CRITÉRIOS PARA ESCOLHER MELHOR VERSÃO (ordem de prioridade):
      // 1. Tem descrição completa
      // 2. Tem categorias associadas
      // 3. Tem video_url
      // 4. Mais antigo (primeiro cadastrado)

      const scored = movies.map(movie => ({
        movie,
        score:
          (movie.description ? 100 : 0) +
          ((movie.categories?.length || 0) * 10) +
          (movie.video_url ? 50 : 0)
      }));

      // Ordenar por score (maior primeiro), depois por data (mais antigo primeiro)
      scored.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return new Date(a.movie.created_at) - new Date(b.movie.created_at);
      });

      const keepMovie = scored[0].movie;
      const deleteMovies = scored.slice(1).map(s => s.movie);

      console.log(`   ✅ MANTER: ID ${keepMovie.id.slice(0, 8)}... (score: ${scored[0].score})`);
      console.log(`      - Descrição: ${keepMovie.description ? '✅' : '❌'}`);
      console.log(`      - Categorias: ${keepMovie.categories?.length || 0}`);
      console.log(`      - Vídeo: ${keepMovie.video_url ? '✅' : '❌'}`);
      console.log(`      - Criado: ${new Date(keepMovie.created_at).toLocaleDateString()}`);

      for (const deleteMovie of deleteMovies) {
        console.log(`   ❌ DELETAR: ID ${deleteMovie.id.slice(0, 8)}... (score: ${scored.find(s => s.movie.id === deleteMovie.id).score})`);

        const { error: deleteError } = await supabase
          .from('content')
          .delete()
          .eq('id', deleteMovie.id);

        if (deleteError) {
          console.error(`      ⚠️  Erro ao deletar:`, deleteError.message);
        } else {
          console.log(`      ✅ Deletado com sucesso`);
          totalDeleted++;
        }
      }
    }

    // 4. VERIFICAR RESULTADO FINAL
    console.log('\n\n📋 Resultado Final:\n');

    const { data: finalMovies, error: finalError } = await supabase
      .from('content')
      .select('id, title, price_cents')
      .eq('content_type', 'movie')
      .order('title');

    if (finalError) {
      console.error('❌ Erro ao listar filmes finais:', finalError.message);
      return;
    }

    console.log(`✅ Total de filmes após limpeza: ${finalMovies.length}`);
    console.log(`🗑️  Total de duplicatas removidas: ${totalDeleted}\n`);

    console.log('📊 Lista Final de Filmes:\n');
    finalMovies.forEach((movie, index) => {
      const priceFormatted = (movie.price_cents / 100).toFixed(2);
      console.log(`${index + 1}. "${movie.title}" - R$ ${priceFormatted}`);
    });

    console.log('\n✅ Limpeza concluída com sucesso!\n');

  } catch (error) {
    console.error('❌ Erro durante a limpeza:', error);
    throw error;
  }
}

// Executar script
cleanAllDuplicates()
  .then(() => {
    console.log('🎉 Script finalizado!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script falhou:', error);
    process.exit(1);
  });
