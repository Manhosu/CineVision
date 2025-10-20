require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function generateAutoLoginLink(telegramId, redirectUrl = '/dashboard') {
  try {
    console.log(`\n🔍 Buscando usuário com telegram_id: ${telegramId}...`);

    // Buscar usuário pelo telegram_id
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, telegram_id, name, email')
      .eq('telegram_id', telegramId.toString())
      .single();

    if (userError || !user) {
      console.error('❌ Usuário não encontrado:', userError?.message);
      process.exit(1);
    }

    console.log('✅ Usuário encontrado:', {
      id: user.id,
      name: user.name,
      email: user.email,
      telegram_id: user.telegram_id,
    });

    // Gerar token seguro
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutos

    console.log('\n🔐 Gerando token de auto-login...');

    // Criar token no banco
    const { data: tokenData, error: tokenError } = await supabase
      .from('auto_login_tokens')
      .insert({
        token,
        user_id: user.id,
        telegram_id: telegramId.toString(),
        expires_at: expiresAt.toISOString(),
        redirect_url: redirectUrl,
        is_used: false,
      })
      .select()
      .single();

    if (tokenError) {
      console.error('❌ Erro ao criar token:', tokenError.message);
      process.exit(1);
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const loginUrl = `${frontendUrl}/auth/auto-login?token=${token}`;

    console.log('\n✅ Token gerado com sucesso!');
    console.log('\n📋 Informações do Token:');
    console.log('━'.repeat(60));
    console.log(`Token ID: ${tokenData.id}`);
    console.log(`Expira em: ${expiresAt.toLocaleString('pt-BR')}`);
    console.log(`Redirecionar para: ${redirectUrl}`);
    console.log('━'.repeat(60));
    console.log('\n🔗 Link de Auto-Login:');
    console.log('━'.repeat(60));
    console.log(loginUrl);
    console.log('━'.repeat(60));
    console.log('\n⚠️  Este link expira em 5 minutos e só pode ser usado uma vez.');
    console.log('\n');

    return loginUrl;
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

// Pegar telegram_id e redirect_url dos argumentos
const telegramId = process.argv[2];
const redirectUrl = process.argv[3] || '/dashboard';

if (!telegramId) {
  console.error('\n❌ Uso: node generate-auto-login.js <telegram_id> [redirect_url]');
  console.error('\nExemplo:');
  console.error('  node generate-auto-login.js 2006803983');
  console.error('  node generate-auto-login.js 2006803983 /dashboard/purchases');
  process.exit(1);
}

generateAutoLoginLink(telegramId, redirectUrl)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });
