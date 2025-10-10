const API_URL = 'http://localhost:3001/api/v1';

async function testEndpoint(name, url) {
  try {
    console.log(`\n🧪 Testando: ${name}`);
    console.log(`   URL: ${url}`);

    const response = await fetch(url);

    if (!response.ok) {
      console.log(`   ❌ Erro HTTP: ${response.status} ${response.statusText}`);
      return false;
    }

    const data = await response.json();

    // Para endpoints de filmes
    if (data.movies !== undefined) {
      console.log(`   ✅ Sucesso: ${data.movies.length} filmes`);
      console.log(`   📊 Total: ${data.total || 0}`);
      console.log(`   📄 Página: ${data.page || 1}/${data.totalPages || 1}`);

      if (data.movies.length > 0) {
        const first = data.movies[0];
        console.log(`   🎬 Exemplo: ${first.title}`);
      }
      return true;
    }

    // Para endpoint de categorias
    if (Array.isArray(data)) {
      console.log(`   ✅ Sucesso: ${data.length} categorias`);
      if (data.length > 0) {
        console.log(`   📁 Exemplos: ${data.slice(0, 3).map(c => c.name).join(', ')}`);
      }
      return true;
    }

    console.log(`   ⚠️  Resposta inesperada:`, typeof data);
    return false;
  } catch (error) {
    console.log(`   ❌ Erro: ${error.message}`);
    return false;
  }
}

async function runTests() {
  console.log('\n🔍 TESTANDO FILTROS E ENDPOINTS DA API\n');
  console.log('='.repeat(80));

  const tests = [
    {
      name: 'Listar todos os filmes (padrão)',
      url: `${API_URL}/content/movies`
    },
    {
      name: 'Listar filmes - página 2',
      url: `${API_URL}/content/movies?page=2&limit=5`
    },
    {
      name: 'Filtro: Ordenar por mais novos',
      url: `${API_URL}/content/movies?sort=newest`
    },
    {
      name: 'Filtro: Ordenar por popularidade',
      url: `${API_URL}/content/movies?sort=popular`
    },
    {
      name: 'Filtro: Ordenar por avaliação',
      url: `${API_URL}/content/movies?sort=rating`
    },
    {
      name: 'Filtro: Ordenar por menor preço',
      url: `${API_URL}/content/movies?sort=price_low`
    },
    {
      name: 'Filtro: Ordenar por maior preço',
      url: `${API_URL}/content/movies?sort=price_high`
    },
    {
      name: 'Filtro: Categoria - Ação',
      url: `${API_URL}/content/movies?genre=Ação`
    },
    {
      name: 'Filtro: Categoria - Animação',
      url: `${API_URL}/content/movies?genre=Animação`
    },
    {
      name: 'Filtro: Categoria - Terror',
      url: `${API_URL}/content/movies?genre=Terror`
    },
    {
      name: 'Filtro: Categoria - Drama',
      url: `${API_URL}/content/movies?genre=Drama`
    },
    {
      name: 'Filtro: Categoria - Ficção Científica',
      url: `${API_URL}/content/movies?genre=Ficção Científica`
    },
    {
      name: 'Filtro: Categoria - Aventura',
      url: `${API_URL}/content/movies?genre=Aventura`
    },
    {
      name: 'Filtro: Combinado - Ação + Popular',
      url: `${API_URL}/content/movies?genre=Ação&sort=popular`
    },
    {
      name: 'Filtro: Combinado - Terror + Novos',
      url: `${API_URL}/content/movies?genre=Terror&sort=newest`
    },
    {
      name: 'Listar todas as categorias',
      url: `${API_URL}/content/categories`
    },
    {
      name: 'Top 10 filmes',
      url: `${API_URL}/content/top10/films`
    }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    const success = await testEndpoint(test.name, test.url);
    if (success) {
      passed++;
    } else {
      failed++;
    }

    // Aguardar 100ms entre requisições
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('\n' + '='.repeat(80));
  console.log('\n📊 RESUMO DOS TESTES:\n');
  console.log(`   ✅ Passou: ${passed}/${tests.length}`);
  console.log(`   ❌ Falhou: ${failed}/${tests.length}`);
  console.log(`   📈 Taxa de sucesso: ${Math.round((passed/tests.length) * 100)}%`);

  if (failed === 0) {
    console.log('\n✨ Todos os filtros estão funcionando perfeitamente!');
  } else {
    console.log('\n⚠️  Alguns filtros precisam de atenção.');
  }

  console.log('\n' + '='.repeat(80) + '\n');
}

runTests()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });
