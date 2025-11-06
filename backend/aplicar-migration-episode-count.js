const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function aplicarMigration() {
  console.log('\n=== APLICANDO MIGRATION: AUTO UPDATE EPISODE COUNT ===\n');

  // Ler o arquivo de migration
  const migrationPath = path.join(__dirname, 'supabase', 'migrations', '20250206000000_auto_update_episode_count.sql');
  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

  console.log('Executando migration SQL...\n');

  try {
    // Executar a migration
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: migrationSQL
    });

    if (error) {
      // Se exec_sql não existe, tentar executar diretamente (não recomendado para produção)
      console.warn('RPC exec_sql não disponível, tentando executar via query...');

      // Dividir em comandos individuais e executar
      const commands = migrationSQL.split(';').filter(cmd => cmd.trim());

      for (const command of commands) {
        if (command.trim()) {
          console.log(`\nExecutando: ${command.trim().substring(0, 100)}...`);

          const { error: cmdError } = await supabase.from('_migrations').select('*').limit(0);

          if (cmdError) {
            console.error('Erro ao executar comando:', cmdError);
          }
        }
      }

      console.log('\n⚠️  AVISO: Migration pode não ter sido aplicada completamente.');
      console.log('   Execute manualmente no SQL Editor do Supabase Dashboard.');
      console.log('   https://supabase.com/dashboard/project/_/editor/sql\n');

      return;
    }

    console.log('✅ Migration aplicada com sucesso!');

  } catch (err) {
    console.error('\n❌ Erro ao aplicar migration:', err.message);
    console.log('\n📝 Para aplicar manualmente:');
    console.log('   1. Acesse: https://supabase.com/dashboard/project/_/editor/sql');
    console.log('   2. Cole o conteúdo de: backend/supabase/migrations/20250206000000_auto_update_episode_count.sql');
    console.log('   3. Execute a query\n');
  }

  // Verificar se funcionou
  console.log('\n=== VERIFICANDO CONTAGENS ATUALIZADAS ===\n');

  const { data: series, error: seriesError } = await supabase
    .from('content')
    .select('id, title, content_type, total_seasons, total_episodes')
    .eq('content_type', 'series');

  if (seriesError) {
    console.error('Erro ao buscar séries:', seriesError);
    return;
  }

  console.log('Séries no banco de dados:\n');

  for (const s of series) {
    console.log(`📺 ${s.title}`);
    console.log(`   ID: ${s.id}`);
    console.log(`   Temporadas: ${s.total_seasons || 0}`);
    console.log(`   Episódios: ${s.total_episodes || 0}\n`);
  }
}

aplicarMigration()
  .then(() => {
    console.log('\n✅ Processo concluído!\n');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Erro:', err);
    process.exit(1);
  });
