# 📱 Guia Completo: Sistema de Grupos do Telegram

## ⚠️ IMPORTANTE: Limitações da API do Telegram

A API do Telegram **NÃO permite que bots adicionem usuários automaticamente** a grupos privados por questões de privacidade e segurança.

### O que é possível fazer:
✅ Criar links de convite personalizados (uso único, com expiração)
✅ Enviar botão inline para o usuário clicar e entrar
✅ Aprovar automaticamente solicitações de entrada (se configurado)

### O que NÃO é possível:
❌ Adicionar usuário sem nenhuma ação dele
❌ Forçar entrada automática em grupo privado
❌ Bypass de privacidade do Telegram

---

## 🎯 Como Funciona o Sistema Atual

### Fluxo após Compra:

```
Pagamento Confirmado
    ↓
Bot verifica se conteúdo tem telegram_group_link configurado
    ↓
SIM → Cria link de convite único (válido 24h, uso único)
    ↓
Envia mensagem com BOTÃO INLINE:
  📱 Entrar no Grupo do Telegram [CLIQUE AQUI]
  🌐 Acessar Dashboard
    ↓
Usuário clica no botão → Entra automaticamente no grupo
```

**Resultado:** O usuário precisa apenas **1 clique** para entrar no grupo! 🎉

---

## 🛠️ Configuração do Grupo

### Passo 1: Criar o Grupo

1. Abra o Telegram
2. Crie um novo grupo (privado ou público)
3. Adicione os vídeos/arquivos que serão compartilhados

### Passo 2: Adicionar o Bot como Admin

1. No grupo, clique em **⋮** (três pontos) → **Administradores**
2. Clique em **Adicionar Administrador**
3. Procure por: `@CineVisionApp_rbot` (ou seu bot)
4. Selecione o bot
5. **IMPORTANTE:** Ative a permissão **"Convidar usuários via link"**
6. Confirme

### Passo 3: Obter o Chat ID do Grupo

#### Método 1: Script Automático (Recomendado)
```bash
cd backend
node get-chat-id.js
```

Envie uma mensagem no grupo (ex: `/start`) antes de executar o script.

#### Método 2: Manual

**Para grupos PÚBLICOS:**
- Use o username: `@nomegrupo`
- Ou a URL: `https://t.me/nomegrupo`

**Para grupos PRIVADOS:**
1. Envie uma mensagem no grupo
2. Use o script `get-chat-id.js`
3. Copie o Chat ID (ex: `-1001234567890`)

### Passo 4: Configurar no Admin

1. Acesse `/admin/content/create`
2. Preencha os dados do filme
3. No campo **"Link do Grupo do Telegram"**, cole:
   - Chat ID numérico: `-1001234567890`
   - OU Username público: `@nomegrupo`
   - OU URL pública: `https://t.me/nomegrupo`
4. Salve o conteúdo

---

## 🧪 Testes

### Verificar Configuração do Bot

```bash
cd backend
node test-telegram-invite.js
```

Este script verifica:
- ✅ Se o bot está online
- ✅ Se as variáveis de ambiente estão configuradas
- ✅ Instruções passo a passo

### Fazer Compra Teste

1. Crie um conteúdo com `telegram_group_link` configurado
2. Faça uma compra teste via PIX ou cartão
3. Aguarde confirmação do pagamento
4. Verifique a mensagem do bot no Telegram
5. Clique no botão **"Entrar no Grupo do Telegram"**
6. Confirme que você foi adicionado ao grupo

### Monitorar Logs

```sql
-- Logs de criação de links de convite
SELECT * FROM system_logs
WHERE type = 'telegram_group'
ORDER BY created_at DESC
LIMIT 50;

-- Logs de entrega de conteúdo
SELECT * FROM system_logs
WHERE type = 'delivery'
ORDER BY created_at DESC
LIMIT 50;
```

---

## 📋 Formatos Aceitos para `telegram_group_link`

| Formato | Exemplo | Funciona? |
|---------|---------|-----------|
| Chat ID numérico | `-1001234567890` | ✅ Sim (privado/público) |
| Username | `@nomegrupo` | ✅ Sim (apenas público) |
| URL pública | `https://t.me/nomegrupo` | ✅ Sim (apenas público) |
| Link de convite | `https://t.me/+AbCdEfGhIjK` | ⚠️ Não funciona* |

**\* Links de convite privados:** O sistema **não consegue** extrair o Chat ID de links privados. Use o Chat ID numérico em vez disso.

---

## 🔧 Troubleshooting

### Problema: "Failed to create invite link"

**Causa:** Bot não é admin do grupo ou não tem permissão de convidar usuários.

