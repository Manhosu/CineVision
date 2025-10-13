async function testBackendEndpoint() {
  console.log('🧪 TESTANDO ENDPOINT DO BACKEND\n');
  console.log('='.repeat(70) + '\n');

  // IDs dos filmes
  const contentIds = {
    'Lilo & Stitch': 'c7ed9623-7bcb-4c13-91b7-6f96b76facd1',
    'A Hora do Mal': 'f8e60daf-1e94-43b4-b9fe-c6f96c8f5a9c',
  };

  for (const [title, id] of Object.entries(contentIds)) {
    console.log('🎬', title);
    console.log('   ID:', id);

    try {
      const response = await fetch(`http://localhost:3001/api/content/movies/${id}`);

      if (!response.ok) {
        console.log('   ❌ Status:', response.status);
        continue;
      }

      const data = await response.json();

      console.log('   ✅ Response OK');
      console.log('   Languages:', data.languages?.length || 0);

      if (data.languages) {
        for (const lang of data.languages) {
          console.log(`     - ${lang.language_type}/${lang.language_code}`);
          console.log('       video_url:', lang.video_url ? '✅' : '❌');
          console.log('       video_storage_key:', lang.video_storage_key ? '✅' : '❌');
          if (lang.video_url) {
            console.log('       URL:', lang.video_url.substring(0, 60) + '...');
          }
        }
      }

      console.log();
    } catch (error) {
      console.log('   ❌ Error:', error.message);
      console.log();
    }
  }

  console.log('='.repeat(70));
}

testBackendEndpoint().catch(console.error);
