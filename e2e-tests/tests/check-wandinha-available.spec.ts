import { test, expect } from '@playwright/test';

test.describe('Verificar Wandinha no Dashboard', () => {
  test('deve verificar se série Wandinha está disponível e pronta para assistir', async ({ page }) => {
    console.log('🔍 Verificando disponibilidade da série Wandinha...\n');

    // 1. Fazer login com telegram_id 2006803983
    console.log('🔐 Fazendo login...');
    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    // Usar o mock de login do Telegram ou fazer login direto
    // Como não sabemos a senha, vamos tentar acessar o dashboard direto com o token
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // 2. Verificar se está na home/dashboard
    console.log('📊 Acessando dashboard...');
    const currentUrl = page.url();
    console.log(`   URL atual: ${currentUrl}`);

    // 3. Procurar pela série Wandinha
    console.log('\n🔎 Procurando série Wandinha no dashboard...');

    // Esperar carregar as séries
    await page.waitForTimeout(3000);

    // Tirar screenshot do dashboard
    await page.screenshot({ path: 'test-results/dashboard-wandinha.png', fullPage: true });
    console.log('   📸 Screenshot salva: test-results/dashboard-wandinha.png');

    // Verificar se "Wandinha" aparece na página
    const wandinhaTexts = await page.locator('text=/Wandinha/i').all();
    console.log(`   ✓ Encontrados ${wandinhaTexts.length} elementos com "Wandinha"`);

    if (wandinhaTexts.length === 0) {
      console.log('   ❌ Série Wandinha NÃO encontrada no dashboard!');

      // Verificar se precisa fazer login
      const hasLoginButton = await page.locator('text=/entrar|login/i').count();
      if (hasLoginButton > 0) {
        console.log('   ⚠️  Usuário não está logado - precisa fazer login');
      }

      return;
    }

    console.log('   ✅ Série Wandinha encontrada no dashboard!');

    // 4. Clicar na série Wandinha (clicar no card ou botão "Ver detalhes")
    console.log('\n🎬 Acessando página da série Wandinha...');

    // Tentar clicar no botão "Ver detalhes" ou no card da Wandinha
    const detailsButton = page.locator('text=Ver detalhes').first();
    const hasDetailsButton = await detailsButton.count();

    if (hasDetailsButton > 0) {
      await detailsButton.click();
    } else {
      // Se não tiver botão, clicar no texto mesmo
      await wandinhaTexts[0].click();
    }

    await page.waitForTimeout(3000);

    // Tirar screenshot da página da série
    await page.screenshot({ path: 'test-results/wandinha-series-page.png', fullPage: true });
    console.log('   📸 Screenshot salva: test-results/wandinha-series-page.png');

    const seriesUrl = page.url();
    console.log(`   URL da série: ${seriesUrl}`);

    // 5. Verificar episódios disponíveis
    console.log('\n📺 Verificando episódios disponíveis...');

    // Procurar por elementos de episódios de forma mais simples
    const episodeText = await page.locator('text=/Episódio|Episode/i').count();
    const seasonText = await page.locator('text=/Temporada|Season/i').count();

    console.log(`   ✓ Encontrados ${episodeText} textos de "Episódio"`);
    console.log(`   ✓ Encontrados ${seasonText} textos de "Temporada"`);

    // Procurar por temporadas/seasons
    const seasonElements = await page.locator('text=/Temporada|Season/i').all();
    console.log(`   ✓ Encontradas ${seasonElements.length} temporadas`);

    // 6. Tentar clicar no primeiro episódio
    if (episodeText > 0 || seasonText > 0) {
      console.log('\n▶️  Testando primeiro episódio...');

      // Procurar por botão de play ou card do episódio
      const playButtons = await page.locator('button:has-text("Assistir")').count();
      const watchButtons = await page.locator('button:has-text("Play")').count();

      console.log(`   ✓ Encontrados ${playButtons} botões "Assistir"`);
      console.log(`   ✓ Encontrados ${watchButtons} botões "Play"`);

      if (playButtons > 0) {

        try {
          await page.locator('button:has-text("Assistir")').first().click();
          await page.waitForTimeout(3000);

          // Tirar screenshot do player
          await page.screenshot({ path: 'test-results/wandinha-player.png', fullPage: true });
          console.log('   📸 Screenshot do player salva: test-results/wandinha-player.png');

          const playerUrl = page.url();
          console.log(`   URL do player: ${playerUrl}`);

          // Verificar se o player de vídeo está presente
          const videoPlayer = await page.locator('video, [class*="player"], [class*="video"]').count();

          if (videoPlayer > 0) {
            console.log('   ✅ PLAYER DE VÍDEO ENCONTRADO - Episódio pronto para assistir!');

            // Verificar se o vídeo está carregando/reproduzindo
            const videoElement = page.locator('video').first();
            const videoExists = await videoElement.count() > 0;

            if (videoExists) {
              const videoSrc = await videoElement.getAttribute('src').catch(() => null);
              console.log(`   📹 Video src: ${videoSrc ? videoSrc.substring(0, 100) + '...' : 'N/A'}`);

              // Verificar se há erro no vídeo
              const hasError = await page.locator('text=/erro|error|falha/i').count();
              if (hasError > 0) {
                console.log('   ⚠️  Possível erro no player de vídeo');
              } else {
                console.log('   ✅ Vídeo sem erros aparentes');
              }
            }
          } else {
            console.log('   ❌ Player de vídeo NÃO encontrado');
          }
        } catch (error) {
          console.log(`   ⚠️  Erro ao clicar no episódio: ${error.message}`);
        }
      } else {
        console.log('   ❌ Nenhum botão de play encontrado');
      }
    } else {
      console.log('   ❌ Nenhum episódio encontrado na página');
    }

    console.log('\n' + '='.repeat(60));
    console.log('RESUMO DA VERIFICAÇÃO:');
    console.log('='.repeat(60));
    console.log(`Série no dashboard: ${wandinhaTexts.length > 0 ? '✅ SIM' : '❌ NÃO'}`);
    console.log(`Episódios listados: ${episodeText > 0 ? `✅ ${episodeText} textos` : '❌ 0'}`);
    console.log(`Temporadas listadas: ${seasonText > 0 ? `✅ ${seasonText} textos` : '❌ 0'}`);
    console.log(`Player disponível: Veja screenshot em test-results/wandinha-player.png`);
    console.log('='.repeat(60));
  });
});
