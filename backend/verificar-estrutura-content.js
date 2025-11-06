// Verificar estrutura da tabela content
require('dotenv').config();
const { Client } = require('pg');

const connectionString = process.env.SUPABASE_DATABASE_URL;
const client = new Client({ connectionString });

async function verificarEstrutura() {
  try {
    await client.connect();

    console.log('\n📋 Verificando estrutura da tabela "content"...\n');

    const result = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'content'
      ORDER BY ordinal_position
    `);

    console.log('Colunas encontradas:\n');
    result.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
    });

    console.log('\n');

    // Buscar um registro para ver os valores
    const sample = await client.query(`
      SELECT * FROM content LIMIT 1
    `);

    if (sample.rows.length > 0) {
      console.log('📊 Campos no registro de exemplo:');
      console.log(Object.keys(sample.rows[0]).join(', '));
    }

    await client.end();
  } catch (error) {
    console.error('Erro:', error.message);
    await client.end();
  }
}

verificarEstrutura();
