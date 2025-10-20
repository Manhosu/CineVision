require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.SUPABASE_DATABASE_URL,
});

async function checkContentId() {
  const contentId = 'da5a57f3-a4d8-41d7-bffd-3f46042b55ea';
  console.log(`🔍 Verificando se content_id ${contentId} existe...\n`);

  try {
    // Verificar na tabela content
    const contentResult = await pool.query(`
      SELECT id, title FROM content WHERE id = $1;
    `, [contentId]);

    // Verificar na tabela movies
    const moviesResult = await pool.query(`
      SELECT id, title FROM movies WHERE id = $1;
    `, [contentId]);

    console.log('📋 Resultados:');
    console.log(`  - Na tabela content: ${contentResult.rows.length > 0 ? '✅ EXISTE' : '❌ NÃO EXISTE'}`);
    if (contentResult.rows.length > 0) {
      console.log(`    Título: ${contentResult.rows[0].title}`);
    }

    console.log(`  - Na tabela movies: ${moviesResult.rows.length > 0 ? '✅ EXISTE' : '❌ NÃO EXISTE'}`);
    if (moviesResult.rows.length > 0) {
      console.log(`    Título: ${moviesResult.rows[0].title}`);
    }

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await pool.end();
  }
}

checkContentId();
