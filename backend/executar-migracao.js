const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

/**
 * Script para executar migração SQL diretamente no Supabase via pg
 * Executa: cd backend && node executar-migracao.js
 */

async function executarMigracao() {
  console.log('🚀 Iniciando migração do banco de dados Supabase...\n');

  // Configuração da conexão com Supabase
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
    // Conectar ao banco
    console.log('📡 Conectando ao Supabase PostgreSQL...');
    client = await pool.connect();
    console.log('✅ Conectado ao Supabase\n');

    // Ler arquivo SQL (está na pasta raiz, um nível acima)
    const sqlPath = path.join(__dirname, '..', 'MIGRACAO-NOVA-TABELA-PAYMENTS.sql');
    console.log(`📄 Lendo SQL de: ${sqlPath}`);

    if (!fs.existsSync(sqlPath)) {
      throw new Error(`Arquivo não encontrado: ${sqlPath}`);
    }

    const sql = fs.readFileSync(sqlPath, 'utf8');
    console.log(`✅ SQL carregado (${sql.length} caracteres)\n`);

    // Executar SQL
    console.log('⚙️  Executando migração...\n');
    console.log('═'.repeat(60));

    const result = await client.query(sql);

    console.log('═'.repeat(60));
    console.log('\n✅ MIGRAÇÃO EXECUTADA COM SUCESSO!\n');

    // Verificar estrutura da tabela payments
    console.log('🔍 Verificando estrutura da tabela payments...\n');
    const checkTable = await client.query(`
      SELECT
        column_name as "Coluna",
        data_type as "Tipo",
        is_nullable as "Aceita NULL?",
        column_default as "Valor Padrão"
      FROM information_schema.columns
      WHERE table_name = 'payments'
      ORDER BY ordinal_position;
    `);

    if (checkTable.rows.length > 0) {
      console.log('✅ Tabela payments criada com sucesso!');
      console.log(`📊 Total de colunas: ${checkTable.rows.length}\n`);
      console.table(checkTable.rows);
    } else {
      console.log('⚠️  Tabela payments não foi encontrada');
    }

    // Verificar índices
    console.log('\n🔍 Verificando índices...\n');
    const checkIndexes = await client.query(`
      SELECT
        indexname as "Nome do Índice",
        indexdef as "Definição"
      FROM pg_indexes
      WHERE tablename = 'payments'
      ORDER BY indexname;
    `);

    if (checkIndexes.rows.length > 0) {
      console.log(`✅ Índices criados: ${checkIndexes.rows.length}`);
      console.table(checkIndexes.rows.map(r => ({ Nome: r['Nome do Índice'] })));
    }

    // Verificar ENUMs
    console.log('\n🔍 Verificando ENUMs...\n');
    const checkEnums = await client.query(`
      SELECT
        e.enumlabel as "Valor"
      FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'payment_provider_enum'
      ORDER BY e.enumlabel;
    `);

    if (checkEnums.rows.length > 0) {
      console.log('✅ payment_provider_enum criado com valores:');
      console.log('   ' + checkEnums.rows.map(r => r.Valor).join(', '));
    }

    console.log('\n' + '═'.repeat(60));
    console.log('🎉 MIGRAÇÃO CONCLUÍDA COM SUCESSO!');
    console.log('═'.repeat(60));
    console.log('\n✅ Sistema pronto para:');
    console.log('   - Aceitar pagamentos PIX (Mercado Pago)');
    console.log('   - Aceitar pagamentos com Cartão (Stripe)');
    console.log('   - Processar webhooks');
    console.log('   - Entregar conteúdo automaticamente');
    console.log('\n📱 Teste agora fazendo uma compra no bot do Telegram!');
    console.log('');

  } catch (error) {
    console.error('\n❌ ERRO ao executar migração:');
    console.error('═'.repeat(60));

    if (error.code) {
      console.error(`Código: ${error.code}`);
    }

    console.error(`Mensagem: ${error.message}`);

    if (error.detail) {
      console.error(`Detalhe: ${error.detail}`);
    }

    if (error.hint) {
      console.error(`Dica: ${error.hint}`);
    }

    if (error.position) {
      console.error(`Posição no SQL: ${error.position}`);
    }

    console.error('═'.repeat(60));

    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }

    process.exit(1);
  } finally {
    // Fechar conexão
    if (client) {
      client.release();
    }
    await pool.end();
    console.log('📡 Conexão fechada');
  }
}

// Executar
executarMigracao();
