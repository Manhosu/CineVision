require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkGroups() {
  try {
    const { data, error } = await supabase
      .from('content')
      .select('id, title, telegram_group_link, content_type')
      .not('telegram_group_link', 'is', null);

    if (error) {
      console.error('Error:', error);
      return;
    }

    console.log('\n=== Conteúdos com Grupo do Telegram ===\n');
    console.log(`Total: ${data.length} itens\n`);

    if (data.length === 0) {
      console.log('❌ Nenhum conteúdo tem grupo do Telegram vinculado ainda.\n');
    } else {
      data.forEach(item => {
        console.log(`📺 ${item.title} (${item.content_type})`);
        console.log(`   Link: ${item.telegram_group_link}`);
        console.log(`   ID: ${item.id}\n`);
      });
    }
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

checkGroups();
