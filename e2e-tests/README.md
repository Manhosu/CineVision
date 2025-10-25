# CineVision - Testes E2E com Playwright

Este diretório contém os testes end-to-end (E2E) para o sistema CineVision usando Playwright e TypeScript.

## 📋 Pré-requisitos

- Node.js 18+ instalado
- npm ou yarn

## 🚀 Instalação

Os pacotes já estão instalados. Se precisar reinstalar:

```bash
npm install
```

## 🧪 Executando os Testes

### Rodar todos os testes (modo headless)
```bash
npm run test:e2e
```

### Rodar testes com interface visual
```bash
npm run test:e2e:headed
```

### Modo debug (abre DevTools do Playwright)
```bash
npm run test:e2e:debug
```

### Modo UI interativo
```bash
npm run test:e2e:ui
```

### Rodar em browser específico
```bash
npm run test:e2e:chromium
npm run test:e2e:firefox
npm run test:e2e:webkit
```

### Ver relatório dos últimos testes
```bash
npm run test:e2e:report
```

### Gerar testes automaticamente (Codegen)
```bash
npm run test:e2e:codegen
```

## 📁 Estrutura de Arquivos

```
e2e-tests/
├── tests/
│   └── main.spec.ts          # Testes principais
├── playwright.config.ts       # Configuração do Playwright
├── package.json              # Dependências e scripts
└── README.md                 # Esta documentação
```

## 🔧 Configuração

### Alterar URL Base

Edite o arquivo `playwright.config.ts` e altere o `baseURL`:

```typescript
use: {
  baseURL: 'https://sua-url-na-vercel.app',
  // ...
}
```

Ou use variável de ambiente:

```bash
BASE_URL=https://sua-url.vercel.app npm run test:e2e
```

## 📝 Criando Novos Testes

Crie arquivos `.spec.ts` na pasta `tests/`:

```typescript
import { test, expect } from '@playwright/test';

test('meu novo teste', async ({ page }) => {
  await page.goto('/');
  // ... seu teste aqui
});
```

## 🌐 Browsers Suportados

Os testes rodam automaticamente em:
- ✅ Chromium
- ✅ Firefox
- ✅ WebKit (Safari)
- ✅ Mobile Chrome
- ✅ Mobile Safari

## 📊 Relatórios

Após rodar os testes, são gerados:
- **Terminal**: Lista de testes executados
- **HTML Report**: Relatório visual detalhado em `playwright-report/`
- **Screenshots**: Capturas de tela em falhas
- **Videos**: Gravação de testes com falha

## 🐛 Debug

Para debugar testes específicos:

```bash
npm run test:e2e:debug tests/main.spec.ts
```

## 📚 Documentação

- [Playwright Docs](https://playwright.dev/docs/intro)
- [API Reference](https://playwright.dev/docs/api/class-playwright)
- [Best Practices](https://playwright.dev/docs/best-practices)

## 🔍 Dicas

1. Use `test.only()` para rodar apenas um teste
2. Use `test.skip()` para pular testes
3. Use `page.pause()` para pausar execução durante debug
4. Use seletores estáveis (data-testid) para melhor manutenibilidade
