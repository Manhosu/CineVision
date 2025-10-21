require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateTokenExpiration(telegramId) {
  try {
    console.log(`\n🔍 Buscando usuário com telegram_id: ${telegramId}...`);

    // Buscar usuário
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
    });

    // Atualizar TODOS os tokens deste usuário para expirar em 365 dias
    const newExpiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

    console.log('\n🔄 Atualizando expiração de todos os tokens...');

    const { data: updatedTokens, error: updateError } = await supabase
      .from('auto_login_tokens')
      .update({
        expires_at: newExpiresAt.toISOString(),
        is_used: false, // Permitir reutilização
      })
      .eq('user_id', user.id)
      .select();

    if (updateError) {
      console.error('❌ Erro ao atualizar tokens:', updateError.message);
      process.exit(1);
    }

    console.log(`✅ ${updatedTokens.length} token(s) atualizado(s)!`);
    console.log('\n📋 Tokens permanentes:');
    console.log('━'.repeat(80));

    updatedTokens.forEach((token, index) => {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const loginUrl = `${frontendUrl}/auth/auto-login?token=${token.token}`;
      const redirectUrl = token.redirect_url || '/dashboard';

      console.log(`\n${index + 1}. Token ID: ${token.id}`);
      console.log(`   Redireciona para: ${redirectUrl}`);
      console.log(`   Expira em: ${new Date(token.expires_at).toLocaleString('pt-BR')}`);
      console.log(`   Link: ${loginUrl}`);
    });

    console.log('\n━'.repeat(80));
    console.log('\n✅ Todos os links agora são PERMANENTES (365 dias) e reutilizáveis!');
    console.log('\n');
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

const telegramId = process.argv[2] || '2006803983';
updateTokenExpiration(telegramId)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });
