# 🔐 Sistema de Auto-Login via Telegram ID

## 📋 Resumo

Implementação completa de autenticação automática via Telegram ID, permitindo que usuários acessem o dashboard web através de links enviados pelo bot do Telegram, sem necessidade de inserir email/senha.

## 🎯 Como Funciona

### Fluxo Completo

```
1. Usuário envia /start no Telegram Bot
   ↓
2. Bot cria/busca usuário automaticamente pelo Telegram ID
   ↓
3. Bot gera token de auto-login (válido por 5 minutos)
   ↓
4. Bot envia mensagem com botão "🌐 Ver Catálogo no Site (Auto-Login)"
   Link: https://cinevision.com/auth/auto-login?token=ABC123&redirect=/catalog
   ↓
5. Usuário clica no botão
   ↓
6. Navegador abre página de auto-login
   ↓
7. Frontend extrai o token da URL
   ↓
8. Frontend chama POST /api/v1/auth/auto-login {token}
   ↓
9. Backend valida o token e retorna JWT
   ↓
10. Frontend salva JWT no localStorage
    ↓
11. Frontend redireciona para /catalog
    ↓
12. Usuário está LOGADO no dashboard! 🎉
```

## 🗄️ Banco de Dados

### Tabela `auto_login_tokens`

```sql
CREATE TABLE auto_login_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token VARCHAR(255) UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  telegram_id VARCHAR NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  is_used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMPTZ,
  redirect_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_auto_login_tokens_token ON auto_login_tokens(token);
CREATE INDEX idx_auto_login_tokens_user_id ON auto_login_tokens(user_id);
CREATE INDEX idx_auto_login_tokens_telegram_id ON auto_login_tokens(telegram_id);
CREATE INDEX idx_auto_login_tokens_expires_at ON auto_login_tokens(expires_at);
```

**Características:**
- Token expira em **5 minutos**
- Token pode ser usado **apenas uma vez**
- Limpeza automática de tokens expirados
- Redirect URL opcional para redirecionar após login

## 🔧 Backend

### Arquivos Criados/Modificados

#### 1. `backend/src/modules/auth/services/auto-login.service.ts` (NOVO)

**Métodos principais:**

```typescript
// Gera token de auto-login
async generateAutoLoginToken(
  userId: string,
  telegramId: string,
  redirectUrl?: string
): Promise<{ token: string; login_url: string; expires_in: number }>

// Valida e consome o token
async validateAndConsumeToken(token: string): Promise<{
  access_token: string;
  refresh_token: string;
  user: any;
  redirect_url?: string;
}>

// Gera URL autenticada do catálogo
async generateCatalogUrl(userId: string, telegramId: string): Promise<string>

// Gera URL autenticada de filme específico
async generateMovieUrl(userId: string, telegramId: string, movieId: string): Promise<string>

// Gera URL autenticada de compra
async generatePurchaseUrl(userId: string, telegramId: string, purchaseId: string): Promise<string>
```

#### 2. `backend/src/modules/auth/auth.controller.ts` (MODIFICADO)

**Novo endpoint:**

```typescript
POST /api/v1/auth/auto-login
Body: { token: string }
Response: {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    telegram_id: string;
  },
  access_token: string;
  refresh_token: string;
  redirect_url?: string;
}
```

#### 3. `backend/src/modules/telegrams/telegrams-enhanced.service.ts` (MODIFICADO)

**Alterações:**

1. **Método `handleStartCommand` modificado:**
   - Gera link autenticado do catálogo
   - Adiciona botão "🌐 Ver Catálogo no Site (Auto-Login)"

```typescript
private async handleStartCommand(chatId: number, text: string, telegramUserId?: number) {
  const user = await this.findOrCreateUserByTelegramId(telegramUserId || chatId, chatId);

  const catalogUrl = await this.autoLoginService.generateCatalogUrl(
    user.id,
    user.telegram_id
  );

  // Envia mensagem com botão de auto-login
  await this.sendMessage(chatId, welcomeMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🎬 Ver Catálogo no Telegram', callback_data: 'catalog' }],
        [{ text: '🌐 Ver Catálogo no Site (Auto-Login)', url: catalogUrl }],
        // ...
      ],
    },
  });
}
```

2. **Método `deliverContentAfterPayment` modificado:**
   - Gera link autenticado da compra
   - Envia link no botão "Ver no Dashboard"

