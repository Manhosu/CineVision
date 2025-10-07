const { Client } = require('pg');
require('dotenv').config();

async function testSupabaseConnection() {
  console.log('🔍 Testando conexão com Supabase...\n');

  const connectionString = process.env.SUPABASE_DATABASE_URL;
  console.log('📡 URL de conexão:', connectionString ? 'Configurada' : 'Não encontrada');

  if (!connectionString) {
    console.error('❌ SUPABASE_DATABASE_URL não está configurada');
    return;
  }

  const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('⏳ Conectando...');
    await client.connect();
    console.log('✅ Conexão estabelecida com sucesso!');

    // Test query
    console.log('⏳ Executando query de teste...');
    const result = await client.query('SELECT COUNT(*) as count FROM content');
    console.log(`✅ Query executada! Encontrados ${result.rows[0].count} registros na tabela content`);

    // Test specific query for movies
    const moviesResult = await client.query("SELECT title, poster_url FROM content WHERE content_type = 'movie' LIMIT 5");
    console.log(`✅ Encontrados ${moviesResult.rows.length} filmes:`);
    moviesResult.rows.forEach((movie, index) => {
      console.log(`  ${index + 1}. ${movie.title} - Poster: ${movie.poster_url ? 'Sim' : 'Não'}`);
    });

  } catch (error) {
    console.error('❌ Erro na conexão:', error.message);
    console.error('📋 Detalhes do erro:', error);
  } finally {
    await client.end();
    console.log('🔌 Conexão fechada');
  }
}

testSupabaseConnection().catch(console.error);