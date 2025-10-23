const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function generateTelegramAutoLogin() {
  const telegramId = '2006803983';

  console.log('=== GERANDO LINK DE AUTO-LOGIN DO TELEGRAM ===\n');

  try {
    // 1. Buscar usuário pelo Telegram ID
    console.log('1. Buscando usuário com Telegram ID:', telegramId);
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, name, telegram_id')
      .eq('telegram_id', telegramId)
      .single();

    if (userError || !user) {
      console.log('❌ Usuário não encontrado');
      return;
    }

    console.log('✓ Usuário encontrado:', user.email);

    // 2. Verificar se já existe token ativo
    console.log('\n2. Verificando tokens existentes...');
    const { data: existingTokens } = await supabase
      .from('auto_login_tokens')
      .select('token, expires_at')
      .eq('user_id', user.id)
      .eq('telegram_id', telegramId)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1);

    if (existingTokens && existingTokens.length > 0) {
      const existingToken = existingTokens[0];
      const frontendUrl = process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_URL || 'https://cine-vision-six.vercel.app';
      const loginUrl = `${frontendUrl}/auth/auto-login?token=${existingToken.token}`;

      console.log('✓ Token existente encontrado (ainda válido)');
      console.log('\n🔗 LINK DE ACESSO:\n');
      console.log(loginUrl);
      console.log('\n⏰ Expira em:', new Date(existingToken.expires_at).toLocaleString('pt-BR'));
      console.log('\n✅ Use este link para acessar sua dashboard automaticamente!');
      return;
    }

    // 3. Gerar novo token
    console.log('✓ Nenhum token ativo encontrado, gerando novo...');
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 365 dias

    // 4. Salvar token no banco
    const { error: tokenError } = await supabase
      .from('auto_login_tokens')
      .insert({
        token,
        user_id: user.id,
        telegram_id: telegramId,
        expires_at: expiresAt.toISOString(),
        redirect_url: '/dashboard',
        is_used: false,
      });

    if (tokenError) {
      console.log('❌ Erro ao criar token:', tokenError.message);
      return;
    }

    console.log('✓ Token criado com sucesso');

    // 5. Gerar URL
    const frontendUrl = process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_URL || 'https://cine-vision-six.vercel.app';
    const loginUrl = `${frontendUrl}/auth/auto-login?token=${token}`;

    console.log('\n═══════════════════════════════════════════════════════\n');
    console.log('🔗 LINK DE AUTO-LOGIN DO TELEGRAM\n');
    console.log(loginUrl);
    console.log('\n═══════════════════════════════════════════════════════\n');
    console.log('📱 Telegram ID:', telegramId);
    console.log('📧 Email:', user.email);
    console.log('👤 Nome:', user.name || 'Não definido');
    console.log('⏰ Válido até:', expiresAt.toLocaleString('pt-BR'));
    console.log('📂 Redirecionamento: /dashboard (Meus Filmes)');
    console.log('\n✅ Clique no link acima para acessar automaticamente!\n');
    console.log('💡 Este é o mesmo link enviado pelo bot do Telegram após compras.\n');

  } catch (error) {
    console.error('\n❌ Erro:', error.message);
    process.exit(1);
  }
}

generateTelegramAutoLogin();
