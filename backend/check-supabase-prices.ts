import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

// Lista dos filmes que atualizamos os preços
const updatedMovies = [
  { title: 'Quarteto Fantástico 4 - Primeiros Passos', newPrice: 690 },
  { title: 'Demon Slayer - Castelo Infinito', newPrice: 750 },
  { title: 'A Longa Marcha - Caminhe ou Morra', newPrice: 700 },
  { title: 'Superman', newPrice: 710 },
  { title: 'Como Treinar o Seu Dragão', newPrice: 698 },
  { title: 'F1 - O Filme', newPrice: 705 },
  { title: 'Lilo & Stitch', newPrice: 698 },
  { title: 'A Hora do Mal', newPrice: 695 }
];

async function checkSupabasePrices() {
  console.log('🔍 Verificando preços dos filmes no Supabase...\n');

  try {
    for (const movie of updatedMovies) {
      const { data, error } = await supabase
        .from('content')
        .select('id, title, price_cents')
        .ilike('title', `%${movie.title}%`)
        .eq('content_type', 'movie')
        .single();

      if (error) {
        console.log(`❌ Filme não encontrado: ${movie.title}`);
        console.log(`   Erro: ${error.message}`);
      } else {
        const currentPriceReais = (data.price_cents / 100).toFixed(2);
        const newPriceReais = (movie.newPrice / 100).toFixed(2);
        const needsUpdate = data.price_cents !== movie.newPrice;
        
        console.log(`🎬 ${data.title}`);
        console.log(`   ID: ${data.id}`);
        console.log(`   Preço atual: R$ ${currentPriceReais} (${data.price_cents} centavos)`);
        console.log(`   Preço desejado: R$ ${newPriceReais} (${movie.newPrice} centavos)`);
        console.log(`   Precisa atualizar: ${needsUpdate ? '✅ SIM' : '❌ NÃO'}\n`);
      }
    }

    // Verificar todos os filmes no Supabase
    console.log('📊 Todos os filmes no Supabase:');
    const { data: allMovies, error: allError } = await supabase
      .from('content')
      .select('id, title, price_cents')
      .eq('content_type', 'movie')
      .order('title');

    if (allError) {
      console.error('❌ Erro ao buscar todos os filmes:', allError);
    } else {
      console.log(`\n✅ Total de ${allMovies?.length || 0} filmes encontrados:`);
      allMovies?.forEach((movie, index) => {
        const priceReais = (movie.price_cents / 100).toFixed(2);
        console.log(`  ${index + 1}. ${movie.title} - R$ ${priceReais}`);
      });
    }

  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

checkSupabasePrices().catch(console.error);