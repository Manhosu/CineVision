require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkKeys() {
  console.log('🔍 Verificando IDs no banco\n');

  // Verificar content
  const { data: contents, error: contentsError } = await supabase
    .from('content')
    .select('*')
    .or('title.ilike.%Lilo%,title.ilike.%Hora%');

  if (contentsError) {
    console.error('Erro ao buscar contents:', contentsError);
    return;
  }

  console.log(`📋 Encontrados ${contents?.length || 0} conteúdos\n`);

  if (!contents || contents.length === 0) {
    console.log('❌ Nenhum conteúdo encontrado!');
    return;
  }

  for (const content of contents) {
    console.log(`🎬 ${content.title}`);
    console.log(`   ID: ${content.id}\n`);

    // Buscar languages para este content
    const { data: languages, error: langError } = await supabase
      .from('content_languages')
      .select('*')
      .eq('content_id', content.id);

    if (langError) {
      console.error(`   Erro ao buscar languages:`, langError);
      continue;
    }

    if (!languages || languages.length === 0) {
      console.log(`   ⚠️  Nenhum idioma encontrado para este conteúdo\n`);
      continue;
    }

    languages.forEach(lang => {
      console.log(`   📝 ${lang.language_type}:`);
      console.log(`      Language ID: ${lang.id}`);
      console.log(`      Storage Key: ${lang.storage_key}\n`);
    });
  }
}

checkKeys().catch(console.error);
