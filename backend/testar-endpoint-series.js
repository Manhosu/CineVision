// Testar endpoint de séries do backend
require('dotenv').config();

const SERIES_ID = '33c1ce60-dec5-4ce5-b326-33814c0d470a';
const API_URL = process.env.BACKEND_URL || 'https://cinevisionn.onrender.com';

async function testarEndpoints() {
  console.log('\n🧪 TESTANDO ENDPOINTS DO BACKEND\n');
  console.log('API URL:', API_URL);
  console.log('Series ID:', SERIES_ID);
  console.log('='.repeat(60));

  // Test 1: Endpoint correto /series/:id
  console.log('\n1️⃣ Testando: GET /api/v1/content/series/' + SERIES_ID);
  try {
    const response1 = await fetch(`${API_URL}/api/v1/content/series/${SERIES_ID}`);
    console.log(`   Status: ${response1.status} ${response1.statusText}`);

    if (response1.ok) {
      const data = await response1.json();
      console.log('   ✅ SUCESSO!');
      console.log(`   Title: ${data.title}`);
      console.log(`   Content Type: ${data.content_type}`);
    } else {
      const error = await response1.text();
      console.log('   ❌ ERRO:', error);
    }
  } catch (error) {
    console.log('   ❌ EXCEÇÃO:', error.message);
  }

  // Test 2: Endpoint errado /movies/:id (o que o frontend está chamando)
  console.log('\n2️⃣ Testando: GET /api/v1/content/movies/' + SERIES_ID);
  try {
    const response2 = await fetch(`${API_URL}/api/v1/content/movies/${SERIES_ID}`);
    console.log(`   Status: ${response2.status} ${response2.statusText}`);

    if (response2.ok) {
      const data = await response2.json();
      console.log('   ⚠️ Retornou OK (não deveria!)');
      console.log(`   Title: ${data.title}`);
    } else {
      const error = await response2.json();
      console.log('   ❌ Retornou erro (esperado):');
      console.log(`   ${error.message}`);
    }
  } catch (error) {
    console.log('   ❌ EXCEÇÃO:', error.message);
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n📊 CONCLUSÃO:');
  console.log('   • Endpoint /series/:id deve retornar 200 OK');
  console.log('   • Endpoint /movies/:id deve retornar 404 Not Found');
  console.log('   • Se ambos funcionam, o problema está no FRONTEND');
  console.log('');
}

testarEndpoints().catch(console.error);
