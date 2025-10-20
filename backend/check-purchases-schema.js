require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.SUPABASE_DATABASE_URL,
});

async function checkSchema() {
  console.log('🔍 Verificando schema da tabela purchases...\n');

  try {
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'purchases'
      ORDER BY ordinal_position;
    `);

    console.log('📋 Colunas da tabela purchases:');
    console.table(result.rows);

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await pool.end();
  }
}

checkSchema();
