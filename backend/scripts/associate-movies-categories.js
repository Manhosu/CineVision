const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function associateMoviesToCategories() {
  console.log('Iniciando associação de filmes às categorias...\n');

  const associations = [
    // Superman: Ação, Ficção Científica, Aventura
    { movie_id: '7ef17049-402d-49d5-bf7d-12811f2f4c45', movie: 'Superman', categories: [
      { id: '7b8a49aa-3da5-4e0e-9dca-5db9b4549852', name: 'Ação' },
      { id: '253c67ec-2e3f-4bda-bc18-3dbb7ea3f739', name: 'Ficção Científica' },
      { id: '042ed4a7-5833-4a4d-8249-833f10139357', name: 'Aventura' }
    ]},
    // Como Treinar o Seu Dragão: Aventura, Animação
    { movie_id: 'ec38b056-0b6e-48d8-9d94-b5081e0b7855', movie: 'Como Treinar o Seu Dragão', categories: [
      { id: '042ed4a7-5833-4a4d-8249-833f10139357', name: 'Aventura' },
      { id: '1dbb0cd5-23af-4502-a968-03e699e5c02a', name: 'Animação' }
    ]},
    // F1 - O Filme: Drama, Ação
    { movie_id: '0b2dfa6d-782d-4982-83d3-490fea4bfc5b', movie: 'F1 - O Filme', categories: [
      { id: '010c9ad1-25f9-4b0f-bbec-ffeaa99be8fa', name: 'Drama' },
      { id: '7b8a49aa-3da5-4e0e-9dca-5db9b4549852', name: 'Ação' }
    ]},
    // A Hora do Mal: Suspense, Terror
    { movie_id: 'da5a57f3-a4d8-41d7-bffd-3f46042b55ea', movie: 'A Hora do Mal', categories: [
      { id: '09e20f1c-dbc4-4dba-8885-2c326cad9bcf', name: 'Suspense' },
      { id: '6942efb8-3682-4453-91a4-2f82e4c50433', name: 'Terror' }
    ]},
    // Quarteto Fantástico 4: Ação, Ficção Científica, Aventura
    { movie_id: 'f1465fe2-8b04-4522-8c97-56b725270312', movie: 'Quarteto Fantástico 4', categories: [
      { id: '7b8a49aa-3da5-4e0e-9dca-5db9b4549852', name: 'Ação' },
      { id: '253c67ec-2e3f-4bda-bc18-3dbb7ea3f739', name: 'Ficção Científica' },
      { id: '042ed4a7-5833-4a4d-8249-833f10139357', name: 'Aventura' }
    ]},
    // Invocação do Mal 4: Terror, Suspense
    { movie_id: 'cea7478d-abcd-4039-bb1b-b15839da4cfe', movie: 'Invocação do Mal 4', categories: [
      { id: '6942efb8-3682-4453-91a4-2f82e4c50433', name: 'Terror' },
      { id: '09e20f1c-dbc4-4dba-8885-2c326cad9bcf', name: 'Suspense' }
    ]},
    // Demon Slayer: Ação, Aventura, Animação
    { movie_id: '42a1ec67-6136-4855-87ee-e1fb676e1370', movie: 'Demon Slayer', categories: [
      { id: '7b8a49aa-3da5-4e0e-9dca-5db9b4549852', name: 'Ação' },
      { id: '042ed4a7-5833-4a4d-8249-833f10139357', name: 'Aventura' },
      { id: '1dbb0cd5-23af-4502-a968-03e699e5c02a', name: 'Animação' }
    ]},
    // A Longa Marcha: Terror, Suspense, Drama
    { movie_id: '560796b5-f5dd-4b02-a769-0f4f5df22892', movie: 'A Longa Marcha', categories: [
      { id: '6942efb8-3682-4453-91a4-2f82e4c50433', name: 'Terror' },
      { id: '09e20f1c-dbc4-4dba-8885-2c326cad9bcf', name: 'Suspense' },
      { id: '010c9ad1-25f9-4b0f-bbec-ffeaa99be8fa', name: 'Drama' }
    ]},
    // Jurassic World: Aventura, Ação, Ficção Científica
    { movie_id: '22311a9e-8aac-4fad-b62c-175468296bf6', movie: 'Jurassic World', categories: [
      { id: '042ed4a7-5833-4a4d-8249-833f10139357', name: 'Aventura' },
      { id: '7b8a49aa-3da5-4e0e-9dca-5db9b4549852', name: 'Ação' },
      { id: '253c67ec-2e3f-4bda-bc18-3dbb7ea3f739', name: 'Ficção Científica' }
    ]},
    // Lilo & Stitch: Comédia, Aventura, Animação
    { movie_id: 'c7ed9623-7bcb-4c13-91b7-6f96b76facd1', movie: 'Lilo & Stitch', categories: [
      { id: '314477dd-8e64-4f60-b796-ceb2eea73d87', name: 'Comédia' },
      { id: '042ed4a7-5833-4a4d-8249-833f10139357', name: 'Aventura' },
      { id: '1dbb0cd5-23af-4502-a968-03e699e5c02a', name: 'Animação' }
    ]}
  ];

  for (const assoc of associations) {
    console.log(`\nProcessando: ${assoc.movie}`);

    // Limpar associações antigas
    const { error: deleteError } = await supabase
      .from('content_categories')
      .delete()
      .eq('content_id', assoc.movie_id);

    if (deleteError) {
      console.error(`  Erro ao limpar associações antigas: ${deleteError.message}`);
      continue;
    }

    // Inserir novas associações
    for (const category of assoc.categories) {
      const { error: insertError } = await supabase
        .from('content_categories')
        .insert({
          content_id: assoc.movie_id,
          category_id: category.id
        });

      if (insertError) {
        console.error(`  Erro ao associar com ${category.name}: ${insertError.message}`);
      } else {
        console.log(`  ✓ Associado com ${category.name}`);
      }
    }
  }

  console.log('\n✅ Processo concluído!');
}

associateMoviesToCategories()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Erro:', error);
    process.exit(1);
  });
