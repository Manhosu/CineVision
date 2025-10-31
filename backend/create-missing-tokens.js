const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const supabaseUrl = 'https://szghyvnbmjlquznxhqum.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6Z2h5dm5ibWpscXV6bnhocXVtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODc0OTk5OSwiZXhwIjoyMDc0MzI1OTk5fQ.p9_G_CjLg8h2CVZqteKLdK9WUFKFdXSqTuTolHFiWGc';

const supabase = createClient(supabaseUrl, supabaseKey);

async function createMissingTokens() {
  console.log('🔑 CRIANDO TOKENS DE AUTO-LOGIN FALTANTES\n');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // 1. Buscar todos os usuários com telegram_id
  console.log('1️⃣ Buscando todos os usuários com telegram_id...');
  console.log('─────────────────────────────────────────────────────────────\n');

  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, name, email, telegram_id, telegram_chat_id')
    .not('telegram_id', 'is', null)
    .order('created_at', { ascending: false });

  if (usersError) {
    console.error('❌ Erro ao buscar usuários:', usersError);
    return;
  }

  console.log(`✅ Encontrados ${users.length} usuários com telegram_id\n`);

  // 2. Para cada usuário, verificar se tem token
  let usersWithTokens = 0;
  let usersWithoutTokens = 0;
  let tokensCreated = 0;
  let errors = 0;

  for (const user of users) {
    // Verificar se já tem token válido
    const { data: existingTokens } = await supabase
      .from('auto_login_tokens')
      .select('token, expires_at')
      .eq('user_id', user.id)
      .eq('telegram_id', user.telegram_id)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1);

    if (existingTokens && existingTokens.length > 0) {
      // Usuário já tem token
      usersWithTokens++;
      console.log(`✅ ${user.name || user.email} - Já tem token válido`);
    } else {
      // Usuário não tem token, criar
      usersWithoutTokens++;
      console.log(`⚠️  ${user.name || user.email} - SEM TOKEN, criando...`);

      try {
        // Gerar token seguro
        const token = crypto.randomBytes(32).toString('hex');

        // Token expira em 365 dias (1 ano)
        const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

        // Criar token no banco
        const { data: newToken, error: tokenError } = await supabase
          .from('auto_login_tokens')
          .insert({
            token,
            user_id: user.id,
            telegram_id: user.telegram_id,
            expires_at: expiresAt.toISOString(),
            redirect_url: '/dashboard',
            is_used: false,
          })
          .select()
          .single();

        if (tokenError) {
          console.log(`   ❌ ERRO ao criar token: ${tokenError.message}`);
          errors++;
        } else {
          console.log(`   ✅ Token criado com sucesso!`);
          console.log(`      Token: ${token.substring(0, 20)}...`);
          console.log(`      Expira em: ${expiresAt.toLocaleDateString()}`);
          tokensCreated++;

          // Logar no system_logs
          await supabase.from('system_logs').insert({
            type: 'auto_login',
            level: 'info',
            message: `Retroactive auto-login token created for user ${user.id} (${user.name}), telegram_id ${user.telegram_id}`,
          });
        }
      } catch (error) {
        console.log(`   ❌ ERRO: ${error.message}`);
        errors++;

        // Logar erro
        await supabase.from('system_logs').insert({
          type: 'auto_login',
          level: 'error',
          message: `Failed to create retroactive token for user ${user.id}: ${error.message}`,
        });
      }
    }

    console.log('');
  }

  // RESUMO
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('📊 RESUMO DA OPERAÇÃO');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log(`Total de usuários com telegram_id: ${users.length}`);
  console.log(`\n🔑 Tokens:`);
  console.log(`   ✅ Usuários que já tinham token: ${usersWithTokens}`);
  console.log(`   ⚠️  Usuários sem token (antes): ${usersWithoutTokens}`);
  console.log(`   ✅ Tokens criados com sucesso: ${tokensCreated}`);
  console.log(`   ❌ Erros na criação: ${errors}`);

  const successRate = usersWithoutTokens > 0 ? (tokensCreated / usersWithoutTokens * 100).toFixed(1) : 100;
  console.log(`\n📈 Taxa de sucesso: ${successRate}%`);

  if (tokensCreated > 0) {
    console.log(`\n✅ ${tokensCreated} token(s) criado(s) com sucesso!`);
    console.log('   Agora todos os usuários podem acessar o dashboard via auto-login.\n');
  } else if (usersWithoutTokens === 0) {
    console.log('\n✅ Todos os usuários já possuem tokens válidos!');
    console.log('   Nenhuma ação necessária.\n');
  } else {
    console.log('\n⚠️  Alguns tokens não puderam ser criados. Verifique os erros acima.\n');
  }

  console.log('═══════════════════════════════════════════════════════════════\n');
}

createMissingTokens().catch(error => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});
