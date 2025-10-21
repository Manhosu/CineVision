require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixRedirectUrl(tokenString) {
  try {
    // Atualizar o redirect_url do token
    const { data, error } = await supabase
      .from('auto_login_tokens')
      .update({
        redirect_url: '/',
        is_used: false // Garantir que pode ser reutilizado
      })
      .eq('token', tokenString)
      .select()
      .single();

    if (error) {
      console.error('❌ Erro:', error.message);
      return;
    }

    console.log('✅ Token atualizado com sucesso!');
    console.log('   Redirect URL:', data.redirect_url);
    console.log('   Is Used:', data.is_used);
    console.log('   Expires At:', new Date(data.expires_at).toLocaleString('pt-BR'));
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

const token = process.argv[2];
if (!token) {
  console.error('❌ Uso: node fix-redirect-url.js <token>');
  process.exit(1);
}

fixRedirectUrl(token).then(() => process.exit(0));
