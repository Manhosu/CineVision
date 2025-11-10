require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function listContent() {
  try {
    const { data, error } = await supabase
      .from('content')
      .select('id, title, content_type, telegram_group_link, status')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error:', error);
      return;
    }

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('               📺 CATÁLOGO DE CONTEÚDO');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const withGroup = data.filter(c => c.telegram_group_link);
    const withoutGroup = data.filter(c => !c.telegram_group_link);

    console.log(`📊 Total: ${data.length} itens`);
    console.log(`   ✅ Com grupo: ${withGroup.length}`);
    console.log(`   ❌ Sem grupo: ${withoutGroup.length}\n`);

    if (withGroup.length > 0) {
      console.log('╔═══════════════════════════════════════════════════════════════╗');
      console.log('║          ✅ CONTEÚDOS COM GRUPO DO TELEGRAM                  ║');
      console.log('╚═══════════════════════════════════════════════════════════════╝\n');

      withGroup.forEach((item, index) => {
        const type = item.content_type === 'series' ? '📺' : '🎬';
        console.log(`${index + 1}. ${type} ${item.title}`);
        console.log(`   Status: ${item.status}`);
        console.log(`   ID: ${item.id}`);
        console.log(`   Grupo: ${item.telegram_group_link}`);
        console.log('');
      });
    }

    if (withoutGroup.length > 0) {
      console.log('╔═══════════════════════════════════════════════════════════════╗');
      console.log('║          ❌ CONTEÚDOS SEM GRUPO DO TELEGRAM                  ║');
      console.log('╚═══════════════════════════════════════════════════════════════╝\n');

      withoutGroup.forEach((item, index) => {
        const type = item.content_type === 'series' ? '📺' : '🎬';
        console.log(`${index + 1}. ${type} ${item.title}`);
        console.log(`   Status: ${item.status}`);
        console.log(`   ID: ${item.id}`);
        console.log('');
      });

      console.log('💡 Para adicionar um grupo a um conteúdo:');
      console.log('   node adicionar-grupo-telegram.js <ID> <LINK_DO_GRUPO>\n');
    }

    console.log('═══════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

listContent();
