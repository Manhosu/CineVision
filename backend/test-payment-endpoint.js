/**
 * Script to test payment endpoint and diagnose payment link generation errors
 * Run: node test-payment-endpoint.js
 */

require('dotenv').config();
const axios = require('axios');

const API_URL = process.env.API_URL || 'http://localhost:3000';
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

async function testPaymentEndpoint() {
  console.log('🔍 Diagnosticando sistema de pagamentos\n');

  // Test 1: Check environment variables
  console.log('1️⃣  Verificando variáveis de ambiente:');
  console.log(`   STRIPE_SECRET_KEY: ${STRIPE_SECRET_KEY ? '✅ Configurado (' + STRIPE_SECRET_KEY.substring(0, 10) + '...)' : '❌ Não encontrado'}`);
  console.log(`   STRIPE_PUBLISHABLE_KEY: ${STRIPE_PUBLISHABLE_KEY ? '✅ Configurado (' + STRIPE_PUBLISHABLE_KEY.substring(0, 10) + '...)' : '❌ Não encontrado'}`);
  console.log(`   STRIPE_WEBHOOK_SECRET: ${STRIPE_WEBHOOK_SECRET ? '✅ Configurado' : '⚠️  Não configurado'}`);
  console.log(`   API_URL: ${API_URL}\n`);

  if (!STRIPE_SECRET_KEY) {
    console.error('❌ ERRO CRÍTICO: STRIPE_SECRET_KEY não encontrado no .env');
    console.log('\n💡 Configure no arquivo .env:');
    console.log('   STRIPE_SECRET_KEY=sk_test_... (para testes)');
    console.log('   STRIPE_SECRET_KEY=sk_live_... (para produção)\n');
    process.exit(1);
  }

  // Test 2: Check Stripe API connectivity
  console.log('2️⃣  Testando conectividade com Stripe API:');
  try {
    const stripe = require('stripe')(STRIPE_SECRET_KEY);
    const balance = await stripe.balance.retrieve();
    console.log('✅ Conexão com Stripe OK');
    console.log(`   Modo: ${STRIPE_SECRET_KEY.startsWith('sk_live_') ? 'PRODUÇÃO' : 'TESTE'}`);
    console.log(`   Saldo disponível: ${balance.available.length} moedas configuradas\n`);
  } catch (error) {
    console.error('❌ Erro ao conectar com Stripe:', error.message);
    if (error.type === 'StripeAuthenticationError') {
      console.log('\n💡 A chave do Stripe parece estar incorreta ou expirada.');
      console.log('   Verifique em: https://dashboard.stripe.com/apikeys\n');
    }
    process.exit(1);
  }

  // Test 3: Check if backend API is running
  console.log('3️⃣  Verificando se o backend está rodando:');
  try {
    const response = await axios.get(`${API_URL}/api/v1/health`, { timeout: 5000 });
    console.log('✅ Backend está online\n');
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.error('❌ Backend não está rodando');
      console.log('\n💡 Inicie o backend com:');
      console.log('   cd backend && npm run start:dev\n');
      process.exit(1);
    } else if (error.response?.status === 404) {
      console.log('⚠️  Endpoint /api/v1/health não encontrado, mas backend está respondendo\n');
    } else {
      console.warn('⚠️  Erro ao verificar backend:', error.message, '\n');
    }
  }

  // Test 4: Show test purchase creation instructions
  console.log('4️⃣  Como testar criação de pagamento:\n');
  console.log('   Para testar o endpoint de criação de pagamento, você precisa:');
  console.log('   a) Ter uma compra (purchase) criada no banco de dados');
  console.log('   b) Ter um usuário com chat_id do Telegram');
  console.log('   c) Chamar o endpoint com os dados corretos\n');

  console.log('📋 Query para encontrar uma compra de teste:\n');
  console.log('```sql');
  console.log('SELECT p.id, p.user_id, p.status, c.title, c.price_cents, u.telegram_chat_id');
  console.log('FROM purchases p');
  console.log('JOIN content c ON p.content_id = c.id');
  console.log('JOIN users u ON p.user_id = u.id');
  console.log('WHERE p.status = \'pending\'');
  console.log('  AND u.telegram_chat_id IS NOT NULL');
  console.log('ORDER BY p.created_at DESC');
  console.log('LIMIT 5;');
  console.log('```\n');

  // Test 5: Show example API call
  console.log('5️⃣  Exemplo de chamada ao endpoint de criação de pagamento:\n');
  console.log('```javascript');
  console.log('const response = await axios.post(`${API_URL}/api/v1/payments/create`, {');
  console.log('  purchase_id: "uuid-da-compra",');
  console.log('  payment_method: "card", // ou "pix"');
  console.log('});');
  console.log('');
  console.log('console.log("Payment URL:", response.data.payment_url);');
  console.log('```\n');

  // Test 6: Check for common issues
  console.log('6️⃣  Verificações adicionais:\n');

  console.log('   ⚠️  Possíveis causas do erro "erro ao gerar link de pagamento":\n');
  console.log('   1. Chave do Stripe incorreta ou expirada');
  console.log('   2. Compra já foi paga (status !== "pending")');
  console.log('   3. Produto/Preço do Stripe não foi criado corretamente');
  console.log('   4. Webhook do Stripe não está configurado');
  console.log('   5. Erro de rede ao chamar API do Stripe');
  console.log('   6. Success/Cancel URLs inválidas na criação da sessão\n');

  console.log('   🔍 Para debug detalhado, verifique os logs:\n');
  console.log('```sql');
  console.log('-- Logs recentes de pagamento');
  console.log('SELECT created_at, level, type, message');
  console.log('FROM system_logs');
  console.log('WHERE message ILIKE \'%payment%\' OR message ILIKE \'%stripe%\'');
  console.log('ORDER BY created_at DESC');
  console.log('LIMIT 20;');
  console.log('```\n');

  // Test 7: Stripe product/price verification
  console.log('7️⃣  Verificando produtos no Stripe:');
  try {
    const stripe = require('stripe')(STRIPE_SECRET_KEY);
    const products = await stripe.products.list({ limit: 5 });

    if (products.data.length === 0) {
      console.log('⚠️  Nenhum produto encontrado no Stripe');
      console.log('   Produtos serão criados automaticamente na primeira compra\n');
    } else {
      console.log(`✅ ${products.data.length} produtos encontrados no Stripe:`);
      products.data.forEach(product => {
        console.log(`   • ${product.name} (ID: ${product.id})`);
      });
      console.log('');
    }
  } catch (error) {
    console.error('❌ Erro ao listar produtos:', error.message, '\n');
  }

  // Test 8: Webhook configuration check
  console.log('8️⃣  Verificando configuração de webhooks:\n');
  if (!STRIPE_WEBHOOK_SECRET) {
    console.log('⚠️  STRIPE_WEBHOOK_SECRET não configurado');
    console.log('   Configure o webhook em: https://dashboard.stripe.com/webhooks');
    console.log('   Endpoint: ${API_URL}/api/v1/stripe/webhook');
    console.log('   Eventos necessários:');
    console.log('   - checkout.session.completed');
    console.log('   - payment_intent.succeeded');
    console.log('   - payment_intent.payment_failed\n');
  } else {
    console.log('✅ STRIPE_WEBHOOK_SECRET configurado\n');
  }

  console.log('✅ Diagnóstico concluído!');
  console.log('\n💡 Próximos passos:');
  console.log('   1. Se Stripe está OK, teste criando uma compra real via bot');
  console.log('   2. Monitore os logs do backend durante a criação do pagamento');
  console.log('   3. Verifique os logs do Stripe Dashboard para erros de API');
  console.log('   4. Se o erro persistir, compartilhe os logs para análise detalhada\n');
}

testPaymentEndpoint().catch(error => {
  console.error('\n❌ Erro durante diagnóstico:', error.message);
  process.exit(1);
});
