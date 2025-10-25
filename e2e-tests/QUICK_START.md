# 🚀 Quick Start - CineVision E2E Tests

## ⚙️ Configuração Inicial (Faça isso uma vez)

### 1. Atualizar URL Base

Edite o arquivo `playwright.config.ts` na linha 30:

```typescript
baseURL: 'https://sua-url-real.vercel.app',
```

**OU** crie um arquivo `.env`:

```bash
# Copie o exemplo
cp .env.example .env

# Edite e coloque sua URL
BASE_URL=https://sua-url.vercel.app
```

### 2. Verificar Instalação

```bash
npm run test:e2e:chromium
```

## 📋 Comandos Mais Usados

```bash
# Rodar todos os testes (headless, todos os browsers)
npm run test:e2e

# Rodar com interface visual (ver o que está acontecendo)
npm run test:e2e:headed

# Modo debug (pausar e inspecionar)
npm run test:e2e:debug

# Modo UI interativo (melhor para desenvolvimento)
npm run test:e2e:ui
```

## 🎯 Próximos Passos

1. ✅ Playwright instalado
2. ✅ Estrutura básica criada
3. ⏳ **Atualizar a URL no `playwright.config.ts`**
4. ⏳ **Rodar os testes novamente**
5. ⏳ **Criar testes específicos para seu sistema**

## 📝 Criar Novos Testes

Crie arquivos na pasta `tests/`:

```bash
tests/
├── main.spec.ts           # ✅ Já existe
├── login.spec.ts          # Criar teste de login
├── movies.spec.ts         # Criar teste de filmes
└── series.spec.ts         # Criar teste de séries
```

Exemplo de novo teste:

```typescript
import { test, expect } from '@playwright/test';

test('meu teste personalizado', async ({ page }) => {
  await page.goto('/');

  // Seu código aqui
  await page.click('button[data-testid="login"]');

  await expect(page).toHaveURL(/dashboard/);
});
```

## 🔍 Ver Relatório HTML

Após rodar os testes:

```bash
npm run test:e2e:report
```

## 💡 Dicas

- Use `test.only()` para testar apenas um caso
- Use `page.pause()` para pausar durante debug
- Screenshots e vídeos ficam em `test-results/`
- Relatório HTML fica em `playwright-report/`

## ❓ Problemas?

1. **Testes falhando com "Login – Vercel"**
   - ➡️ Você precisa atualizar a URL base no config

2. **Timeout nos testes**
   - ➡️ Aumente o timeout no `playwright.config.ts`

3. **Browser não abre**
   - ➡️ Rode: `npx playwright install`