```typescript
async deliverContentAfterPayment(purchase: any): Promise<void> {
  // Gerar link autenticado
  const dashboardUrl = await this.autoLoginService.generatePurchaseUrl(
    user.id,
    user.telegram_id,
    purchase.id
  );

  // Enviar mensagem com link autenticado
  await this.sendMessage(chatId,
    `🎉 Pagamento Confirmado!\n\nAcesse: ${dashboardUrl}`
  );

  // Botão com auto-login
  buttons.push([{
    text: '🌐 Ver no Dashboard (Auto-Login)',
    url: dashboardUrl
  }]);
}
```

## 💻 Frontend

### Arquivos Criados

#### `frontend/src/app/auth/auto-login/page.tsx` (NOVO)

**Funcionalidades:**

1. Extrai `token` e `redirect` da URL
2. Chama endpoint `/api/v1/auth/auto-login`
3. Salva JWT no localStorage:
   - `access_token`
   - `refresh_token`
   - `auth_token` (compatibilidade)
   - `user` (JSON)
4. Redireciona para URL especificada
5. Mostra estados de loading/sucesso/erro

**Estados visuais:**

- **Loading:** Spinner + "Autenticando..."
- **Sucesso:** Check verde + "Sucesso! Redirecionando..."
- **Erro:** X vermelho + Mensagem de erro + Redirect automático para /auth/login

## 🔒 Segurança

### Medidas Implementadas

1. **Token Seguro:**
   - Gerado com `crypto.randomBytes(32)` (256 bits)
   - Formato hexadecimal (64 caracteres)

2. **Expiração Curta:**
   - Tokens expiram em 5 minutos
   - Previne uso indevido

3. **Uso Único:**
   - Token marcado como usado após consumo
   - Campo `is_used` e `used_at`

4. **Limpeza Automática:**
   - Tokens expirados são deletados automaticamente
   - Executado antes de criar novo token

5. **Validação Completa:**
   - Verifica existência do token
   - Verifica se já foi usado
   - Verifica expiração
   - Verifica usuário existe

## 📱 Exemplos de Uso

### 1. Link do Catálogo

```
https://cinevision.com/auth/auto-login?token=abc123...&redirect=/catalog
```

**Resultado:**
- Usuário autenticado automaticamente
- Redirecionado para página de catálogo
- Já pode comprar filmes

### 2. Link de Compra

```
https://cinevision.com/auth/auto-login?token=xyz789...&redirect=/dashboard/purchases/purchase-id
```

**Resultado:**
- Usuário autenticado automaticamente
- Redirecionado para página da compra específica
- Pode assistir o filme imediatamente

### 3. Link de Filme Específico

```
https://cinevision.com/auth/auto-login?token=def456...&redirect=/movies/movie-id
```

**Resultado:**
- Usuário autenticado automaticamente
- Redirecionado para página de detalhes do filme
- Pode comprar ou assistir (se já comprou)

## 🧪 Como Testar

### Pré-requisitos

1. Backend rodando em `http://localhost:3001`
2. Frontend rodando em `http://localhost:3000`
3. Bot do Telegram configurado e rodando
4. Supabase database configurado

### Passo a Passo

1. **Abra o Telegram e acesse o bot**
   ```
   Envie: /start
   ```

2. **Verifique a mensagem de boas-vindas**
   - Deve ter botão "🌐 Ver Catálogo no Site (Auto-Login)"

3. **Clique no botão**
   - Navegador deve abrir
   - Deve mostrar tela de "Autenticando..."
   - Deve redirecionar para `/catalog`

4. **Verifique se está logado**
   - Abra DevTools (F12)
   - Console: `localStorage.getItem('access_token')`
   - Deve retornar um JWT token

5. **Faça uma compra no bot**
   - Escolha um filme
   - Complete o pagamento
   - Receba mensagem de confirmação

6. **Clique em "Ver no Dashboard"**
   - Deve abrir navegador já autenticado
   - Deve mostrar a compra específica

## 🐛 Solução de Problemas

### Token Expirado

**Erro:** `"Login token expired"`

**Solução:**
- Tokens expiram em 5 minutos
- Gere novo link no bot (envie /start novamente)

### Token Já Usado

**Erro:** `"Login token already used"`

**Solução:**
- Cada token pode ser usado apenas uma vez
- Gere novo link no bot

