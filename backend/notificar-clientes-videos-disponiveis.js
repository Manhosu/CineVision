require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://app.cinevisionapp.com.br';

async function notificarClientes() {
  console.log('📱 Notificando clientes sobre vídeos disponíveis...\n');

  // Buscar compras pagas de conteúdos que agora TÊM vídeos
  const { data: purchases, error: purchaseError } = await supabase
    .from('purchases')
    .select(`
      id,
      content_id,
      user_id,
      content (
        id,
        title,
        content_languages (*)
      ),
      users (
        id,
        telegram_id,
        name,
        email
      )
    `)
    .eq('status', 'paid');

  if (purchaseError) {
    console.error('❌ Erro ao buscar compras:', purchaseError);
    return;
  }

  console.log(`💰 Total de compras pagas: ${purchases.length}\n`);

  // Filtrar compras que AGORA têm vídeos mas ANTES não tinham
  // (simulamos verificando se tem vídeos agora)
  const comprasParaNotificar = purchases.filter(p =>
    p.content?.content_languages &&
    p.content.content_languages.length > 0 &&
    p.users?.telegram_id
  );

  console.log(`✅ Compras com vídeos disponíveis: ${comprasParaNotificar.length}\n`);

  if (comprasParaNotificar.length === 0) {
    console.log('ℹ️  Nenhuma compra para notificar.\n');
    return;
  }

  // Agrupar por conteúdo
  const porConteudo = {};
  comprasParaNotificar.forEach(p => {
    const contentId = p.content_id;
    if (!porConteudo[contentId]) {
      porConteudo[contentId] = {
        title: p.content.title,
        compras: []
      };
    }
    porConteudo[contentId].compras.push(p);
  });

  console.log('📊 Resumo por conteúdo:');
  console.log('─'.repeat(60));
  for (const [contentId, info] of Object.entries(porConteudo)) {
    console.log(`${info.title}: ${info.compras.length} cliente(s)`);
  }
  console.log('');

  // Perguntar confirmação (em produção, remover esta parte)
  console.log('⚠️  ATENÇÃO: Este script enviará notificações via Telegram!');
  console.log('   Para continuar, comente a linha "return" abaixo.\n');
  return; // <-- COMENTAR ESTA LINHA PARA ENVIAR AS NOTIFICAÇÕES

  // Enviar notificações
  let enviadas = 0;
  let erros = 0;

  for (const purchase of comprasParaNotificar) {
    try {
      const chatId = purchase.users.telegram_id;
      const contentTitle = purchase.content.title;

      const message = `🎉 *Boa notícia!*

O vídeo *${contentTitle}* que você comprou já está disponível!

Acesse agora pelo dashboard para assistir.`;

      const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

      await axios.post(url, {
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📱 Ver Minhas Compras', url: `${FRONTEND_URL}/dashboard` }],
            [{ text: '🎬 Assistir Agora', url: `${FRONTEND_URL}/watch/${purchase.content_id}` }]
          ]
        }
      });

      console.log(`✅ Notificação enviada: ${purchase.users.name || 'Sem nome'} - ${contentTitle}`);
      enviadas++;

      // Aguardar 1 segundo entre envios para não bater rate limit
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      console.error(`❌ Erro ao notificar compra ${purchase.id}:`, error.message);
      erros++;
    }
  }

  console.log('\n─'.repeat(60));
  console.log(`✅ Notificações enviadas: ${enviadas}`);
  console.log(`❌ Erros: ${erros}`);
  console.log('✅ Processo concluído!\n');
}

notificarClientes().catch(console.error);
