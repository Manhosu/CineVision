const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function applyMigration() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  console.log('\n🔧 Aplicando migração: Campos do Telegram na tabela users\n');
  console.log('='.repeat(70));

  // Read migration file
  const migrationPath = path.join(__dirname, 'supabase', 'migrations', '20250119000001_add_telegram_fields_to_users.sql');
  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

  console.log('\n📄 SQL a ser executado:');
  console.log('-'.repeat(70));
  console.log(migrationSQL);
  console.log('-'.repeat(70));

  console.log('\n⚠️  Esta migração irá adicionar os seguintes campos à tabela users:');
  console.log('   - telegram_chat_id (VARCHAR)');
  console.log('   - telegram_username (VARCHAR)');
  console.log('   - name (VARCHAR)');
  console.log('   - status (VARCHAR)');
  console.log('   - last_active_at (TIMESTAMP)');
  console.log('   - last_login_at (TIMESTAMP)');

  console.log('\n🚀 Executando migração via SQL Editor do Supabase...\n');
  console.log('📝 INSTRUÇÕES:');
  console.log('   1. Acesse: https://supabase.com/dashboard/project/_/sql/new');
  console.log('   2. Cole o SQL acima');
  console.log('   3. Execute a query');
  console.log('   4. Verifique se todos os campos foram criados com sucesso\n');

  console.log('💡 Ou execute diretamente no psql:');
  console.log(`   psql "${process.env.SUPABASE_URL}" -f supabase/migrations/20250119000001_add_telegram_fields_to_users.sql\n`);

  console.log('='.repeat(70));
  console.log('\n⏳ Aguardando aplicação manual da migração...\n');

  // Try to verify if we can execute directly (will likely fail with permission issues)
  console.log('🔍 Tentando verificar estrutura atual da tabela...\n');

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .limit(1)
    .single();

  if (data) {
    console.log('✅ Campos atuais na tabela users:');
    Object.keys(data).sort().forEach(field => {
      console.log(`   - ${field}`);
    });

    const missingFields = [];
    const requiredFields = ['telegram_chat_id', 'telegram_username', 'name', 'status', 'last_active_at', 'last_login_at'];

    requiredFields.forEach(field => {
      if (!(field in data)) {
        missingFields.push(field);
      }
    });

    if (missingFields.length > 0) {
      console.log('\n⚠️  Campos faltando (precisam ser adicionados):');
      missingFields.forEach(field => console.log(`   - ${field}`));
      console.log('\n👆 Execute a migração SQL acima para adicionar estes campos!');
    } else {
      console.log('\n✅ Todos os campos necessários já existem!');
    }
  }
}

applyMigration().catch(console.error);