### Usuário Não Encontrado

**Erro:** `"User not found"`

**Solução:**
- Verifique se usuário existe na tabela `users`
- Verifique campo `telegram_id`

### Frontend Não Redireciona

**Problema:** Página fica em loading infinito

**Debug:**
1. Abra DevTools → Network
2. Verifique requisição POST `/api/v1/auth/auto-login`
3. Verifique resposta do servidor
4. Verifique console do navegador

## 📊 Monitoramento

### Logs Importantes

#### Backend

```bash
# AutoLoginService
[AutoLoginService] Generated auto-login token for user {user_id} (telegram_id: {telegram_id})
[AutoLoginService] Auto-login successful for user {user_id} (telegram_id: {telegram_id})

# TelegramsEnhancedService
[TelegramsEnhancedService] User found with telegram_id {telegram_id}: {user_id}
[TelegramsEnhancedService] New user created: {user_id} for telegram_id {telegram_id}
```

#### Frontend (Console do Navegador)

```javascript
// Sucesso
"Auto-login successful"

// Erro
"Erro no auto-login: {error_message}"
```

### Queries Úteis

```sql
-- Ver todos os tokens ativos
SELECT * FROM auto_login_tokens
WHERE is_used = FALSE
AND expires_at > NOW()
ORDER BY created_at DESC;

-- Ver tokens usados nas últimas 24h
SELECT * FROM auto_login_tokens
WHERE is_used = TRUE
AND used_at > NOW() - INTERVAL '24 hours'
ORDER BY used_at DESC;

-- Limpar tokens expirados manualmente
DELETE FROM auto_login_tokens
WHERE expires_at < NOW();

-- Ver estatísticas de uso
SELECT
  DATE(created_at) as date,
  COUNT(*) as total_tokens,
  SUM(CASE WHEN is_used THEN 1 ELSE 0 END) as used_tokens,
  SUM(CASE WHEN expires_at < NOW() AND NOT is_used THEN 1 ELSE 0 END) as expired_tokens
FROM auto_login_tokens
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

## 🚀 Próximas Melhorias

### Funcionalidades Futuras

1. **Rate Limiting:**
   - Limitar geração de tokens por usuário
   - Prevenir abuso

2. **Métricas:**
   - Taxa de conversão (tokens gerados → tokens usados)
   - Tempo médio entre geração e uso
   - Tokens expirados sem uso

3. **Notificações:**
   - Alertar usuário quando token está próximo de expirar
   - Sugerir gerar novo link

4. **Multi-dispositivo:**
   - Permitir múltiplos tokens ativos
   - Gerenciar sessões ativas

5. **Personalização:**
   - Tempo de expiração configurável
   - Redirect URL padrão configurável

## 📝 Checklist de Implementação

- [x] Criar tabela `auto_login_tokens` no Supabase
- [x] Criar `AutoLoginService` no backend
- [x] Adicionar endpoint `/api/v1/auth/auto-login`
- [x] Modificar `TelegramsEnhancedService` para gerar links
- [x] Criar página `/auth/auto-login` no frontend
- [x] Testar fluxo completo de autenticação
- [ ] Adicionar rate limiting
- [ ] Adicionar métricas de uso
- [ ] Documentar para o cliente

## 🎓 Conceitos Importantes

### Deep Links

Links que abrem diretamente uma página específica do app, passando dados via URL.

**Exemplo:**
```
https://cinevision.com/auth/auto-login?token=ABC&redirect=/catalog
```

### Token de Uso Único (One-Time Token)

Token que pode ser usado apenas uma vez e depois é invalidado.

**Vantagens:**
- Maior segurança
- Previne replay attacks
- Força geração de novo token

### JWT (JSON Web Token)

Token de autenticação que contém informações do usuário codificadas.

**Estrutura:**
```
header.payload.signature
```

**Usado para:**
- Autenticar requisições ao backend
- Armazenar informações do usuário
- Verificar permissões

## 🔗 Links Úteis

- [Documentação Telegram Bot API](https://core.telegram.org/bots/api)
- [Documentação Supabase](https://supabase.com/docs)
- [Documentação Next.js](https://nextjs.org/docs)
- [JWT.io - Debug JWT](https://jwt.io/)

---

**Data de Implementação:** 2025-10-17
**Versão:** 1.0.0
**Status:** ✅ Implementado e Testável
