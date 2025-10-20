require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.SUPABASE_DATABASE_URL,
});

async function reloadSchema() {
  console.log('🔄 Tentando recarregar schema do PostgREST...\n');

  try {
    // PostgREST escuta por notificações no canal "pgrst" para recarregar o schema
    await pool.query("NOTIFY pgrst, 'reload schema'");
    console.log('✅ Comando NOTIFY enviado com sucesso!');

    // Aguardar um pouco para o schema recarregar
    console.log('⏳ Aguardando 3 segundos para o schema recarregar...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('✅ Schema deve ter sido recarregado!');
    console.log('\n💡 Tente fazer o pagamento PIX novamente no Telegram.');

  } catch (error) {
    console.error('❌ Erro ao enviar NOTIFY:', error);
  } finally {
    await pool.end();
  }
}

reloadSchema();
