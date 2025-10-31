const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://szghyvnbmjlquznxhqum.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6Z2h5dm5ibWpscXV6bnhocXVtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODc0OTk5OSwiZXhwIjoyMDc0MzI1OTk5fQ.p9_G_CjLg8h2CVZqteKLdK9WUFKFdXSqTuTolHFiWGc';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  console.log('🔍 Verificando schema da tabela content...\n');

  // Buscar um conteúdo para ver todas as colunas
  const { data: content, error } = await supabase
    .from('content')
    .select('*')
    .limit(1)
    .single();

  if (error) {
    console.error('❌ Erro:', error);
    return;
  }

  console.log('✅ Colunas disponíveis na tabela content:\n');
  Object.keys(content).sort().forEach(key => {
    const value = content[key];
    const type = value === null ? 'NULL' : typeof value;
    console.log(`   - ${key} (${type})`);
  });

  console.log('\n📊 Exemplo de registro:\n');
  console.log(JSON.stringify(content, null, 2));
}

checkSchema().catch(console.error);
