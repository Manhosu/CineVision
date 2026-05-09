# Checklist de Produção - Sistema de Pagamentos PIX

**Data:** 2025-01-03
**Sistema:** Mercado Pago (PIX) + Entrega Automática via Telegram
**Status:** ⚠️ PENDENTE CONFIGURAÇÕES

---

## ✅ O Que Já Foi Feito

### Código
- ✅ Webhook com validação HMAC-SHA256
- ✅ Idempotência (previne pagamento duplicado)
- ✅ **CORRIGIDO:** Webhook agora chama entrega automática de conteúdo
- ✅ Auto-login para dashboard
- ✅ Integração com grupos do Telegram
- ✅ Logs de erro em `system_logs` para monitoramento

### Ambiente
- ✅ Variável `MERCADO_PAGO_WEBHOOK_SECRET` definida: `9e89c716067716fd0fb175da604bab199858e47c8ad2de99613d7e24485771f9`
- ✅ Credenciais do Mercado Pago configuradas

---

## ⚠️ PENDÊNCIAS CRÍTICAS (Bloqueiam Produção)

### 1. Ativar PIX na Conta Mercado Pago 🔴

**Status Atual:** ❌ PIX NÃO ESTÁ ATIVO
**Conta:** rafagomes2404@gmail.com (ID: 452973387)

**Como Ativar (5-10 minutos):**

