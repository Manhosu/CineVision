import { test, expect } from '@playwright/test';

/**
 * Exemplos Avançados de Testes com Playwright
 *
 * Este arquivo contém exemplos de testes mais complexos que você pode
 * usar como referência para criar seus próprios testes.
 *
 * Para rodar apenas este arquivo:
 * npx playwright test tests/example-advanced.spec.ts
 */

// DESABILITADO POR PADRÃO - remova o .skip para habilitar
test.describe.skip('Exemplos Avançados', () => {
  test('exemplo: fazer login no sistema', async ({ page }) => {
    await page.goto('/login');

    // Preencher formulário
    await page.fill('input[name="email"]', 'usuario@example.com');
    await page.fill('input[name="password"]', 'senha123');

    // Clicar no botão
    await page.click('button[type="submit"]');

    // Verificar redirecionamento
    await expect(page).toHaveURL(/dashboard/);
  });

  test('exemplo: buscar por filme', async ({ page }) => {
    await page.goto('/');

    // Localizar campo de busca
    const searchInput = page.locator('input[placeholder*="Buscar"]');
    await searchInput.fill('Matrix');

    // Pressionar Enter
    await searchInput.press('Enter');

    // Aguardar resultados carregarem
    await page.waitForSelector('.movie-card', { timeout: 5000 });

    // Verificar se há resultados
    const movieCards = page.locator('.movie-card');
    await expect(movieCards).toHaveCountGreaterThan(0);
  });

  test('exemplo: adicionar filme aos favoritos', async ({ page }) => {
    await page.goto('/movies/123');

    // Clicar no botão de favoritar
    const favoriteButton = page.locator('button[aria-label="Adicionar aos favoritos"]');
    await favoriteButton.click();

    // Verificar toast de sucesso
    await expect(page.locator('.toast-success')).toBeVisible();

    // Verificar se botão mudou de estado
    await expect(favoriteButton).toHaveAttribute('aria-label', 'Remover dos favoritos');
  });

  test('exemplo: fazer upload de arquivo', async ({ page }) => {
    await page.goto('/admin/upload');

    // Fazer upload de arquivo
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('./test-files/video.mp4');

    // Aguardar progress bar
    await expect(page.locator('.upload-progress')).toBeVisible();

    // Aguardar conclusão (max 30s)
    await expect(page.locator('.upload-success')).toBeVisible({ timeout: 30000 });
  });

  test('exemplo: testar API via interceptação', async ({ page }) => {
    // Interceptar requisição de API
    await page.route('**/api/movies', async (route) => {
      const json = {
        success: true,
        data: [
          { id: 1, title: 'Filme Teste 1' },
          { id: 2, title: 'Filme Teste 2' },
        ],
      };
      await route.fulfill({ json });
    });

    await page.goto('/movies');

    // Verificar se dados mockados aparecem
    await expect(page.locator('text=Filme Teste 1')).toBeVisible();
    await expect(page.locator('text=Filme Teste 2')).toBeVisible();
  });

  test('exemplo: testar scroll infinito', async ({ page }) => {
    await page.goto('/movies');

    // Contar itens iniciais
    const initialCount = await page.locator('.movie-card').count();

    // Fazer scroll até o final
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // Aguardar novos itens carregarem
    await page.waitForTimeout(2000);

    // Verificar se mais itens foram carregados
    const newCount = await page.locator('.movie-card').count();
    expect(newCount).toBeGreaterThan(initialCount);
  });

  test('exemplo: testar modo escuro', async ({ page }) => {
    await page.goto('/');

    // Clicar no toggle de tema
    await page.click('button[aria-label="Alternar tema"]');

    // Verificar se classe dark foi adicionada
    const html = page.locator('html');
    await expect(html).toHaveClass(/dark/);

    // Verificar localStorage
    const theme = await page.evaluate(() => localStorage.getItem('theme'));
    expect(theme).toBe('dark');
  });

  test('exemplo: testar com múltiplas abas', async ({ context }) => {
    // Abrir primeira página
    const page1 = await context.newPage();
    await page1.goto('/movies/123');

    // Abrir segunda página
    const page2 = await context.newPage();
    await page2.goto('/series/456');

    // Verificar conteúdo em ambas
    await expect(page1.locator('h1')).toContainText('Filme');
    await expect(page2.locator('h1')).toContainText('Série');

    // Fechar páginas
    await page1.close();
    await page2.close();
  });

  test('exemplo: testar formulário com validação', async ({ page }) => {
    await page.goto('/admin/content/create');

    // Tentar submeter formulário vazio
    await page.click('button[type="submit"]');

    // Verificar mensagens de erro
    await expect(page.locator('text=Campo obrigatório')).toBeVisible();

    // Preencher corretamente
    await page.fill('input[name="title"]', 'Novo Filme');
    await page.fill('textarea[name="description"]', 'Descrição do filme');
    await page.selectOption('select[name="genre"]', 'ação');

    // Submeter
    await page.click('button[type="submit"]');

    // Verificar sucesso
    await expect(page.locator('.success-message')).toBeVisible();
  });

  test('exemplo: capturar e verificar screenshot', async ({ page }) => {
    await page.goto('/');

    // Tirar screenshot da página inteira
    await page.screenshot({ path: 'test-results/homepage-full.png', fullPage: true });

    // Tirar screenshot de um elemento específico
    const header = page.locator('header');
    await header.screenshot({ path: 'test-results/header.png' });

    // Comparar visualmente (requer baseline)
    // await expect(page).toHaveScreenshot('homepage.png');
  });
});

/**
 * Fixtures Customizados
 * Use para criar setup reutilizável
 */
test.describe.skip('Exemplos com Fixtures', () => {
  // Criar fixture de usuário logado
  const test = test.extend({
    authenticatedPage: async ({ page }, use) => {
      // Fazer login antes de cada teste
      await page.goto('/login');
      await page.fill('input[name="email"]', 'admin@example.com');
      await page.fill('input[name="password"]', 'admin123');
      await page.click('button[type="submit"]');
      await page.waitForURL('**/admin');

      // Fornecer página autenticada para o teste
      await use(page);

      // Fazer logout após o teste
      await page.click('button[aria-label="Logout"]');
    },
  });

  test('acessar painel admin como usuário logado', async ({ authenticatedPage }) => {
    // Página já está autenticada!
    await expect(authenticatedPage.locator('h1')).toContainText('Dashboard Admin');
  });
});