**Solução:**
1. Verifique se o bot está no grupo
2. Verifique se o bot é **ADMIN**
3. Verifique se a permissão **"Convidar usuários via link"** está ativada

### Problema: "Cannot extract chat ID from link"

**Causa:** Você forneceu um link de convite privado (ex: `https://t.me/+AbCdEfGhIjK`).

**Solução:**
Use o Chat ID numérico em vez do link. Execute:
```bash
node get-chat-id.js
```

### Problema: "User not added to group"

**Causa:** Link de convite expirou ou usuário já usou o link.

**Solução:**
- Links expiram em 24 horas
- Links de uso único só funcionam uma vez
- O sistema cria um novo link para cada compra

### Problema: Bot offline

**Solução:**
```bash
node test-telegram-invite.js
```

Verifique se o `TELEGRAM_BOT_TOKEN` está correto.

---

## 💡 Dicas e Boas Práticas

### Organização de Grupos

**Opção A - Um grupo por filme:**
- ✅ Mais organizado
- ✅ Controle granular
- ❌ Mais trabalho para gerenciar

**Opção B - Um grupo para vários filmes:**
- ✅ Fácil de gerenciar
- ✅ Menos grupos
- ❌ Menos organizado

**Opção C - Grupos por categoria:**
- ✅ Bom equilíbrio
- Exemplo: "Ação", "Comédia", "Drama"

### Segurança

- ✅ Use grupos **privados** (não públicos)
- ✅ Não compartilhe links de convite permanentes
- ✅ Configure expiração automática de links
- ✅ Revise membros periodicamente

### Performance

- O sistema cria links de convite **sob demanda** (após cada compra)
- Links são de **uso único** para segurança
- Links expiram em **24 horas**
- Não há limite de links que podem ser criados

---

## 📊 Estatísticas e Monitoramento

### Ver quantos links foram criados hoje

```sql
SELECT COUNT(*) as links_criados_hoje
FROM system_logs
WHERE type = 'telegram_group'
  AND level = 'info'
  AND message LIKE '%Created single-use invite link%'
  AND created_at >= CURRENT_DATE;
```

### Ver falhas na criação de links

```sql
SELECT created_at, message
FROM system_logs
WHERE type = 'telegram_group'
  AND level = 'error'
ORDER BY created_at DESC
LIMIT 20;
```

### Ver conteúdos sem grupo configurado

```sql
SELECT id, title, telegram_group_link
FROM content
WHERE telegram_group_link IS NULL
  AND status = 'published';
```

---

## 🚀 Próximos Passos (Opcional)

### Melhorias Futuras

1. **Auto-aprovação de solicitações**
   - Configure grupo para "Aprovar novos membros"
   - Bot aprova automaticamente compradores
   - Código: `approveChatJoinRequest`

2. **Estatísticas de entrada**
   - Rastrear quantos usuários entraram
   - Tempo médio entre compra e entrada
   - Taxa de conversão (compra → entrada)

3. **Notificações**
   - Alertar admin quando usuário não entra em 24h
   - Reenviar link automaticamente
   - Lembrete antes do link expirar

---

## 📚 Referências

- [Telegram Bot API - createChatInviteLink](https://core.telegram.org/bots/api#createchatinvitelink)
- [Telegram Bot API - approveChatJoinRequest](https://core.telegram.org/bots/api#approvechatjoinrequest)
- [Telegram Bot API - getChat](https://core.telegram.org/bots/api#getchat)

---

## ❓ FAQ

**P: O usuário pode entrar quantas vezes quiser?**
R: Não. O link é de **uso único**. Após entrar uma vez, o link expira.

**P: E se o usuário sair do grupo acidentalmente?**
R: O sistema pode criar um novo link para ele (funcionalidade futura).

**P: Posso usar o mesmo grupo para vários filmes?**
R: Sim! Basta usar o mesmo `telegram_group_link` em múltiplos conteúdos.

**P: O link expira mesmo se não for usado?**
R: Sim, após 24 horas o link expira automaticamente.

**P: Quantos membros um grupo pode ter?**
R: Grupos do Telegram suportam até **200.000 membros**.

---

## ✅ Checklist Final

Antes de ir para produção, verifique:

- [ ] Bot é admin em todos os grupos
- [ ] Permissão "Convidar usuários via link" ativada
- [ ] Chat IDs corretos configurados nos conteúdos
- [ ] Teste de compra completo realizado
- [ ] Logs monitorados (sem erros)
- [ ] Vídeos/arquivos adicionados aos grupos
- [ ] Mensagem de boas-vindas configurada (opcional)

---

**Documentação atualizada em:** 31/01/2025
**Versão:** 1.0
