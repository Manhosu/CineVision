# Fix: Sessões Ativas - Exibir Nomes do Telegram

## 🎯 Problema
Sessões ativas estavam mostrando "Usuario Teste" ao invés dos nomes reais dos usuários do Telegram.

## ✅ Solução Implementada

### 1. **Enriquecimento de Dados em Tempo Real**
O sistema agora busca dados frescos da tabela `users` toda vez que as sessões ativas são consultadas:

- **Arquivo**: `backend/src/modules/analytics/analytics.service.ts`
- **Método**: `getActiveSessions()` (linhas 271-329)
- **Funcionamento**:
  1. Busca sessões ativas da tabela `user_sessions`
  2. Para cada sessão com `user_id`, consulta a tabela `users`
  3. Enriquece os dados da sessão com `name`, `telegram_id`, `telegram_username` atualizados
  4. Retorna sessões com dados sempre atualizados

### 2. **Endpoint de Limpeza de Sessões**
Adicionado endpoint para limpar sessões antigas:

- **Endpoint**: `POST /api/v1/analytics/clear-sessions`
- **Funcionamento**: Remove sessões com mais de 1 minuto sem atividade
- **Uso**: Força refresh imediato de todas as sessões

## 🔍 Como Verificar se Está Funcionando

### Passo 1: Verificar Dados no Supabase

Execute o script SQL no Supabase SQL Editor:

```bash
# Arquivo: backend/scripts/check-telegram-data.sql
```

Este script vai mostrar:
- ✅ Quantos usuários têm `telegram_id` preenchido
- ❌ Quantos usuários NÃO têm `telegram_id`
- 📊 Comparação entre dados em `user_sessions` vs `users`

### Passo 2: Testar Localmente

```bash
# Iniciar o backend
cd backend
npm run start:dev

# Em outro terminal, testar o endpoint
curl http://localhost:3001/api/v1/analytics/active-sessions

# Verificar a resposta - deve incluir telegram_id e telegram_username
```

### Passo 3: Limpar Sessões Antigas (se necessário)

```bash
curl -X POST http://localhost:3001/api/v1/analytics/clear-sessions
```

## ⚠️ Requisito Importante

**Para que esta solução funcione, os usuários na tabela `users` DEVEM ter os campos `telegram_id` e `telegram_username` preenchidos.**

Se esses campos estiverem vazios (NULL), apenas o `name` será exibido.

## 🔧 Como Popular Dados do Telegram (se necessário)

Se a verificação mostrar que os usuários não têm `telegram_id`:

### Opção 1: Via Bot do Telegram
Os usuários devem fazer login novamente via bot do Telegram para que os dados sejam salvos automaticamente.

### Opção 2: Atualização Manual via SQL
Se você souber o telegram_id dos usuários, pode atualizar manualmente:

```sql
-- Exemplo: Atualizar telegram_id de um usuário específico
UPDATE users
SET
  telegram_id = '123456789',
  telegram_username = 'username_telegram'
WHERE email = 'usuario@example.com';
```

### Opção 3: Verificar Autenticação do Telegram
Certifique-se de que o fluxo de autenticação via Telegram está salvando corretamente:

1. **Arquivo**: `backend/src/modules/auth/*`
2. **Verificar**: Se ao fazer login via Telegram, o `telegram_id` e `telegram_username` são salvos na tabela `users`

## 📊 Resultado Esperado

Após a correção e com dados do Telegram populados:

**ANTES:**
```
Usuário: Usuario Teste
Status: Navegando
```

**DEPOIS:**
```
Usuário: João Silva
📱 123456789 @joaosilva
Status: Navegando
```

## 🚀 Deploy

Após fazer o deploy, as mudanças entrarão em vigor imediatamente. As sessões existentes serão enriquecidas com dados atualizados na próxima consulta.

## 💡 Notas Técnicas

1. **Performance**: O enriquecimento em tempo real adiciona uma query extra por sessão ativa, mas o impacto é mínimo (sessões ativas geralmente são poucas)

2. **Fallback**: Se não conseguir buscar dados da tabela `users`, mantém os dados originais da sessão

3. **Cache**: As sessões são atualizadas a cada 30 segundos no painel admin, então as mudanças aparecem rapidamente

4. **Compatibilidade**: A solução funciona tanto para sessões antigas quanto novas

## 📝 Commits Relacionados

- `fabc88d` - Porcentagens reais e melhorias no tracking de sessões
- `6391936` - Enriquecimento de dados em tempo real e limpeza de sessões

## ✅ Checklist Final

- [ ] Execute o script SQL de verificação
- [ ] Confirme que usuários têm `telegram_id` na tabela `users`
- [ ] Se necessário, popule os dados do Telegram
- [ ] Faça deploy do backend atualizado
- [ ] Teste no painel admin: verifique se nomes do Telegram aparecem
- [ ] Se ainda aparecer "Usuario Teste", execute o endpoint de limpeza de sessões
