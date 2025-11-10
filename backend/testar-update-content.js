require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testarUpdate() {
  console.log('🔍 Testando se campos podem ser salvos no banco de dados...\n');

  // Pegar o primeiro conteúdo para teste
  const { data: contents, error: fetchError } = await supabase
    .from('content')
    .select('id, title')
    .limit(1)
    .single();

  if (fetchError || !contents) {
    console.error('❌ Erro ao buscar conteúdo:', fetchError);
    return;
  }

  console.log(`📝 Testando com: ${contents.title} (${contents.id})\n`);

  // Tentar atualizar com todos os campos (usando nomes corretos)
  const testData = {
    telegram_group_link: 'https://t.me/teste123',
    age_rating: 'L',
  };

  const { data: updated, error: updateError } = await supabase
    .from('content')
    .update(testData)
    .eq('id', contents.id)
    .select()
    .single();

  if (updateError) {
    console.error('❌ Erro ao atualizar:', updateError);
    return;
  }

  console.log('✅ Update bem-sucedido!\n');
  console.log('Campos atualizados:');
  console.log(`  telegram_group_link: ${updated.telegram_group_link || 'null'}`);
  console.log(`  age_rating: ${updated.age_rating || 'null'}`);

  // Verificar se os dados foram realmente salvos
  const { data: verified, error: verifyError } = await supabase
    .from('content')
    .select('telegram_group_link, age_rating')
    .eq('id', contents.id)
    .single();

  if (verifyError) {
    console.error('\n❌ Erro ao verificar:', verifyError);
    return;
  }

  console.log('\n🔍 Verificação (leitura direta do banco):');
  console.log(`  telegram_group_link: ${verified.telegram_group_link || 'null'}`);
  console.log(`  age_rating: ${verified.age_rating || 'null'}`);

  if (verified.telegram_group_link === testData.telegram_group_link &&
      verified.age_rating === testData.age_rating) {
    console.log('\n✅ SUCESSO! Todos os campos foram salvos corretamente!\n');
  } else {
    console.log('\n⚠️  AVISO: Alguns campos não foram salvos como esperado\n');
  }
}

testarUpdate().catch(console.error);
