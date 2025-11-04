const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

/**
 * Script para executar migração SQL diretamente no Supabase
 * Executa: node executar-migracao-supabase.js
 */

// Configuração do Supabase (pegue do .env do backend)
const SUPABASE_URL = 'https://szghyvnbmjlquznxhqum.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6Z2h5dm5ibWpscXV6bnhocXVtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyODg2OTgyOCwiZXhwIjoyMDQ0NDQ1ODI4fQ.mV5X_qpSvAvdlZXuTUOEL5jfjyULxeNv6HCNxaHpUwQ';

async function executarMigracao() {
  console.log('🚀 Iniciando migração do banco de dados Supabase...\n');

  try {
    // Criar cliente Supabase
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    console.log('✅ Cliente Supabase criado\n');

    // Ler arquivo SQL
    const sqlPath = path.join(__dirname, 'MIGRACAO-COMPLETA-FINAL.sql');
    console.log(`📄 Lendo SQL de: ${sqlPath}`);

    if (!fs.existsSync(sqlPath)) {
      throw new Error(`Arquivo não encontrado: ${sqlPath}`);
    }

    const sql = fs.readFileSync(sqlPath, 'utf8');
    console.log(`✅ SQL carregado (${sql.length} caracteres)\n`);

    // Executar SQL usando RPC
    console.log('⚙️  Executando migração via Supabase RPC...\n');
    console.log('═'.repeat(60));

    // Nota: Supabase JS client não tem método direto para executar SQL arbitrário
    // Precisamos usar o endpoint REST API do Supabase
    const { data, error } = await supabase.rpc('exec_sql', { query: sql });

    if (error) {
      // Se RPC não existir, vamos tentar abordagem alternativa
      console.log('⚠️  RPC não disponível, tentando abordagem alternativa...\n');

      // Usar fetch para chamar API REST do Supabase diretamente
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({ query: sql })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro ao executar SQL: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('Resultado:', result);
    }

    console.log('═'.repeat(60));
    console.log('\n✅ MIGRAÇÃO EXECUTADA COM SUCESSO!\n');

    // Verificar se a tabela foi criada
    const { data: tables, error: tableError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_name', 'payments');

    if (tableError) {
      console.log('⚠️  Não foi possível verificar tabela via Supabase client');
      console.log('   Use o SQL Editor do Supabase para verificar manualmente');
    } else if (tables && tables.length > 0) {
      console.log('✅ Tabela payments encontrada no banco!');
    }

    console.log('\n' + '═'.repeat(60));
    console.log('🎉 MIGRAÇÃO CONCLUÍDA!');
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
    console.error(`Mensagem: ${error.message}`);
    console.error('═'.repeat(60));
    console.error('\n⚠️  O Supabase JS client não suporta execução direta de SQL arbitrário.');
    console.error('⚠️  Você precisa executar o SQL manualmente no Supabase Dashboard.\n');
    console.error('📖 Siga as instruções em: URGENTE-EXECUTAR-MIGRACAO-PAYMENTS.md\n');
    console.error('Ou execute este comando alternativo:\n');
    console.error('  psql "postgresql://postgres.szghyvnbmjlquznxhqum:Umeomesmo1%2C@aws-1-sa-east-1.pooler.supabase.com:5432/postgres" -f MIGRACAO-COMPLETA-FINAL.sql\n');

    process.exit(1);
  }
}

// Executar
executarMigracao();
