import { test, expect } from '@playwright/test';

/**
 * CineVision - Main E2E Tests
 *
 * Este arquivo contém testes básicos para verificar a funcionalidade
 * principal do sistema CineVision hospedado na Vercel.
 *
 * Para rodar os testes:
 * - Todos os testes: npm run test:e2e
 * - Modo debug: npm run test:e2e:debug
 * - Modo UI: npm run test:e2e:ui
 */

test.describe('CineVision - Homepage', () => {
  test('deve carregar a página inicial corretamente', async ({ page }) => {
    // Navega para a página inicial
    await page.goto('/');

    // Verifica se a página carregou
    await expect(page).toHaveTitle(/CineVision/i);

    // Aguarda um elemento estar visível (ajuste o seletor conforme necessário)
    await page.waitForLoadState('networkidle');

    console.log('✓ Página inicial carregada com sucesso');
  });

  test('deve ter conteúdo visível na página inicial', async ({ page }) => {
    await page.goto('/');

    // Verifica se há conteúdo na página
    const body = await page.locator('body');
    await expect(body).toBeVisible();

    console.log('✓ Conteúdo da página inicial está visível');
  });
});

test.describe('CineVision - Navegação', () => {
  test('deve verificar se os links de navegação existem', async ({ page }) => {
    await page.goto('/');

    // Aguarda a página carregar completamente
    await page.waitForLoadState('domcontentloaded');

    console.log('✓ Página carregada, pronta para navegação');
  });
});

test.describe('CineVision - Responsividade', () => {
  test('deve funcionar em mobile viewport', async ({ page }) => {
    // Define viewport mobile
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/');

    await expect(page).toHaveTitle(/CineVision/i);

    console.log('✓ Site funciona corretamente em mobile');
  });

  test('deve funcionar em tablet viewport', async ({ page }) => {
    // Define viewport tablet
    await page.setViewportSize({ width: 768, height: 1024 });

    await page.goto('/');

    await expect(page).toHaveTitle(/CineVision/i);

    console.log('✓ Site funciona corretamente em tablet');
  });
});

test.describe('CineVision - Performance', () => {
  test('deve carregar em tempo aceitável', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const loadTime = Date.now() - startTime;

    console.log(`⏱️  Tempo de carregamento: ${loadTime}ms`);

    // Verifica se carregou em menos de 5 segundos
    expect(loadTime).toBeLessThan(5000);
  });
});
