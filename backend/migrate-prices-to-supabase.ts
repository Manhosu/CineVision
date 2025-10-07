import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Preços atualizados baseados nos filmes encontrados no Supabase
const updatedPrices = [
  { title: 'A Longa Marcha - Caminhe ou Morra', newPrice: 695 }, // R$ 6.95
  { title: 'Superman', newPrice: 710 }, // R$ 7.10
  { title: 'Lilo & Stitch', newPrice: 690 }, // R$ 6.90
  { title: 'A Hora do Mal', newPrice: 695 }, // R$ 6.95
  { title: 'Como Treinar o Seu Dragão', newPrice: 698 }, // R$ 6.98
  { title: 'F1 - O Filme', newPrice: 705 }, // R$ 7.05
  { title: 'Demon Slayer - Castelo Infinito', newPrice: 720 }, // R$ 7.20
  { title: 'Invocação do Mal 4_ O Último Ritual', newPrice: 750 }, // R$ 7.50
  { title: 'Jurassic World_ Recomeço', newPrice: 730 }, // R$ 7.30
  { title: 'Quarteto Fantástico 4 - Primeiros Passos', newPrice: 740 }, // R$ 7.40
];

async function listAllMovies() {
  console.log('🔍 Listando todos os filmes no Supabase para debug...\n');
  
  const { data: movies, error } = await supabase
    .from('content')
    .select('id, title, price_cents')
    .order('title');

  if (error) {
    console.error('❌ Erro ao buscar filmes:', error.message);
    return [];
  }

  console.log(`📋 Total de ${movies?.length || 0} registros encontrados:`);
  movies?.forEach((movie, index) => {
    console.log(`  ${index + 1}. "${movie.title}" - R$ ${(movie.price_cents / 100).toFixed(2)} (ID: ${movie.id})`);
  });
  
  return movies || [];
}

async function updateMoviePricesInSupabase() {
  console.log('\n🚀 Iniciando migração de preços para o Supabase...\n');

  // Primeiro, buscar todos os filmes
  const allMovies = await listAllMovies();
  
  let updatedCount = 0;
  let notFoundCount = 0;

  for (const priceUpdate of updatedPrices) {
    try {
      // Buscar o filme pelo título exato
      const foundMovie = allMovies.find(movie => movie.title === priceUpdate.title);

      if (!foundMovie) {
        console.log(`❌ Filme não encontrado: "${priceUpdate.title}"`);
        notFoundCount++;
        continue;
      }

      // Atualizar o preço
      const { error: updateError } = await supabase
        .from('content')
        .update({ price_cents: priceUpdate.newPrice })
        .eq('id', foundMovie.id);

      if (updateError) {
        console.error(`❌ Erro ao atualizar ${priceUpdate.title}:`, updateError.message);
        continue;
      }

      console.log(`✅ ${priceUpdate.title}: R$ ${(foundMovie.price_cents / 100).toFixed(2)} → R$ ${(priceUpdate.newPrice / 100).toFixed(2)}`);
      updatedCount++;

    } catch (error) {
      console.error(`❌ Erro inesperado ao processar ${priceUpdate.title}:`, error);
    }
  }

  console.log(`\n📊 Resumo da migração:`);
  console.log(`✅ Filmes atualizados: ${updatedCount}`);
  console.log(`❌ Filmes não encontrados: ${notFoundCount}`);
  console.log(`📝 Total processado: ${updatedPrices.length}`);
}

async function verifyUpdatedPrices() {
  console.log('\n🔍 Verificando preços atualizados no Supabase...\n');

  const allMovies = await supabase
    .from('content')
    .select('id, title, price_cents')
    .order('title');

  if (allMovies.error) {
    console.error('❌ Erro ao buscar filmes para verificação:', allMovies.error.message);
    return;
  }

  for (const priceUpdate of updatedPrices) {
    const foundMovie = allMovies.data?.find(movie => movie.title === priceUpdate.title);

    if (!foundMovie) {
      console.log(`❌ ${priceUpdate.title}: Não encontrado`);
      continue;
    }

    const currentPrice = foundMovie.price_cents;
    const expectedPrice = priceUpdate.newPrice;
    const isCorrect = currentPrice === expectedPrice;

    console.log(`${isCorrect ? '✅' : '❌'} ${priceUpdate.title}: R$ ${(currentPrice / 100).toFixed(2)} ${isCorrect ? '(correto)' : `(esperado: R$ ${(expectedPrice / 100).toFixed(2)})`}`);
  }
}

async function main() {
  try {
    await updateMoviePricesInSupabase();
    await verifyUpdatedPrices();
    console.log('\n🎉 Migração de preços concluída!');
  } catch (error) {
    console.error('❌ Erro durante a migração:', error);
    process.exit(1);
  }
}

main();