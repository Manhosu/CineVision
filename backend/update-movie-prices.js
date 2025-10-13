require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Preços padrão conforme definido anteriormente
const DEFAULT_MOVIE_PRICE = 1990; // R$ 19,90 em centavos

async function updateMoviePrices() {
  try {
    console.log('🎬 Atualizando preços dos filmes...\n');

    // Buscar todos os filmes
    const { data: movies, error: fetchError } = await supabase
      .from('content')
      .select('id, title, price_cents')
      .eq('content_type', 'movie');

    if (fetchError) {
      throw fetchError;
    }

    console.log(`📊 Encontrados ${movies.length} filmes\n`);

    // Atualizar preços dos filmes que estão em 0
    let updated = 0;
    for (const movie of movies) {
      if (movie.price_cents === 0 || movie.price_cents === null) {
        const { error: updateError } = await supabase
          .from('content')
          .update({
            price_cents: DEFAULT_MOVIE_PRICE,
            updated_at: new Date().toISOString()
          })
          .eq('id', movie.id);

        if (updateError) {
          console.error(`❌ Erro ao atualizar ${movie.title}:`, updateError.message);
        } else {
          console.log(`✅ ${movie.title} - Preço atualizado para R$ ${(DEFAULT_MOVIE_PRICE / 100).toFixed(2)}`);
          updated++;
        }
      } else {
        console.log(`⏭️  ${movie.title} - Já tem preço: R$ ${(movie.price_cents / 100).toFixed(2)}`);
      }
    }

    console.log(`\n🎉 Concluído! ${updated} filmes atualizados.`);

  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

updateMoviePrices();
