require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const updates = [
  {
    id: '73f179fc-28a2-44ea-8cff-71da36e28c31',
    storage_key: 'videos/c7ed9623-7bcb-4c13-91b7-6f96b76facd1/languages/dubbed-pt-BR/1760228827742-Lilo-Stitch-2025-DUBLADO.mp4',
    title: 'Lilo & Stitch - Dublado'
  },
  {
    id: '52810597-8279-4097-b69c-46edd1dc98b5',
    storage_key: 'videos/c7ed9623-7bcb-4c13-91b7-6f96b76facd1/languages/subtitled-pt-BR/1760228827742-Lilo-Stitch-2025-LEGENDADO.mp4',
    title: 'Lilo & Stitch - Legendado'
  },
  {
    id: 'aeb48abb-d62e-4811-ac3c-8fb766f7fb1b',
    storage_key: 'videos/f8e60daf-1e94-43b4-b9fe-c6f96c8f5a9c/languages/dubbed-pt-BR/1760228833502-Monster-2025-DUBLADO.mp4',
    title: 'A Hora do Mal - Dublado (da5a57f3)'
  },
  {
    id: 'b57ef5b4-1eec-4dd2-a978-24612c5c2d37',
    storage_key: 'videos/f8e60daf-1e94-43b4-b9fe-c6f96c8f5a9c/languages/subtitled-pt-BR/1760228833502-Monster-2025-LEGENDADO.mp4',
    title: 'A Hora do Mal - Legendado (da5a57f3)'
  },
  {
    id: 'c5ab0f45-0cf6-410a-8dd7-eeccd0917285',
    storage_key: 'videos/f8e60daf-1e94-43b4-b9fe-c6f96c8f5a9c/languages/dubbed-pt-BR/1760228833502-Monster-2025-DUBLADO.mp4',
    title: 'A Hora do Mal - Dublado (92f208c7)'
  },
];

async function updateKeys() {
  console.log('🔄 Atualizando storage_keys no banco de dados\n');

  for (const update of updates) {
    console.log(`📝 ${update.title}`);
    console.log(`   ID: ${update.id}`);
    console.log(`   Key: ${update.storage_key}`);

    const { error } = await supabase
      .from('content_languages')
      .update({ storage_key: update.storage_key })
      .eq('id', update.id);

    if (error) {
      console.log(`   ❌ Erro: ${error.message}\n`);
    } else {
      console.log(`   ✅ Atualizado\n`);
    }
  }

  console.log('\n✅ Atualizações concluídas!');
}

updateKeys().catch(console.error);
