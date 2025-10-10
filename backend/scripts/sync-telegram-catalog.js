const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

async function getAvailableMovies() {
  const { data: movies, error } = await supabase
    .from('content')
    .select(`
      id,
      title,
      description,
      poster_url,
      price_cents,
      release_year,
      imdb_rating,
      availability,
      genres,
      categories:content_categories(
        category:categories(
          name
        )
      ),
      languages:content_languages(
        id,
        language,
        audio_type,
        video_url,
        quality,
        status
      )
    `)
    .eq('status', 'PUBLISHED')
    .eq('content_type', 'movie')
    .in('availability', ['both', 'telegram']);

  if (error) {
    throw new Error(`Erro ao buscar filmes: ${error.message}`);
  }

  // Filtrar apenas filmes que têm vídeos prontos
  return movies.filter(movie =>
    movie.languages && movie.languages.length > 0 &&
    movie.languages.some(lang => lang.status === 'ready' && lang.video_url)
  );
}

async function getTelegramChannels() {
  // Aqui você pode buscar os canais/grupos onde o bot enviará as mensagens
  // Por enquanto, vou retornar um array vazio - você precisa configurar isso
  return [];
}

async function formatMovieMessage(movie) {
  const categories = movie.categories?.map(c => c.category.name).join(', ') || 'Sem categoria';
  const price = (movie.price_cents / 100).toFixed(2);

  const availableVersions = movie.languages.map(lang =>
    `• ${lang.audio_type.toUpperCase()} - ${lang.quality || '1080p'}`
  ).join('\n');

  return `
🎬 *${movie.title}* ${movie.release_year ? `(${movie.release_year})` : ''}

${movie.description || 'Sem descrição disponível'}

📊 *Avaliação IMDB:* ${movie.imdb_rating ? `⭐ ${movie.imdb_rating}/10` : 'N/A'}
🎭 *Categorias:* ${categories}
💰 *Preço:* R$ ${price}

🎥 *Versões Disponíveis:*
${availableVersions}

Para assistir, clique no botão abaixo! 👇
`.trim();
}