#### Opção A: Via App Mercado Pago (MAIS RÁPIDO)
1. Baixe o app: [Android](https://play.google.com/store/apps/details?id=com.mercadopago.wallet) | [iOS](https://apps.apple.com/br/app/mercado-pago/id925436649)
2. Login: rafagomes2404@gmail.com
3. Vá em: **"Transferir" → "PIX"**
4. Clique: **"Criar chave PIX"**
5. Escolha: **CPF** (aprovação instantânea)
6. Siga as instruções na tela
7. Aguarde confirmação (geralmente < 1 minuto)

#### Opção B: Via Site
1. Acesse: https://www.mercadopago.com.br/
2. Login: rafagomes2404@gmail.com
3. Menu: **"Transferir" → "PIX"**
4. **"Cadastrar chave"** → Escolha CPF
5. Complete o cadastro

**Verificar se funcionou:**
```bash
cd /c/Users/delas/OneDrive/Documentos/Projetos/Filmes
node verify-mercadopago-pix.js
```

**Resultado esperado:**
```
✅ PIX está disponível!
✅ QR Code gerado com sucesso!
🎉 SUCESSO! Mercado Pago PIX está FUNCIONANDO!
```

---

### 2. Configurar Webhook no Mercado Pago Dashboard 🔴

**Status:** ⚠️ PENDENTE CONFIGURAÇÃO

**Passos:**
1. Acesse: https://www.mercadopago.com.br/developers/panel/app
2. Login: rafagomes2404@gmail.com
3. Selecione sua aplicação
4. Menu lateral: **"Webhooks"**
5. Clique: **"Configurar webhooks"** ou **"Adicionar webhook"**
6. Cole a URL: `https://cinevisionn.onrender.com/api/v1/webhooks/mercadopago`
7. Selecione o evento: **☑️ Pagamentos (payment.created, payment.updated)**
8. Salve

**Importante:** O webhook secret que você forneceu (`9e89c716067716fd0fb175da604bab199858e47c8ad2de99613d7e24485771f9`) já está configurado no código. **NÃO gere um novo secret**, use esse mesmo.

**Teste o webhook:**
- Mercado Pago tem um simulador de webhooks no dashboard
- Use para testar se o endpoint está recebendo corretamente

---

### 3. Adicionar Variável de Ambiente no Render 🟡

**Variável OBRIGATÓRIA:**
```bash
MERCADO_PAGO_WEBHOOK_SECRET=9e89c716067716fd0fb175da604bab199858e47c8ad2de99613d7e24485771f9
```

**Como adicionar:**
1. Acesse: https://dashboard.render.com/
2. Selecione o serviço: **cinevisionn**
3. Vá em: **Environment** (menu lateral)
4. Clique: **Add Environment Variable**
5. Key: `MERCADO_PAGO_WEBHOOK_SECRET`
6. Value: `9e89c716067716fd0fb175da604bab199858e47c8ad2de99613d7e24485771f9`
7. Salve

**Variável RECOMENDADA (se não existir):**
```bash
FRONTEND_URL=https://www.cinevisionapp.com.br
```

Após adicionar, o Render fará redeploy automático (aguarde ~3 minutos).

---

### 4. Executar Migração do Banco de Dados 🟡

**Arquivo:** `backend/src/database/migrations/20250111000000_fix_payment_provider_enum.sql`

**O que faz:**
- Adiciona `'mercadopago'` ao enum de providers
- Adiciona `'stripe'` ao enum de providers
- Cria índices para otimizar buscas de webhook

**Como executar:**

#### Opção A: Via Supabase Dashboard (RECOMENDADO)
1. Acesse: https://supabase.com/dashboard
2. Selecione seu projeto
3. Menu lateral: **SQL Editor**
4. Cole o conteúdo do arquivo de migração
5. Clique: **Run**

#### Opção B: Via psql
```bash
psql "postgresql://postgres:sb_secret_ys1X0kTYjBfr33jnuvRk6w_LCyCuCcu@db.szghyvnbmjlquznxhqum.supabase.co:5432/postgres"
\i backend/src/database/migrations/20250111000000_fix_payment_provider_enum.sql
```

**Verificar se funcionou:**
```sql
SELECT enumlabel
FROM pg_enum
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'payment_provider_enum')
ORDER BY enumlabel;
```

**Resultado esperado:**
```
boleto
credit_card
debit_card
mercadopago  ✅
pix
stripe       ✅
telegram
```

---

## 🟢 CONFIGURAÇÕES OPCIONAIS (Recomendadas)

### 5. Configurar Grupos do Telegram para Entrega de Conteúdo

**Contexto:** Sistema pode entregar conteúdo de 2 formas:
1. **Dashboard online** (sempre funciona)
2. **Grupo do Telegram** (requer configuração)

**Para ativar entrega via grupo:**

#### Passo 1: Criar Grupo no Telegram
1. Abra Telegram
2. Crie novo grupo: "CineVision - [Nome do Filme]"
3. Adicione o bot como admin: @CineVisionApp_rbot
4. Dê permissões: **"Convidar usuários"** e **"Gerenciar mensagens"**

#### Passo 2: Obter Link do Grupo
1. No grupo, clique em: **⋮ → Link de Convite**
2. Clique: **"Criar link de convite"**
3. Copie o link: `https://t.me/+AbCdEfGhIjKlMnOp`

#### Passo 3: Configurar no Banco de Dados
```sql
UPDATE content
SET telegram_group_link = 'https://t.me/+AbCdEfGhIjKlMnOp'
WHERE id = '<ID_DO_CONTEUDO>';
```

**Quando usuário pagar:**
- Receberá mensagem com botão: **"📱 Entrar no Grupo do Telegram"**
- Clique → Entra automaticamente no grupo
- Pode baixar o filme do grupo

**Se NÃO configurar:**
- Usuário só terá acesso via dashboard online
- Ainda funciona, mas sem download offline

---

## 📊 FLUXO COMPLETO APÓS CONFIGURAÇÕES

### Quando Usuário Pagar PIX:

```
1. 💳 Usuário paga PIX no app bancário
   ↓
2. 🔔 Mercado Pago detecta pagamento (< 5 segundos)
   ↓
3. 📡 Mercado Pago envia webhook → https://cinevisionn.onrender.com/api/v1/webhooks/mercadopago
   ↓
4. 🔐 Sistema valida assinatura HMAC-SHA256
   ↓
5. 💾 Atualiza status no banco:
   - payments.status = 'paid'
   - purchases.status = 'paid'
   ↓
6. 🚀 Sistema chama TelegramsService.deliverContentAfterPayment():
   ↓
   6.1. 📱 Envia mensagem no Telegram:
        "✅ Pagamento Confirmado!"
        "Você comprou: [Nome do Filme]"

   6.2. 🔑 Gera token de auto-login
        Link: https://www.cinevisionapp.com.br/auth/auto-login?token=ABC123

   6.3. 📱 Se telegram_group_link configurado:
        - Cria convite único (válido 24h)
        - Envia botão: "Entrar no Grupo do Telegram"
        - Usuário clica → Entra no grupo → Baixa filme

   6.4. 🌐 Envia botão: "Ver Catálogo Completo"

   6.5. 📊 Envia botão: "Minhas Compras" (dashboard)

   6.6. 💾 Loga entrega em system_logs
   ↓
7. ✅ CONCLUÍDO: Usuário tem acesso ao conteúdo!
```

### Em Caso de Erro na Entrega:
```
- ❌ Erro logado em system_logs (tipo: 'delivery_failed')
- 💰 Pagamento já está processado (não é perdido)
- 🔧 Admin pode ver erro no dashboard
- 🔄 Admin pode reenviar manualmente via system_logs
```

---

## 🧪 TESTE END-TO-END (Antes de Produção)

### Teste 1: Fluxo Completo de Compra

**Preparação:**
1. Tenha saldo no Mercado Pago ou conta bancária conectada
2. Crie um conteúdo barato para teste (ex: R$ 1,00)

**Passos:**
1. Abra Telegram e inicie conversa com @CineVisionApp_rbot
2. Browse catálogo
3. Selecione um filme/série
4. Clique: **"Comprar com PIX"**
5. **ESPERE:** QR Code ser gerado (~2-5 segundos)
6. **VERIFIQUE:** QR Code apareceu + Código PIX para copiar?
7. Abra app do banco
8. Escaneie QR Code OU cole código PIX
9. Confirme pagamento
10. **AGUARDE:** 5-15 segundos
11. **VERIFIQUE:** Bot enviou mensagem de confirmação?
12. **VERIFIQUE:** Mensagem tem botão "Minhas Compras"?
13. Clique em "Minhas Compras"
14. **VERIFIQUE:** Dashboard abriu automaticamente (auto-login)?
15. **VERIFIQUE:** Filme aparece na lista "Meus Filmes"?
16. Clique em "Assistir"
17. **VERIFIQUE:** Vídeo carrega e reproduz?

**Se telegram_group_link configurado:**
18. **VERIFIQUE:** Bot enviou botão "Entrar no Grupo do Telegram"?
19. Clique no botão
20. **VERIFIQUE:** Você entrou no grupo automaticamente?
21. **VERIFIQUE:** Pode ver/baixar o filme no grupo?

### Teste 2: Segurança do Webhook

**Objetivo:** Verificar que webhooks falsos são rejeitados

**Teste com curl:**
```bash
curl -X POST https://cinevisionn.onrender.com/api/v1/webhooks/mercadopago \
  -H "Content-Type: application/json" \
  -H "x-signature: ts=1234567890,v1=fakehash" \
  -H "x-request-id: test-123" \
  -d '{"type":"payment","action":"payment.updated","data":{"id":"123"}}'
```

**Resultado esperado:**
```json
{ "received": false }
```

**Verifique nos logs do Render:**
- Deve aparecer: "❌ Invalid webhook signature"
- Deve aparecer: "This could be a fraudulent webhook attempt"

### Teste 3: Idempotência (Webhook Duplicado)

**Objetivo:** Verificar que webhook duplicado não entrega conteúdo 2x

**Passos:**
1. Faça um pagamento real
2. Aguarde confirmação
3. No Mercado Pago dashboard, vá em Webhooks
4. Reenvie o mesmo webhook manualmente
5. **VERIFIQUE:** Usuário NÃO recebeu mensagem duplicada
6. **VERIFIQUE:** Logs mostram "already processed as paid - skipping"

---

## 📝 LOGS PARA MONITORAR

### Durante Teste, Monitore os Logs do Render:

**URL:** https://dashboard.render.com/ → Selecione serviço → Logs tab

**Busque por:**

#### ✅ Sucesso:
```
Received Mercado Pago webhook
✅ Webhook signature verified successfully
Payment {id} status: approved
✅ Payment {id} successfully processed - Purchase {id} is now PAID
Delivering content for purchase {id} to user...
✅ Content successfully delivered for purchase {id}
```

#### ❌ Erro de Assinatura (CRÍTICO):
```
❌ Invalid webhook signature
This could be a fraudulent webhook attempt
```
**Ação:** Verifique se `MERCADO_PAGO_WEBHOOK_SECRET` está correto no Render

#### ❌ Erro de Entrega (ATENÇÃO):
```
❌ Failed to deliver content for purchase {id}
```
**Ação:**
1. Veja detalhes do erro no log
2. Consulte `system_logs` no banco:
```sql
SELECT * FROM system_logs
WHERE type = 'delivery_failed'
ORDER BY created_at DESC
LIMIT 10;
```

#### 🔁 Idempotência (OK):
```
Payment {id} already processed as paid - skipping (idempotency)
```
**Significado:** Webhook duplicado foi ignorado corretamente (esperado)

---

## 🚨 TROUBLESHOOTING

### Problema: "QR Code PIX não gerou"
**Causa:** PIX não está ativo na conta Mercado Pago
**Solução:** Ver Pendência #1 acima

### Problema: "Webhook não chegou após pagamento"
**Causas possíveis:**
1. Webhook não configurado no Mercado Pago dashboard → Ver Pendência #2
2. URL do webhook incorreta → Deve ser exatamente: `https://cinevisionn.onrender.com/api/v1/webhooks/mercadopago`
3. Render está offline → Verifique logs

### Problema: "Pagamento aprovado mas usuário não recebeu conteúdo"
**Diagnóstico:**
1. Verifique logs do Render: tem "✅ Content successfully delivered"?
2. Se NÃO: veja erro de entrega nos logs
3. Consulte `system_logs`:
```sql
SELECT * FROM system_logs
WHERE type = 'delivery_failed'
AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

**Soluções:**
- Se erro é "No telegram chat_id": Usuário comprou pelo site, não pelo bot → Não tem Telegram registrado
- Se erro é "Failed to send message": Bot pode estar com problema → Verifique `TELEGRAM_BOT_TOKEN`
- Se erro é "Content not found": content_id inválido → Verifique purchase no banco

### Problema: "Assinatura de webhook inválida"
**Causa:** `MERCADO_PAGO_WEBHOOK_SECRET` incorreto ou não configurado
**Solução:**
1. Verifique no Render: Environment → `MERCADO_PAGO_WEBHOOK_SECRET`
2. Deve ser: `9e89c716067716fd0fb175da604bab199858e47c8ad2de99613d7e24485771f9`
3. Se diferente, corrija e redeploy

---

## ✅ CHECKLIST FINAL (Antes de Liberar para Usuários)

- [ ] PIX ativado na conta Mercado Pago (`node verify-mercadopago-pix.js` passa)
- [ ] Webhook configurado no Mercado Pago dashboard
- [ ] `MERCADO_PAGO_WEBHOOK_SECRET` adicionado no Render
- [ ] Migração do banco de dados executada (enum tem 'mercadopago')
- [ ] Deploy realizado com sucesso
- [ ] Teste end-to-end completo passou
- [ ] Teste de segurança (webhook falso rejeitado) passou
- [ ] Teste de idempotência passou
- [ ] Logs não mostram erros críticos
- [ ] (Opcional) Grupos do Telegram configurados para conteúdos principais

**Tempo estimado para completar checklist:** 30-45 minutos

---

## 📞 SUPORTE

### Se Encontrar Problemas:

**Mercado Pago:**
- Docs: https://www.mercadopago.com.br/developers/pt/docs
- Suporte: https://www.mercadopago.com.br/developers/pt/support
- Chat: No app Mercado Pago (canto inferior direito)

**Sistema CineVision:**
- Logs do Render: https://dashboard.render.com/
- Logs do sistema: Tabela `system_logs` no Supabase
- Monitoramento: Query de falhas de entrega (ver seção Troubleshooting)

---

## 🎉 APÓS CONFIGURAÇÃO COMPLETA

Sistema estará **100% PRONTO PARA PRODUÇÃO** com:

✅ Pagamentos PIX funcionando
✅ Validação de assinatura (segurança)
✅ Idempotência (confiabilidade)
✅ Entrega automática de conteúdo
✅ Auto-login para dashboard
✅ Integração com grupos do Telegram
✅ Logs de erro para monitoramento

**Usuários poderão:**
1. Pagar via PIX pelo Telegram bot
2. Receber conteúdo automaticamente em 5-15 segundos
3. Acessar dashboard via auto-login (sem senha)
4. Entrar em grupos do Telegram para download
5. Assistir online via dashboard

**Você poderá:**
1. Monitorar todos os pagamentos em tempo real
2. Ver erros de entrega em `system_logs`
3. Rastrear conversão de pagamentos
4. Gerar relatórios de vendas

---

**Boa sorte com o lançamento! 🚀**
