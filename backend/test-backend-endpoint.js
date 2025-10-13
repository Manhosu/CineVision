async function testBackendEndpoint() {
  console.log('🔍 Testando endpoint do backend para gerar URLs assinadas\n');

  // IDs dos vídeos
  const videos = [
    {
      title: 'Lilo & Stitch - Dublado',
      languageId: '73f179fc-28a2-44ea-8cff-71da36e28c31'
    },
    {
      title: 'Lilo & Stitch - Legendado',
      languageId: '52810597-8279-4097-b69c-46edd1dc98b5'
    },
    {
      title: 'A Hora do Mal - Dublado',
      languageId: 'aeb48abb-d62e-4811-ac3c-8fb766f7fb1b'
    },
    {
      title: 'A Hora do Mal - Legendado',
      languageId: 'b57ef5b4-1eec-4dd2-a978-24612c5c2d37'
    }
  ];

  console.log('🎬 Testando 4 vídeos:\n');

  for (let i = 0; i < videos.length; i++) {
    const video = videos[i];
    console.log(`[${i + 1}/4] ${video.title}`);

    try {
      // 1. Chamar endpoint do backend
      const url = `http://localhost:3001/api/content-language/public/video-url/${video.languageId}`;
      console.log(`   📡 Chamando: ${url}`);

      const response = await fetch(url);

      if (!response.ok) {
        console.log(`   ❌ Backend retornou ${response.status}`);
        continue;
      }

      const data = await response.json();
      console.log(`   ✅ Backend retornou URL assinada`);

      // 2. Testar se a URL funciona
      console.log(`   🧪 Testando URL assinada...`);
      const videoResponse = await fetch(data.url, { method: 'HEAD' });

      if (videoResponse.status === 200) {
        console.log(`   ✅ URL funciona! (200 OK)`);
        console.log(`   ⏰ Expira em: ${data.expires_in} segundos\n`);
      } else {
        console.log(`   ❌ URL retorna ${videoResponse.status}\n`);
      }

    } catch (error) {
      console.log(`   ❌ Erro: ${error.message}\n`);
    }
  }

  console.log('✅ Teste concluído!\n');
}

testBackendEndpoint();
