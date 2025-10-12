const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://szghyvnbmjlquznxhqum.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6Z2h5dm5ibWpscXV6bnhocXVtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODc0OTk5OSwiZXhwIjoyMDc0MzI1OTk5fQ.p9_G_CjLg8h2CVZqteKLdK9WUFKFdXSqTuTolHFiWGc';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Mapeamento de pastas para títulos no banco
const movieMapping = [
  { folder: 'FILME_  Lilo & Stitch (2025)', title: 'Lilo & Stitch', s3Key: 'lilo-stitch-2025.png' },
  { folder: 'FILME_ A Hora do Mal (2025)', title: 'A Hora do Mal', s3Key: 'a-hora-do-mal-2025.png' },
  { folder: 'FILME_ A Longa Marcha - Caminhe ou Morra (2025)', title: 'A Longa Marcha - Caminhe ou Morra', s3Key: 'a-longa-marcha-2025.png' },
  { folder: 'FILME_ Como Treinar o Seu Dragão (2025)', title: 'Como Treinar o Seu Dragão', s3Key: 'como-treinar-seu-dragao-2025.png' },
  { folder: 'FILME_ Demon Slayer - Castelo Infinito (2025)', title: 'Demon Slayer - Castelo Infinito', s3Key: 'demon-slayer-2025.png' },
  { folder: 'FILME_ F1 - O Filme (2025)', title: 'F1 - O Filme', s3Key: 'f1-o-filme-2025.png' },
  { folder: 'FILME_ Invocação do Mal 4_ O Último Ritual (2025)', title: 'Invocação do Mal 4: O Último Ritual', s3Key: 'invocacao-do-mal-4-2025.png' },
  { folder: 'FILME_ Jurassic World_ Recomeço (2025)', title: 'Jurassic World: Recomeço', s3Key: 'jurassic-world-recomeco-2025.png' },
  { folder: 'FILME_ Quarteto Fantástico 4 - Primeiros Passos (2025)', title: 'Quarteto Fantástico: Primeiros Passos', s3Key: 'quarteto-fantastico-2025.png' },
  { folder: 'FILME_ Superman (2025)', title: 'Superman', s3Key: 'superman-2025.png' }
];

async function main() {
  console.log('=== Publicando Filmes e Atualizando Pôsteres ===\n');

  for (const movie of movieMapping) {
    try {
      console.log(`\n📽️  Processando: ${movie.title}`);

      // Buscar filme no banco pelo título
      const { data: contentData, error: searchError } = await supabase
        .from('content')
        .select('id, status, poster_url')
        .ilike('title', movie.title)
        .limit(1);

      if (searchError || !contentData || contentData.length === 0) {
        console.log(`  ⚠️  Filme não encontrado no banco: ${movie.title}`);
        continue;
      }

      const contentId = contentData[0].id;
      const posterUrl = `https://cinevision-cover.s3.us-east-1.amazonaws.com/posters/${movie.s3Key}`;

      console.log(`  ✅ Encontrado - ID: ${contentId}`);
      console.log(`  📄 Status atual: ${contentData[0].status}`);

      // Atualizar filme para published com URL do pôster
      const { error: updateError } = await supabase
        .from('content')
        .update({
          status: 'published',
          poster_url: posterUrl,
          thumbnail_url: posterUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', contentId);

      if (updateError) {
        console.log(`  ❌ Erro ao atualizar: ${updateError.message}`);
      } else {
        console.log(`  ✅ Atualizado para PUBLISHED`);
        console.log(`  🖼️  Pôster: ${posterUrl}`);
      }

    } catch (error) {
      console.error(`  ❌ Erro: ${error.message}`);
    }
  }

  console.log('\n=== Processo Concluído ===');

  // Verificar quantos filmes publicados temos
  const { data: publishedCount } = await supabase
    .from('content')
    .select('id', { count: 'exact' })
    .eq('status', 'published');

  console.log(`\n📊 Total de filmes publicados: ${publishedCount?.length || 0}`);
}

main().catch(console.error);
