require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.SUPABASE_DATABASE_URL,
});

async function checkTables() {
  console.log('🔍 Verificando tabelas content e movies...\n');

  try {
    // Verificar se existe tabela movies
    const moviesCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'movies'
      );
    `);

    // Verificar se existe tabela content
    const contentCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'content'
      );
    `);

    console.log('📋 Status das tabelas:');
    console.log(`  - movies: ${moviesCheck.rows[0].exists ? '✅ Existe' : '❌ NÃO EXISTE'}`);
    console.log(`  - content: ${contentCheck.rows[0].exists ? '✅ Existe' : '❌ NÃO EXISTE'}`);

    // Se movies existe, ver suas colunas
    if (moviesCheck.rows[0].exists) {
      const moviesColumns = await pool.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'movies'
        ORDER BY ordinal_position;
      `);
      console.log('\n📋 Colunas da tabela movies:');
      console.table(moviesColumns.rows);
    }

    // Verificar constraints da tabela payments
    const constraints = await pool.query(`
      SELECT
        tc.constraint_name,
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = 'payments';
    `);

    console.log('\n📋 Foreign keys da tabela payments:');
    console.table(constraints.rows);

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await pool.end();
  }
}

checkTables();
