// Listar todas as tabelas do Supabase
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function listarTabelas() {
  console.log('\n📋 Listando tabelas do Supabase...\n');

  // Tentar buscar de várias tabelas conhecidas para ver quais existem
  const tabelasParaTestar = [
    'content',
    'series',
    'episodes',
    'categories',
    'users',
    'purchases',
    'payments',
    'content_languages',
  ];

  for (const tabela of tabelasParaTestar) {
    const { data, error } = await supabase
      .from(tabela)
      .select('*')
      .limit(1);

    if (error) {
      console.log(`❌ ${tabela}: NÃO EXISTE (${error.message})`);
    } else {
      console.log(`✅ ${tabela}: existe (${data.length} registro encontrado para teste)`);
    }
  }

  console.log('\n📊 Verificando estrutura da tabela content...\n');

  // Buscar alguns registros de content para ver a estrutura
  const { data: contents, error: contentError } = await supabase
    .from('content')
    .select('id, title, type, status')
    .limit(5);

  if (!contentError) {
    console.log('Conteúdos no banco:');
    contents.forEach(c => {
      console.log(`   - ${c.title}: type="${c.type}", status="${c.status}"`);
    });
  }
}

listarTabelas().catch(console.error);
