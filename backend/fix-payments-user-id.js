require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.SUPABASE_DATABASE_URL,
});

async function fixUserId() {
  console.log('🔧 Tornando payments.user_id nullable e removendo constraint...\n');

  try {
    // Step 1: Drop the foreign key constraint
    console.log('1️⃣  Removendo constraint payments_user_id_fkey...');
    await pool.query(`
      ALTER TABLE payments
      DROP CONSTRAINT IF EXISTS payments_user_id_fkey;
    `);
    console.log('✅ Constraint removida!\n');

    // Step 2: Make user_id nullable
    console.log('2️⃣  Tornando user_id nullable...');
    await pool.query(`
      ALTER TABLE payments
      ALTER COLUMN user_id DROP NOT NULL;
    `);
    console.log('✅ user_id agora é nullable!\n');

    // Step 3: Make movie_id nullable também (para consistência)
    console.log('3️⃣  Tornando movie_id nullable...');
    await pool.query(`
      ALTER TABLE payments
      ALTER COLUMN movie_id DROP NOT NULL;
    `);
    console.log('✅ movie_id agora é nullable!\n');

    // Step 4: Verify
    console.log('4️⃣  Verificando schema...');
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'payments'
        AND column_name IN ('user_id', 'movie_id')
      ORDER BY column_name;
    `);

    console.log('📋 Schema atualizado:');
    console.table(result.rows);

    console.log('\n✅ Migration concluída com sucesso!');
    console.log('💡 Agora payments aceita user_id e movie_id NULL');
    console.log('💡 user_id não tem mais constraint de foreign key');

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await pool.end();
  }
}

fixUserId();
