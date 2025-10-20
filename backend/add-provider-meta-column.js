const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function addProviderMetaColumn() {
  console.log('🔧 Adicionando coluna provider_meta à tabela payments...\n');

  try {
    // Execute the ALTER TABLE command using RPC or direct SQL
    const { data, error } = await supabase.rpc('exec_sql', {
      query: 'ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider_meta JSONB;'
    });

    if (error) {
      // If RPC doesn't exist, try using the REST API directly
      console.log('⚠️  RPC não disponível, tentando abordagem alternativa...\n');

      // Try using the database URL directly with pg client
      const { Pool } = require('pg');
      const pool = new Pool({
        connectionString: process.env.SUPABASE_DATABASE_URL,
      });

      const result = await pool.query(
        'ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider_meta JSONB;'
      );

      console.log('✅ Coluna provider_meta adicionada com sucesso!\n');

      // Verify the column was added
      const verifyResult = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'payments'
          AND column_name = 'provider_meta';
      `);

      if (verifyResult.rows.length > 0) {
        console.log('✅ Verificação: Coluna encontrada!');
        console.log(verifyResult.rows[0]);
      } else {
        console.log('⚠️  Coluna não encontrada após adição');
      }

      await pool.end();
    } else {
      console.log('✅ Coluna provider_meta adicionada com sucesso via RPC!\n');
      console.log(data);
    }

    // Show all columns in payments table
    const { data: columns, error: columnsError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_name', 'payments')
      .order('ordinal_position');

    if (!columnsError && columns) {
      console.log('\n📋 Estrutura da tabela payments:');
      console.table(columns);
    }

  } catch (error) {
    console.error('❌ Erro ao adicionar coluna:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Execute
addProviderMetaColumn()
  .then(() => {
    console.log('\n✅ Migration concluída com sucesso!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erro na migration:', error);
    process.exit(1);
  });
