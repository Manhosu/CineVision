require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Adiciona link do grupo do Telegram a um conteúdo
 *
 * IMPORTANTE:
 * 1. O grupo deve existir no Telegram
 * 2. O bot deve ser administrador do grupo
 * 3. O bot precisa ter permissão para "criar links de convite"
 *
 * Exemplo de uso:
 * node adicionar-grupo-telegram.js "ID_DO_CONTEUDO" "https://t.me/+AbCdEfGhIjK"
 */

async function addTelegramGroup(contentId, groupLink) {
  try {
    // Validar formato do link
    if (!groupLink.startsWith('https://t.me/')) {
      console.error('❌ Formato de link inválido!');
      console.log('   O link deve começar com https://t.me/');
      console.log('   Exemplo: https://t.me/+AbCdEfGhIjK');
      return;
    }

    // Buscar o conteúdo
    const { data: content, error: fetchError } = await supabase
      .from('content')
      .select('id, title, telegram_group_link')
      .eq('id', contentId)
      .single();

    if (fetchError || !content) {
      console.error('❌ Conteúdo não encontrado!');
      console.log(`   ID: ${contentId}`);
      return;
    }

    console.log(`\n📺 Conteúdo: ${content.title}`);
    console.log(`   ID: ${content.id}`);

    if (content.telegram_group_link) {
      console.log(`⚠️  Já tem grupo vinculado: ${content.telegram_group_link}`);
      console.log('   Deseja substituir? (s/n)');
      // Para simplificar, vamos sempre atualizar
    }

    // Atualizar o conteúdo
    const { data: updated, error: updateError } = await supabase
      .from('content')
      .update({ telegram_group_link: groupLink })
      .eq('id', contentId)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Erro ao atualizar:', updateError.message);
      return;
    }

    console.log('\n✅ Grupo do Telegram vinculado com sucesso!');
    console.log(`   Link: ${groupLink}`);
    console.log('\n📋 PRÓXIMOS PASSOS:');
    console.log('   1. Certifique-se que o bot está no grupo como admin');
    console.log('   2. Dê permissão para o bot criar links de convite');
    console.log('   3. Teste fazendo uma compra de teste');
    console.log('\n💡 COMO FUNCIONA:');
    console.log('   - Após o pagamento ser confirmado');
    console.log('   - O sistema cria um link único que expira em 24h');
    console.log('   - O comprador recebe uma mensagem com botões:');
    console.log('     📱 Entrar no Grupo do Telegram');
    console.log('     🌐 Acessar Dashboard');
    console.log('   - O link só pode ser usado 1 vez\n');

  } catch (error) {
    console.error('❌ Erro inesperado:', error.message);
  }
}

// Executar
const contentId = process.argv[2];
const groupLink = process.argv[3];

if (!contentId || !groupLink) {
  console.log('\n📘 USO:');
  console.log('   node adicionar-grupo-telegram.js <content_id> <group_link>');
  console.log('\n📝 EXEMPLO:');
  console.log('   node adicionar-grupo-telegram.js "123e4567-e89b-12d3-a456-426614174000" "https://t.me/+AbCdEfGhIjK"');
  console.log('\n💡 Para obter o ID do conteúdo:');
  console.log('   node check-telegram-groups.js\n');
  process.exit(1);
}

addTelegramGroup(contentId, groupLink);
