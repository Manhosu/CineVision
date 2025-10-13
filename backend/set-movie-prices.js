require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// PREÇOS OFICIAIS DOS FILMES - NÃO ALTERAR SEM AUTORIZAÇÃO
const MOVIE_PRICES = {
  'Quarteto Fantástico: Primeiros Passos': 690,  // R$ 6,90
  'Quarteto Fantástico 4 - Primeiros Passos': 690,  // R$ 6,90
  'Invocação do Mal 4: O Último Ritual': 720,    // R$ 7,20
  'Demon Slayer: Castelo Infinito': 750,         // R$ 7,50
  'Demon Slayer - Castelo Infinito': 750,        // R$ 7,50
  'A Longa Marcha: Caminhe ou Morra': 700,       // R$ 7,00
  'A Longa Marcha - Caminhe ou Morra': 700,      // R$ 7,00
  'Superman': 710,                                // R$ 7,10
  'Superman (2025)': 710,                         // R$ 7,10
  'Como Treinar o Seu Dragão': 698,              // R$ 6,98
  'Jurassic World: Recomeço': 685,               // R$ 6,85
  'F1: O Filme': 705,                            // R$ 7,05
  'F1 - O Filme': 705,                           // R$ 7,05
  'Lilo & Stitch': 698,                          // R$ 6,98
  'A Hora do Mal': 695,                          // R$ 6,95
};

async function setMoviePrices() {
  try {
    console.log('🎬 Definindo preços oficiais dos filmes...\n');
    console.log('⚠️  ATENÇÃO: Preços definidos pelo proprietário do sistema\n');

    // Buscar todos os filmes
    const { data: movies, error: fetchError } = await supabase
      .from('content')
      .select('id, title, price_cents')
      .eq('content_type', 'movie');

    if (fetchError) {
      throw fetchError;
    }

    console.log(`📊 Encontrados ${movies.length} filmes\n`);

    let updated = 0;
    let notFound = [];

    for (const movie of movies) {
      // Procurar preço exato ou variações do título
      let priceToSet = null;

      for (const [titleVariant, price] of Object.entries(MOVIE_PRICES)) {
        if (movie.title.includes(titleVariant) || titleVariant.includes(movie.title)) {
          priceToSet = price;
          break;
        }
      }

      if (priceToSet) {
        const { error: updateError } = await supabase
          .from('content')
          .update({
            price_cents: priceToSet,
            updated_at: new Date().toISOString()
          })
          .eq('id', movie.id);

        if (updateError) {
          console.error(`❌ Erro ao atualizar ${movie.title}:`, updateError.message);
        } else {
          console.log(`✅ ${movie.title} - Preço definido: R$ ${(priceToSet / 100).toFixed(2)}`);
          updated++;
        }
      } else {
        notFound.push(movie.title);
        console.log(`⏭️  ${movie.title} - Preço não definido na lista oficial`);
      }
    }

    console.log(`\n📋 Resumo:`);
    console.log(`✅ ${updated} filmes com preços atualizados`);

    if (notFound.length > 0) {
      console.log(`\n⚠️  Filmes sem preço definido (${notFound.length}):`);
      notFound.forEach(title => console.log(`   - ${title}`));
    }

    console.log('\n🎉 Processo concluído!');

  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

setMoviePrices();
