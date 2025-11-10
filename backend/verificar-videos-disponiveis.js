require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verificarVideosDisponiveis() {
  console.log('🔍 Verificando vídeos disponíveis no banco de dados...\n');

  // 1. Verificar quantos conteúdos existem
  const { data: allContent, error: contentError } = await supabase
    .from('content')
    .select('id, title');

  if (contentError) {
    console.error('❌ Erro ao buscar conteúdos:', contentError);
    return;
  }

  console.log(`📦 Total de conteúdos no banco: ${allContent.length}`);

  // 2. Verificar quantos têm vídeos
  const { data: contentWithLanguages, error: langError } = await supabase
    .from('content')
    .select('id, title, content_languages(*)');

  if (langError) {
    console.error('❌ Erro ao buscar content_languages:', langError);
    return;
  }

  const comVideo = contentWithLanguages.filter(c => c.content_languages && c.content_languages.length > 0);
  const semVideo = contentWithLanguages.filter(c => !c.content_languages || c.content_languages.length === 0);

  console.log(`✅ Conteúdos COM vídeos: ${comVideo.length}`);
  console.log(`❌ Conteúdos SEM vídeos: ${semVideo.length}\n`);

  // 3. Mostrar conteúdos sem vídeo
  if (semVideo.length > 0) {
    console.log('⚠️  Conteúdos SEM vídeos disponíveis:');
    console.log('─'.repeat(60));
    semVideo.slice(0, 10).forEach((content, index) => {
      console.log(`${index + 1}. ${content.title} (${content.id})`);
    });
    if (semVideo.length > 10) {
      console.log(`... e mais ${semVideo.length - 10} conteúdos`);
    }
    console.log('');
  }

  // 4. Mostrar conteúdos com vídeo
  if (comVideo.length > 0) {
    console.log('✅ Conteúdos COM vídeos disponíveis:');
    console.log('─'.repeat(60));
    comVideo.slice(0, 10).forEach((content, index) => {
      const numVideos = content.content_languages.length;
      console.log(`${index + 1}. ${content.title} (${numVideos} vídeo${numVideos > 1 ? 's' : ''})`);
    });
    if (comVideo.length > 10) {
      console.log(`... e mais ${comVideo.length - 10} conteúdos`);
    }
    console.log('');
  }

  // 5. Verificar se existe alguma compra de conteúdo sem vídeo
  const { data: purchases, error: purchaseError } = await supabase
    .from('purchases')
    .select('id, content_id, content(title), status')
    .eq('status', 'paid');

  if (purchaseError) {
    console.error('❌ Erro ao buscar compras:', purchaseError);
    return;
  }

  console.log(`💰 Total de compras pagas: ${purchases.length}\n`);

  if (purchases.length > 0) {
    // Verificar quantas compras são de conteúdo sem vídeo
    const comprasSemVideo = [];
    for (const purchase of purchases) {
      const temVideo = comVideo.some(c => c.id === purchase.content_id);
      if (!temVideo) {
        comprasSemVideo.push(purchase);
      }
    }

    if (comprasSemVideo.length > 0) {
      console.log('🚨 PROBLEMA IDENTIFICADO!');
      console.log(`   ${comprasSemVideo.length} compra(s) paga(s) de conteúdo SEM vídeo disponível:\n`);
      comprasSemVideo.forEach((purchase, index) => {
        console.log(`   ${index + 1}. Compra ${purchase.id.substring(0, 8)}... - ${purchase.content?.title || 'N/A'}`);
      });
      console.log('\n   ⚠️  Isso explica o erro "Vídeo não disponível" após o pagamento!\n');
    } else {
      console.log('✅ Todas as compras pagas têm vídeos disponíveis.\n');
    }
  }

  console.log('✅ Verificação concluída!\n');
}

verificarVideosDisponiveis().catch(console.error);
