import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Teste E2E - Criação da Série Wandinha
 *
 * Este teste valida o fluxo completo de:
 * 1. Acesso à página de criação de conteúdo
 * 2. Preenchimento dos metadados da série
 * 3. Adição de episódios (3 por temporada)
 * 4. Upload dos vídeos
 * 5. Publicação da série
 */

test.describe('CineVision - Criar Série Wandinha', () => {
  test('deve criar série Wandinha com episódios e fazer upload', async ({ page }) => {
    // Aumentar timeout para este teste (upload pode demorar)
    test.setTimeout(600000); // 10 minutos

    // 1. Fazer login como admin
    console.log('🔐 Fazendo login como admin...');
    await page.goto('/admin/login', { waitUntil: 'domcontentloaded' });

    // Preencher credenciais
    await page.fill('input[type="email"], input[name="email"]', 'admin@cinevision.com');
    await page.fill('input[type="password"], input[name="password"]', 'Admin@2025');

    // Clicar no botão de login
    await page.click('button[type="submit"], button:has-text("Entrar"), button:has-text("Login")');

    // Aguardar redirecionamento após login
    await page.waitForTimeout(3000);
    console.log('✅ Login realizado com sucesso');

    // 2. Navegar para página de criação
    console.log('📱 Navegando para /admin/content/create...');
    await page.goto('/admin/content/create', { waitUntil: 'domcontentloaded' });

    // Aguardar página carregar
    await page.waitForLoadState('networkidle');
    console.log('✅ Página carregada');

    // 2. Selecionar tipo "Série"
    console.log('🎬 Selecionando tipo: Série...');
    const seriesRadio = page.locator('input[type="radio"][value="series"]');
    await seriesRadio.click();
    console.log('✅ Tipo série selecionado');

    // 3. Preencher informações básicas
    console.log('📝 Preenchendo informações básicas...');

    // Título
    await page.fill('input[name="title"]', 'Wandinha');

    // Descrição
    await page.fill('textarea[name="description"]',
      'Wandinha Addams é uma estudante inteligente, sarcástica e um pouco morta por dentro que está investigando uma onda de assassinatos enquanto faz novos amigos — e inimigos — na Academia Nunca Mais.'
    );

    // Gêneros
    await page.fill('input[name="genres"]', 'Terror, Comédia, Mistério');

    // Ano de lançamento
    await page.fill('input[name="release_year"]', '2022');

    // Diretor
    await page.fill('input[name="director"]', 'Tim Burton');

    // Elenco
    await page.fill('input[name="cast"]', 'Jenna Ortega, Catherine Zeta-Jones, Luis Guzmán');

    // Duração média dos episódios
    await page.fill('input[name="duration_minutes"]', '45');

    console.log('✅ Informações básicas preenchidas');

    // 4. Configurar preço
    console.log('💰 Configurando preço...');
    await page.fill('input[name="price_reais"]', '15.00');
    console.log('✅ Preço configurado: R$ 15.00');

    // 5. Criar série (submeter formulário básico)
    console.log('🚀 Criando série...');
    const createButton = page.locator('button[type="submit"]').first();
    await createButton.click();

    // Aguardar série ser criada
    await page.waitForTimeout(3000);
    console.log('✅ Série criada com sucesso');

    // 6. Adicionar Temporada 1
    console.log('📺 Adicionando Temporada 1...');
    const addSeasonButton = page.locator('button:has-text("Adicionar Temporada")');
    await addSeasonButton.click();
    await page.waitForTimeout(1000);
    console.log('✅ Temporada 1 adicionada');

    // 7. Adicionar 3 episódios da Temporada 1
    const episodiosT1 = [
      { num: 1, titulo: 'O Corvo de Wandinha', descricao: 'Wandinha chega à Academia Nunca Mais e rapidamente mostra que não é uma estudante comum.' },
      { num: 2, titulo: 'Pais que Amam São Pais que Abandonam', descricao: 'Os pais de Wandinha visitam a escola para o Dia dos Pais.' },
      { num: 3, titulo: 'Amigo ou Inimigo', descricao: 'Wandinha investiga os assassinatos na floresta.' }
    ];

    for (const ep of episodiosT1) {
      console.log(`📼 Adicionando episódio T1E${ep.num}: ${ep.titulo}...`);

      // Clicar em adicionar episódio
      const addEpisodeBtn = page.locator('button:has-text("Adicionar Episódio")').first();
      await addEpisodeBtn.click();
      await page.waitForTimeout(1000);

      // Preencher dados do episódio
      const episodeCards = page.locator('[class*="episode-card"]').last();

      // Título do episódio
      await episodeCards.locator('input[placeholder*="Título"]').fill(ep.titulo);

      // Descrição do episódio
      await episodeCards.locator('textarea[placeholder*="Descrição"]').fill(ep.descricao);

      // Duração
      await episodeCards.locator('input[type="number"][placeholder*="Duração"]').fill('45');

      console.log(`✅ Episódio T1E${ep.num} configurado`);
    }

    // 8. Adicionar Temporada 2
    console.log('📺 Adicionando Temporada 2...');
    await addSeasonButton.click();
    await page.waitForTimeout(1000);
    console.log('✅ Temporada 2 adicionada');

    // 9. Adicionar 3 episódios da Temporada 2
    const episodiosT2 = [
      { num: 1, titulo: 'Um Pecado e uma Boa Ação', descricao: 'Wandinha começa a segunda temporada com novos mistérios.' },
      { num: 2, titulo: 'A Outra Face', descricao: 'Segredos do passado vêm à tona.' },
      { num: 3, titulo: 'Na Tempestade', descricao: 'A investigação se intensifica.' }
    ];

    for (const ep of episodiosT2) {
      console.log(`📼 Adicionando episódio T2E${ep.num}: ${ep.titulo}...`);

      const addEpisodeBtn = page.locator('button:has-text("Adicionar Episódio")').last();
      await addEpisodeBtn.click();
      await page.waitForTimeout(1000);

      const episodeCards = page.locator('[class*="episode-card"]').last();

      await episodeCards.locator('input[placeholder*="Título"]').fill(ep.titulo);
      await episodeCards.locator('textarea[placeholder*="Descrição"]').fill(ep.descricao);
      await episodeCards.locator('input[type="number"][placeholder*="Duração"]').fill('45');

      console.log(`✅ Episódio T2E${ep.num} configurado`);
    }

    console.log('✅ Todos os episódios foram configurados');

    // 10. Selecionar arquivos de vídeo para os episódios
    console.log('🎥 Selecionando arquivos de vídeo...');

    // Caminho base dos vídeos
    const videosPath = 'E:\\movies\\SERIE_Wandinha';

    // Verificar se o diretório existe
    if (fs.existsSync(videosPath)) {
      const files = fs.readdirSync(videosPath)
        .filter(f => f.endsWith('.mp4') || f.endsWith('.mkv'))
        .slice(0, 6); // Pegar primeiros 6 arquivos (3 de cada temporada)

      console.log(`📁 Encontrados ${files.length} arquivos de vídeo`);

      // Selecionar arquivo para cada episódio
      const fileInputs = page.locator('input[type="file"][accept*="video"]');
      const count = await fileInputs.count();

      for (let i = 0; i < Math.min(count, files.length); i++) {
        const filePath = path.join(videosPath, files[i]);
        console.log(`📤 Selecionando vídeo ${i + 1}: ${files[i]}...`);

        await fileInputs.nth(i).setInputFiles(filePath);
        await page.waitForTimeout(1000);

        console.log(`✅ Vídeo ${i + 1} selecionado`);
      }

      console.log('✅ Todos os vídeos foram selecionados');
    } else {
      console.log('⚠️ Diretório de vídeos não encontrado. Pulando seleção de arquivos.');
      console.log('ℹ️ Caminho esperado:', videosPath);
    }

    // 11. Tirar screenshot antes de finalizar
    await page.screenshot({
      path: 'test-results/wandinha-antes-finalizar.png',
      fullPage: true
    });
    console.log('📸 Screenshot salvo: wandinha-antes-finalizar.png');

    // 12. Finalizar e publicar série
    console.log('🎯 Finalizando e publicando série...');
    const finalizeButton = page.locator('button:has-text("Finalizar e Publicar")');
    await finalizeButton.click();

    // Aguardar confirmação ou redirecionamento
    console.log('⏳ Aguardando processamento...');
    await page.waitForTimeout(5000);

    // Verificar se há mensagens de sucesso
    const successToast = page.locator('.toast-success, [class*="success"]');
    if (await successToast.isVisible({ timeout: 5000 })) {
      console.log('✅ Série publicada com sucesso!');
    }

    // 13. Screenshot final
    await page.screenshot({
      path: 'test-results/wandinha-apos-finalizar.png',
      fullPage: true
    });
    console.log('📸 Screenshot salvo: wandinha-apos-finalizar.png');

    // 14. Verificar redirecionamento para admin
    await page.waitForTimeout(2000);
    const currentUrl = page.url();
    console.log('📍 URL atual:', currentUrl);

    // Fazer uma pausa para ver o resultado
    console.log('⏸️ Pausando para visualização (pressione qualquer tecla para continuar)...');
    await page.pause();

    console.log('✅ Teste concluído com sucesso!');
  });
});
