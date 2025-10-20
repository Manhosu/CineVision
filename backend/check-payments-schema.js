require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.SUPABASE_DATABASE_URL,
});

async function checkSchema() {
  console.log('🔍 Verificando schema completo da tabela payments...\n');

  try {
    // Verificar todas as colunas
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'payments'
      ORDER BY ordinal_position;
    `);

    console.log('📋 Colunas da tabela payments:');
    console.table(result.rows);

    // Verificar se a coluna provider existe
    const providerExists = result.rows.some(row => row.column_name === 'provider');
    const providerMetaExists = result.rows.some(row => row.column_name === 'provider_meta');

    console.log('\n✅ Status das colunas:');
    console.log(`  - provider: ${providerExists ? '✅ Existe' : '❌ NÃO EXISTE'}`);
    console.log(`  - provider_meta: ${providerMetaExists ? '✅ Existe' : '❌ NÃO EXISTE'}`);

    // Se provider não existe, vamos ver os constraints e tipos
    if (!providerExists) {
      console.log('\n⚠️  Coluna "provider" não encontrada!');
      console.log('🔍 Verificando enums e tipos personalizados...');

      const enumResult = await pool.query(`
        SELECT n.nspname as schema, t.typname as type
        FROM pg_type t
        LEFT JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname LIKE '%payment%'
        ORDER BY 1, 2;
      `);

      console.log('\n📦 Tipos personalizados relacionados a payment:');
      console.table(enumResult.rows);
    }

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await pool.end();
  }
}

checkSchema();
