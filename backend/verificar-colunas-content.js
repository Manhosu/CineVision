require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verificarColunas() {
  console.log('🔍 Verificando colunas da tabela content...\n');

  // Pegar um registro para ver as colunas disponíveis
  const { data, error } = await supabase
    .from('content')
    .select('*')
    .limit(1)
    .single();

  if (error) {
    console.error('❌ Erro:', error);
    return;
  }

  console.log('✅ Colunas disponíveis na tabela content:\n');
  const columns = Object.keys(data).sort();

  columns.forEach(col => {
    const value = data[col];
    const type = typeof value;
    console.log(`  ${col.padEnd(30)} (${type})`);
  });

  console.log('\n📊 Total de colunas:', columns.length);

  // Verificar se as colunas que precisamos existem
  console.log('\n🎯 Verificação de colunas necessárias:');
  const requiredColumns = [
    'telegram_group_link',
    'rating',
    'release_date',
    'release_year',
    'imdb_rating',
    'trailer_url',
  ];

  requiredColumns.forEach(col => {
    const exists = columns.includes(col);
    console.log(`  ${col.padEnd(30)} ${exists ? '✅' : '❌ FALTANDO'}`);
  });
}

verificarColunas().catch(console.error);
