require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.SUPABASE_DATABASE_URL,
});

async function fixForeignKey() {
  console.log('🔧 Corrigindo foreign key de payments.movie_id...\n');

  try {
    // Step 1: Drop the existing constraint
    console.log('1️⃣  Removendo constraint antiga payments_movie_id_fkey...');
    await pool.query(`
      ALTER TABLE payments
      DROP CONSTRAINT IF EXISTS payments_movie_id_fkey;
    `);
    console.log('✅ Constraint removida!\n');

    // Step 2: Add new constraint pointing to content table
    console.log('2️⃣  Adicionando nova constraint apontando para content...');
    await pool.query(`
      ALTER TABLE payments
      ADD CONSTRAINT payments_movie_id_fkey
      FOREIGN KEY (movie_id)
      REFERENCES content(id)
      ON DELETE CASCADE;
    `);
    console.log('✅ Nova constraint adicionada!\n');

    // Step 3: Verify
    console.log('3️⃣  Verificando constraints...');
    const result = await pool.query(`
      SELECT
        tc.constraint_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = 'payments'
        AND kcu.column_name = 'movie_id';
    `);

    console.log('📋 Foreign key atual:');
    console.table(result.rows);

    console.log('\n✅ Migration concluída com sucesso!');
    console.log('💡 Agora payments.movie_id aponta para content.id ao invés de movies.id');

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await pool.end();
  }
}

fixForeignKey();
