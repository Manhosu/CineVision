# 🤖 Bot do Telegram - Status e Documentação

## ✅ Status Atual

**Bot funcionando em POLLING MODE desde Janeiro/2025**

```
✅ Bot responde 24/7
✅ Funciona com Free Instance (servidor pode dormir)
✅ Latência: 1-3 segundos (aceitável)
✅ Sem custo extra de servidor
✅ Todas as funcionalidades mantidas
```

---

## 📊 Configuração Atual

### Hosting (Render)

| Item | Configuração | Custo |
|------|--------------|-------|
| **Workspace Plan** | Professional | $19/mês |
| **Backend Instance** | Free | $0/mês |
| **Bot Mode** | Polling | Incluído |
| **TOTAL** | | **$19/mês** |

### Por que Polling?

```
Cliente pagou Professional Workspace ($19/mês)
         ↓
MAS isso não afeta recursos do servidor
         ↓
Backend continua em FREE Instance
         ↓
FREE dorme após 15 min → Webhook falha
         ↓
✅ SOLUÇÃO: Polling funciona mesmo se dormir!
```

---

## 🎯 Funcionalidades do Bot

### Compras e Pagamentos
- ✅ Catálogo completo (filmes + séries)
- ✅ Compra via PIX (Mercado Pago)
- ✅ Confirmação automática de pagamento
- ✅ Entrega via dashboard + Telegram

### Grupos do Telegram
- ✅ Adição automática ao grupo (se bot for admin)
- ✅ Fallback: Link único com expiração (24h)
- ✅ Fallback final: Link permanente do grupo

### Notificações
- ✅ Confirmação de pagamento
- ✅ Informações de acesso ao conteúdo
- ✅ Status da compra

### Outros
- ✅ Telegram Mini App support
- ✅ Verificação de email
- ✅ Histórico de compras
- ✅ Assistir vídeos por categoria/idioma

---

## 📁 Documentação

### Principais Documentos

1. **MUDANCA-PARA-POLLING.md**
   - Por que mudamos para polling
   - Como funciona
   - Vantagens e desvantagens
   - Comparação com webhook

2. **RENDER-PLANOS-EXPLICACAO.md**
   - Diferença entre Workspace e Instance plans
   - Por que Professional workspace não resolve o sleep
   - Opções e custos
   - Recomendações por fase

3. **CONFIGURAR-BOT-GRUPO.md**
   - Como configurar grupos do Telegram
   - Adição automática de usuários
   - Scripts úteis

4. **RESUMO-GRUPOS-TELEGRAM.md**
   - Sistema de grupos implementado
   - Triple-strategy de adição
   - Funcionalidades

### Arquivos Arquivados

Docs sobre webhook (não mais relevantes):
- `docs-archived/NECESSIDADE-UPGRADE-RENDER.md`
- `docs-archived/MENSAGEM-PARA-CLIENTE.md`
- `docs-archived/RESUMO-SITUACAO-WEBHOOK.md`
- `docs-archived/APROVEITANDO-PLANO-PROFESSIONAL.md`

---

## 🔧 Arquitetura Técnica

### Polling Implementation

**Arquivo:** `src/modules/telegrams/telegrams-enhanced.service.ts`

```typescript
// Inicia automaticamente no onModuleInit
async onModuleInit() {
  this.logger.log('🤖 Starting Telegram bot in POLLING mode...');
  await this.deleteWebhook();  // Remove webhook se existir
  this.startPolling();         // Inicia polling
  this.logger.log('✅ Telegram bot polling started successfully');
}

// Loop de polling (roda a cada 100ms)
private async poll() {
  const response = await axios.post(`${this.botApiUrl}/getUpdates`, {
    offset: this.pollingOffset,
    timeout: 30,
    allowed_updates: ['message', 'callback_query'],
  });

  // Processa atualizações
  for (const update of response.data.result) {
    await this.handleUpdate(update);
    this.pollingOffset = update.update_id + 1;
  }

  // Próximo poll
  setTimeout(() => this.poll(), 100);
}
```

### Triple-Strategy para Grupos

