require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.SUPABASE_DATABASE_URL,
});

async function checkUserId() {
  const userId = '38789f6f-afc4-4eb5-8dbe-f9b69b01435a';
  console.log(`🔍 Verificando user_id ${userId}...\n`);

  try {
    // Verificar na tabela users
    const result = await pool.query(`
      SELECT id, email, name FROM users WHERE id = $1;
    `, [userId]);

    console.log('📋 Resultado:');
    if (result.rows.length > 0) {
      console.log('✅ User EXISTE na tabela users');
      console.table(result.rows);
    } else {
      console.log('❌ User NÃO EXISTE na tabela users');

      // Ver quantos users existem
      const countResult = await pool.query('SELECT COUNT(*) FROM users;');
      console.log(`\nTotal de users na tabela: ${countResult.rows[0].count}`);
    }

    // Verificar também purchases com user_id NULL
    const nullUserPurchases = await pool.query(`
      SELECT COUNT(*) FROM purchases WHERE user_id IS NULL;
    `);
    console.log(`\n📊 Purchases com user_id NULL: ${nullUserPurchases.rows[0].count}`);

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await pool.end();
  }
}

checkUserId();
