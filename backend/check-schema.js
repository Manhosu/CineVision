require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSchema() {
  console.log('🔍 Verificando schema da tabela content_languages\n');

  const { data, error } = await supabase
    .from('content_languages')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Erro:', error);
    return;
  }

  if (data && data.length > 0) {
    console.log('📋 Colunas disponíveis:');
    Object.keys(data[0]).forEach(key => {
      console.log(`   • ${key}: ${typeof data[0][key]} = ${data[0][key]}`);
    });
  }
}

checkSchema().catch(console.error);
