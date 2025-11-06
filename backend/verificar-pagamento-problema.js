const { Pool } = require('pg');

async function verificarPagamento() {
  const pool = new Pool({
    host: 'aws-1-sa-east-1.pooler.supabase.com',
    port: 5432,
    user: 'postgres.szghyvnbmjlquznxhqum',
    password: 'Umeomesmo1,',
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔍 Verificando pagamento ID: 132473428744\n');

    // Buscar por provider_payment_id
    const result = await pool.query(`
      SELECT
        p.id as payment_id,
        p.purchase_id,
        p.provider,
        p.payment_method,
        p.status,
        p.amount_cents,
        p.provider_payment_id,
        p.created_at,
        pur.user_id,
        pur.content_id,
        pur.status as purchase_status
      FROM payments p
      LEFT JOIN purchases pur ON p.purchase_id = pur.id
      WHERE p.provider_payment_id = '132473428744'
      ORDER BY p.created_at DESC
      LIMIT 1;
    `);

    if (result.rows.length === 0) {
      console.log('❌ Pagamento não encontrado no banco de dados!');
      console.log('\n📋 Buscando pagamentos recentes do Mercado Pago...\n');

      // Buscar todos os pagamentos PIX recentes
      const recentPayments = await pool.query(`
        SELECT
          p.id,
          p.provider_payment_id,
          p.status,
          p.amount_cents,
          p.created_at
        FROM payments p
        WHERE p.provider = 'mercadopago'
          AND p.payment_method = 'pix'
          AND p.created_at > NOW() - INTERVAL '48 hours'
        ORDER BY p.created_at DESC
        LIMIT 10;
      `);

      console.log(`✅ Encontrados ${recentPayments.rows.length} pagamentos PIX recentes:\n`);
      recentPayments.rows.forEach((pay, idx) => {
        console.log(`${idx + 1}. ID: ${pay.provider_payment_id} | Status: ${pay.status} | R$ ${(pay.amount_cents / 100).toFixed(2)} | ${pay.created_at}`);
      });
    } else {
      const payment = result.rows[0];
      console.log('✅ Pagamento encontrado!\n');
      console.log('📊 Detalhes do Pagamento:');
      console.log(`   Payment ID: ${payment.payment_id}`);
      console.log(`   Purchase ID: ${payment.purchase_id}`);
      console.log(`   Provider: ${payment.provider}`);
      console.log(`   Payment Method: ${payment.payment_method}`);
      console.log(`   Status: ${payment.status}`);
      console.log(`   Amount: R$ ${(payment.amount_cents / 100).toFixed(2)}`);
      console.log(`   Provider Payment ID: ${payment.provider_payment_id}`);
      console.log(`   Created At: ${payment.created_at}`);
      console.log(`   User ID: ${payment.user_id}`);
      console.log(`   Purchase Status: ${payment.purchase_status}`);
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await pool.end();
  }
}

verificarPagamento();
