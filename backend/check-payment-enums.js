require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.SUPABASE_DATABASE_URL,
});

async function checkEnums() {
  console.log('🔍 Verificando enums de payment...\n');

  try {
    // Verificar valores do enum payment_method
    const methodResult = await pool.query(`
      SELECT enumlabel
      FROM pg_enum
      WHERE enumtypid = (
        SELECT oid FROM pg_type WHERE typname = 'payment_method'
      )
      ORDER BY enumsortorder;
    `);

    console.log('📋 Valores do enum payment_method:');
    methodResult.rows.forEach(row => console.log(`  - ${row.enumlabel}`));

    // Verificar valores do enum payment_status
    const statusResult = await pool.query(`
      SELECT enumlabel
      FROM pg_enum
      WHERE enumtypid = (
        SELECT oid FROM pg_type WHERE typname = 'payment_status'
      )
      ORDER BY enumsortorder;
    `);

    console.log('\n📋 Valores do enum payment_status:');
    statusResult.rows.forEach(row => console.log(`  - ${row.enumlabel}`));

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await pool.end();
  }
}

checkEnums();