```typescript
// 1. Tenta adicionar automaticamente
userAddedAutomatically = await this.addUserToGroup(
  content.telegram_group_link,
  parseInt(user.telegram_id)
);

if (!userAddedAutomatically) {
  // 2. Cria link único de convite (24h, 1 uso)
  telegramInviteLink = await this.createInviteLinkForUser(
    content.telegram_group_link,
    user.id
  );

  if (!telegramInviteLink) {
    // 3. Usa link permanente do grupo
    telegramInviteLink = content.telegram_group_link;
  }
}
```

### Endpoints Ativos

```
✅ POST /telegrams/send-notification
✅ POST /telegrams/payment-confirmation
✅ POST /telegrams/new-release-notification
✅ POST /telegrams/verify-email
✅ POST /telegrams/purchase
✅ POST /telegrams/payment-success
✅ POST /telegrams/payment-cancel
✅ POST /telegrams/miniapp/purchase
✅ GET  /telegrams/health
```

### Endpoints Desabilitados

```
❌ POST /telegrams/webhook          (não usado em polling)
❌ POST /telegrams/setup-webhook    (não usado em polling)
❌ GET  /telegrams/setup-webhook    (não usado em polling)
```

---

## 💰 Análise de Custos

### Configuração Atual vs Alternativas

| Config | Workspace | Instance | Custo | Bot OK? | Latência |
|--------|-----------|----------|-------|---------|----------|
| **Atual** | Professional | Free + Polling | **$19/mês** | ✅ Sim | ~2s |
| Alt 1 | Hobby | Starter + Webhook | $7/mês | ✅ Sim | <1s |
| Alt 2 | Professional | Starter + Webhook | $26/mês | ✅ Sim | <1s |

### Economia com Polling

```
Webhook precisaria: Professional + Starter = $26/mês
Polling permite:    Professional + Free   = $19/mês
                    ────────────────────────
ECONOMIA:                                   $7/mês
                                           $84/ano
```

### Quando Considerar Mudança?

```
Manter polling SE:
✅ Volume < 1000 mensagens/dia
✅ Latência de 2s aceitável
✅ Orçamento limitado

Mudar para webhook SE:
⚠️ Volume > 1000 mensagens/dia
⚠️ Latência crítica (<1s necessário)
⚠️ Orçamento permite (+$7/mês)
```

---

## 🚀 Deploy

### Automático via Git

```bash
git push origin main
# Render detecta mudança
# Backend reinicia
# Polling inicia automaticamente
```

### Verificar Logs

```
Render Dashboard → Services → backend → Logs

Procurar por:
✅ "🤖 Starting Telegram bot in POLLING mode..."
✅ "Webhook deleted successfully"
✅ "✅ Telegram bot polling started successfully"
```

### Testar Bot

1. Abrir Telegram
2. Procurar pelo bot
3. Enviar `/start`
4. Bot deve responder em 1-3 segundos
5. Testar compra de filme
6. Verificar entrega e grupos

---

## 🐛 Troubleshooting

### Bot não responde?

**1. Verificar logs do Render**
```
Procurar por:
- "Starting Telegram bot in POLLING mode"
- Erros de conexão
- 409 Conflict errors
```

**2. Verificar se polling está rodando**
```typescript
// Deve aparecer nos logs a cada ~30 segundos
// "Polling for updates..."
```

**3. Verificar token do bot**
```bash
# No Render Dashboard → Environment Variables
TELEGRAM_BOT_TOKEN=<seu-token>
```

### Bot responde mas compra não funciona?

**1. Verificar Mercado Pago**
```
- Credenciais corretas?
- Webhook configurado?
- PIX ativado na conta?
```

**2. Verificar Supabase**
```
- Banco conectado?
- Tabelas existem?
- Permissões corretas?
```

### Grupos não funcionam?

**1. Bot é admin do grupo?**
```
- Precisa ser admin
- Precisa ter permissão "add members"
```

**2. Verificar telegram_group_link**
```sql
SELECT id, title, telegram_group_link
FROM content
WHERE telegram_group_link IS NOT NULL;
```

**3. Usar script de teste**
```bash
cd backend
node check-telegram-groups.js
```

---

## 📈 Próximos Passos (Futuro)