async function sendMovieToChannel(channelId, movie) {
  try {
    const message = await formatMovieMessage(movie);

    // Criar botão inline para assistir
    const keyboard = {
      inline_keyboard: [[
        {
          text: '🍿 Assistir Agora',
          url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/movies/${movie.id}`
        }
      ]]
    };

    const payload = {
      chat_id: channelId,
      text: message,
      parse_mode: 'Markdown',
      reply_markup: keyboard
    };

    // Se houver poster, enviar como foto
    if (movie.poster_url) {
      const photoPayload = {
        chat_id: channelId,
        photo: movie.poster_url,
        caption: message,
        parse_mode: 'Markdown',
        reply_markup: keyboard
      };

      await axios.post(`${TELEGRAM_API}/sendPhoto`, photoPayload);
    } else {
      await axios.post(`${TELEGRAM_API}/sendMessage`, payload);
    }

    console.log(`  ✅ Enviado: ${movie.title}`);
    return true;
  } catch (error) {
    console.error(`  ❌ Erro ao enviar ${movie.title}:`, error.response?.data || error.message);
    return false;
  }
}

async function getAdminUsers() {
  const { data: admins, error } = await supabase
    .from('users')
    .select('id, name, telegram_id, telegram_username')
    .eq('role', 'admin')
    .not('telegram_id', 'is', null);

  if (error) {
    console.error('Erro ao buscar admins:', error);
    return [];
  }

  return admins;
}

async function notifyAdmins(message) {
  const admins = await getAdminUsers();

  for (const admin of admins) {
    if (admin.telegram_id) {
      try {
        await axios.post(`${TELEGRAM_API}/sendMessage`, {
          chat_id: admin.telegram_id,
          text: message,
          parse_mode: 'Markdown'
        });
        console.log(`  ✅ Admin notificado: ${admin.name || admin.telegram_username}`);
      } catch (error) {
        console.error(`  ❌ Erro ao notificar ${admin.name}:`, error.message);
      }
    }
  }
}

async function generateCatalogSummary(movies) {
  const summary = {
    total: movies.length,
    withDublado: movies.filter(m => m.languages.some(l => l.audio_type === 'dublado')).length,
    withLegendado: movies.filter(m => m.languages.some(l => l.audio_type === 'legendado')).length,
    byCategory: {}
  };

  movies.forEach(movie => {
    const cats = movie.categories?.map(c => c.category.name) || ['Sem categoria'];
    cats.forEach(cat => {
      summary.byCategory[cat] = (summary.byCategory[cat] || 0) + 1;
    });
  });

  return summary;
}

async function main() {
  console.log('\n📺 Sincronizando Catálogo com Telegram...\n');
  console.log('Bot:', process.env.TELEGRAM_BOT_USERNAME);
  console.log('Token:', TELEGRAM_BOT_TOKEN ? '✓ Configurado' : '✗ Não configurado');

  if (!TELEGRAM_BOT_TOKEN) {
    console.error('\n❌ TELEGRAM_BOT_TOKEN não configurado!');
    process.exit(1);
  }

  try {
    // Buscar filmes disponíveis
    console.log('\n📋 Buscando filmes disponíveis...');
    const movies = await getAvailableMovies();
    console.log(`   Encontrados: ${movies.length} filmes`);

    if (movies.length === 0) {
      console.log('\n⚠️  Nenhum filme disponível para sincronizar.');
      console.log('   Certifique-se de que os filmes estão:');
      console.log('   • Publicados (status: PUBLISHED)');
      console.log('   • Com disponibilidade: both ou telegram');
      console.log('   • Com vídeos prontos (status: ready)');
      process.exit(0);
    }

    // Gerar sumário
    const summary = await generateCatalogSummary(movies);
    console.log('\n📊 Resumo do Catálogo:');
    console.log(`   • Total de filmes: ${summary.total}`);
    console.log(`   • Com dublado: ${summary.withDublado}`);
    console.log(`   • Com legendado: ${summary.withLegendado}`);
    console.log('\n   📁 Por categoria:');
    Object.entries(summary.byCategory).forEach(([cat, count]) => {
      console.log(`      • ${cat}: ${count} ${count === 1 ? 'filme' : 'filmes'}`);
    });

    // Listar filmes
    console.log('\n🎬 Filmes disponíveis:');
    movies.forEach((movie, index) => {
      const versions = movie.languages.map(l => l.audio_type.toUpperCase()).join(', ');
      console.log(`   ${index + 1}. ${movie.title} [${versions}]`);
    });

    // Notificar admins
    console.log('\n📬 Notificando administradores...');
    const notificationMessage = `
🎬 *Catálogo Atualizado!*

📊 *Resumo:*
• Total: ${summary.total} filmes
• Dublados: ${summary.withDublado}
• Legendados: ${summary.withLegendado}

O catálogo do bot foi sincronizado com sucesso!
`.trim();

    await notifyAdmins(notificationMessage);

    // Buscar canais para enviar
    console.log('\n📢 Verificando canais configurados...');
    const channels = await getTelegramChannels();

    if (channels.length === 0) {
      console.log('   ⚠️  Nenhum canal configurado.');
      console.log('   💡 Dica: Configure canais no banco de dados para enviar atualizações automáticas.');
    } else {
      console.log(`   Encontrados: ${channels.length} ${channels.length === 1 ? 'canal' : 'canais'}`);

      for (const channel of channels) {
        console.log(`\n📤 Enviando para: ${channel.name || channel.chat_id}`);
        for (const movie of movies) {
          await sendMovieToChannel(channel.chat_id, movie);
          // Aguardar 1 segundo entre mensagens para evitar rate limit
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    console.log('\n✅ Sincronização concluída!');
    console.log('\n💡 Dica: Os usuários podem pesquisar filmes usando /catalogo no bot.');

  } catch (error) {
    console.error('\n❌ Erro durante sincronização:', error);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });
