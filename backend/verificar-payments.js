const { Pool } = require('pg');

/**
 * Script para verificar estrutura atual da tabela payments
 * Executa: cd backend && node verificar-payments.js
 */

async function verificarTabela() {
  console.log('🔍 Verificando estrutura da tabela payments...\n');

  const pool = new Pool({
    host: 'aws-1-sa-east-1.pooler.supabase.com',
    port: 5432,
    user: 'postgres.szghyvnbmjlquznxhqum',
    password: 'Umeomesmo1,',
    database: 'postgres',
    ssl: {
      rejectUnauthorized: false
    }
  });

  let client;

  try {
    client = await pool.connect();
    console.log('✅ Conectado ao Supabase\n');

    // Verificar se tabela existe
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'payments'
      ) as exists;
    `);

    if (!tableExists.rows[0].exists) {
      console.log('❌ Tabela payments NÃO EXISTE');
      console.log('   Pode criar do zero com CREATE TABLE\n');
      return;
    }

    console.log('✅ Tabela payments EXISTE\n');

    // Listar colunas
    const columns = await client.query(`
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'payments'
      ORDER BY ordinal_position;
    `);

    console.log('📊 Colunas atuais:');
    console.table(columns.rows);

    // Verificar colunas que faltam
    const requiredColumns = [
      'id', 'purchase_id', 'provider', 'provider_payment_id',
      'status', 'amount_cents', 'currency', 'payment_method',
      'provider_meta', 'webhook_payload', 'failure_reason',
      'processed_at', 'expires_at', 'created_at', 'updated_at'
    ];

    const existingColumns = columns.rows.map(r => r.column_name);
    const missingColumns = requiredColumns.filter(c => !existingColumns.includes(c));

    if (missingColumns.length > 0) {
      console.log('\n⚠️  Colunas FALTANDO:');
      missingColumns.forEach(col => console.log(`   - ${col}`));
    } else {
      console.log('\n✅ Todas as colunas necessárias estão presentes!');
    }

    // Verificar ENUMs
    console.log('\n🔍 Verificando ENUMs...\n');

    const enums = await client.query(`
      SELECT typname
      FROM pg_type
      WHERE typname IN ('payment_provider_enum', 'payment_status_enum');
    `);

    if (enums.rows.length > 0) {
      console.log('✅ ENUMs encontrados:');
      enums.rows.forEach(r => console.log(`   - ${r.typname}`));
    } else {
      console.log('⚠️  Nenhum ENUM encontrado');
    }

    // Verificar índices
    console.log('\n🔍 Verificando índices...\n');

    const indexes = await client.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'payments'
      AND indexname LIKE 'idx_payments_%';
    `);

    if (indexes.rows.length > 0) {
      console.log(`✅ Índices encontrados: ${indexes.rows.length}`);
      indexes.rows.forEach(r => console.log(`   - ${r.indexname}`));
    } else {
      console.log('⚠️  Nenhum índice customizado encontrado');
    }

  } catch (error) {
    console.error('\n❌ ERRO:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

verificarTabela();