### Curto Prazo (1-3 meses)
- [ ] Monitorar latência e volume
- [ ] Coletar feedback dos usuários
- [ ] Otimizar mensagens do bot
- [ ] Adicionar mais comandos úteis

### Médio Prazo (3-6 meses)
- [ ] Avaliar necessidade de webhook
- [ ] Considerar upgrade para Starter Instance se volume crescer
- [ ] Implementar analytics de uso do bot
- [ ] A/B testing de mensagens

### Longo Prazo (6-12 meses)
- [ ] Cache em memória (se upgrade para Standard)
- [ ] Background jobs para notificações
- [ ] Bot multilíngue
- [ ] Comandos administrativos avançados

---

## 📞 Suporte

### Render Support
- Professional workspace tem **chat support**
- Resposta em ~1-4 horas
- Dashboard → Help → Chat

### Telegram Bot API
- Documentação: https://core.telegram.org/bots/api
- @BotSupport (bot oficial de suporte)
- @BotFather (criação e gestão de bots)

### Issues Conhecidos

**1. Cold Start no Free Tier**
```
Sintoma: Primeira requisição após 15+ min demora
Causa: Servidor dormindo precisa acordar
Solução: Polling contorna isso automaticamente
```

**2. Latência ~2 segundos**
```
Sintoma: Bot demora 2s pra responder
Causa: Polling verifica a cada ~100ms + processamento
Solução: Normal, aceitável para uso atual
```

---

## 🎓 Lições Aprendidas

### 1. Render tem DOIS tipos de planos
```
❌ Workspace Plans = Colaboração (não afeta recursos)
✅ Instance Plans  = Recursos do servidor (RAM, CPU)

Cuidado ao contratar!
```

### 2. Free Tier não é para produção com webhooks
```
❌ Serviço dorme após 15 min
❌ Cold start de 30-60s
❌ Webhook timeout do Telegram: 60s
❌ = Bot para de funcionar

✅ Polling funciona mesmo com sleep!
```

### 3. Polling é uma ótima alternativa
```
✅ Funciona com free tier
✅ Simples de implementar
✅ Confiável
⚠️ Latência +2s (aceitável para baixo volume)
```

### 4. Professional Workspace é útil
```
✅ Chat support é bom
✅ Features de colaboração
⚠️ Mas não resolve problema do free instance
```

---

## ✅ Checklist de Deploy

Use isso ao fazer deploy ou mudanças:

- [ ] Código commitado no git
- [ ] Push para main branch
- [ ] Render detectou e iniciou build
- [ ] Build completou sem erros
- [ ] Serviço reiniciou
- [ ] Logs mostram "Polling started successfully"
- [ ] Testar `/start` no bot
- [ ] Testar compra de teste
- [ ] Verificar entrega de conteúdo
- [ ] Verificar grupos (se aplicável)
- [ ] Documentação atualizada

---

## 📊 Métricas para Monitorar

### Performance
- [ ] Tempo de resposta do bot (<5s)
- [ ] Taxa de sucesso de comandos (>95%)
- [ ] Uptime do polling (>99%)

### Negócio
- [ ] Vendas via Telegram
- [ ] Taxa de conversão
- [ ] Abandono de carrinho
- [ ] Satisfação dos usuários

### Técnicas
- [ ] Erros nos logs (<1%)
- [ ] Cold starts por dia
- [ ] Conflitos de polling (409 errors)

---

## 📝 Changelog

### 2025-01-10 - v2.0.0
- ✅ Mudança de webhook para polling mode
- ✅ Bot funciona com Free Instance
- ✅ Endpoints de webhook desabilitados
- ✅ Documentação completa criada
- ✅ Scripts de teste e verificação

### 2025-01-XX - v1.5.0
- ✅ Triple-strategy para grupos
- ✅ Adição automática de usuários
- ✅ Fallback para links únicos
- ✅ Sistema de grupos implementado

### 2025-01-XX - v1.0.0
- ✅ Bot básico com webhook
- ✅ Integração com Mercado Pago
- ✅ Sistema de compras
- ✅ Entrega de conteúdo

---

**Última atualização:** 10/01/2025
**Versão:** 2.0.0 (Polling Mode)
**Status:** ✅ Produção Estável
