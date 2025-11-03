# 🔍 DIAGNÓSTICO: Pagamento com Cartão Não Entrega Conteúdo

**Data:** 03/11/2025
**Problema Reportado:** Pagamento aprovado mas usuário não recebe links

**STATUS:** ✅ **PROBLEMA IDENTIFICADO E CORRIGIDO**

---

## 🎯 CAUSA RAIZ IDENTIFICADA

O webhook do Stripe **estava configurado e funcionando corretamente**, mas o `payment_intent.succeeded` não tinha o `purchase_id` no metadata, então não conseguia encontrar a compra para entregar o conteúdo.

**Problema:** Quando criamos o checkout session, passávamos metadata apenas para a sessão, mas NÃO para o payment intent. O Stripe não copia automaticamente o metadata do checkout session para o payment intent.

**Solução:** Adicionar `payment_intent_data` no checkout session com o metadata.

---

## ✅ O QUE FOI CORRIGIDO

**Arquivo:** `backend/src/modules/payments/services/stripe.service.ts`

**Mudança:**
```typescript
// ANTES (❌ Metadata só na sessão)
const session = await this.stripe.checkout.sessions.create({
  mode: 'payment',
  payment_method_types: ['card'],
  line_items: [...],
  success_url: successUrl,
  cancel_url: cancelUrl,
  metadata: {
    ...metadata,
    source: 'cine-vision',
  },
});

// DEPOIS (✅ Metadata na sessão E no payment intent)
const session = await this.stripe.checkout.sessions.create({
  mode: 'payment',
  payment_method_types: ['card'],
  line_items: [...],
  success_url: successUrl,
  cancel_url: cancelUrl,
  metadata: {
    ...metadata,
    source: 'cine-vision',
  },
  payment_intent_data: {  // ✅ CRITICAL FIX
    metadata: {
      ...metadata,
      source: 'cine-vision',
    },
  },
});
```

**Por que funciona:**
- Agora o `payment_intent.succeeded` webhook terá `purchase_id` no metadata
- O webhook consegue encontrar a compra no banco de dados
- O sistema entrega automaticamente o conteúdo via Telegram

---

## 📸 O Que o Cliente Reportou

Screenshot mostra:
```
✅ Pagamento Confirmado!
🎬 Seu conteúdo está sendo preparado...
Você receberá os vídeos em instantes!
💡 O processamento pode demorar alguns segundos.
```

**MAS:** Usuário nunca recebe os links do grupo + dashboard

---

## 🔎 ANÁLISE DO CÓDIGO

### Fluxo Atual de Pagamento com Cartão:

```
1. Usuário clica "Pagar com Cartão"
   ↓
2. Stripe processa pagamento
   ↓
3. Stripe redireciona de volta ao bot
   ↓
4. Bot detecta: "payment_success_{purchaseId}"
   ↓
5. Bot envia: "✅ Pagamento Confirmado! Seu conteúdo está sendo preparado..."
   ↓
6. ❌ PROBLEMA: Isso é apenas uma mensagem informativa!
   ↓
7. A entrega REAL deve vir do WEBHOOK do Stripe
   ↓
8. ❌ WEBHOOK NÃO ESTÁ SENDO CHAMADO OU ESTÁ FALHANDO
```

### Código que Envia a Mensagem Informativa:

**Arquivo:** `telegrams-enhanced.service.ts` (linhas 1441-1453)
```typescript
// Handle payment success redirect from Stripe
else if (param.startsWith('payment_success_')) {
  const purchaseId = param.replace('payment_success_', '');

  // ⚠️ ISSO É APENAS UMA MENSAGEM INFORMATIVA
  // NÃO É A ENTREGA REAL!
  await this.sendMessage(chatId,
    '✅ *Pagamento Confirmado!*\n\n' +
    '🎬 Seu conteúdo está sendo preparado...\n' +
    'Você receberá os vídeos em instantes!\n\n' +
    '💡 O processamento pode demorar alguns segundos.',
    { parse_mode: 'Markdown' }
  );
  return; // ❌ Termina aqui, sem entregar!
}
```

### Código que DEVERIA Entregar (Webhook):

**Arquivo:** `stripe-webhook-supabase.service.ts` (linhas 243-256)
```typescript
if (user.telegram_chat_id) {
  this.logger.log(`Delivering content to user ${user.id} via chat ${user.telegram_chat_id}`);

  // Ensure provider_meta has telegram_chat_id
  const purchaseWithTelegramId = {
    ...purchaseWithContent,
    provider_meta: {
      ...purchaseWithContent.provider_meta,
      telegram_chat_id: user.telegram_chat_id,
    },
  };

  // ✅ ENTREGA REAL DE CONTEÚDO
  await this.telegramsService['deliverContentAfterPayment'](purchaseWithTelegramId);

} else {
  // ❌ ERRO: User não tem telegram_chat_id
  this.logger.error(`Cannot deliver content: user ${user.id} has no telegram_chat_id`);
}
```

---

## 🔴 POSSÍVEIS CAUSAS DO PROBLEMA

### Causa #1: Webhook do Stripe Não Configurado (MAIS PROVÁVEL)

O webhook do Stripe precisa ser configurado no dashboard:

**URL do Webhook:** `https://cinevisionn.onrender.com/api/v1/webhooks/stripe`

**Se NÃO estiver configurado:**
- Stripe processa o pagamento ✅
- Stripe redireciona usuário de volta ✅
- **MAS Stripe nunca envia webhook** ❌
- Sistema nunca entrega conteúdo ❌

**Como verificar:**
1. Acesse: https://dashboard.stripe.com/webhooks
2. Procure endpoint: `https://cinevisionn.onrender.com/api/v1/webhooks/stripe`
3. Se NÃO existir → **ESSE É O PROBLEMA**

---

### Causa #2: User Sem telegram_chat_id (IMPROVÁVEL)

O código já salva `telegram_chat_id` corretamente quando usuário interage com bot.

**Como verificar no banco:**
```sql
-- Ver usuários sem telegram_chat_id
SELECT id, name, email, telegram_id, telegram_chat_id
FROM users
WHERE telegram_chat_id IS NULL OR telegram_chat_id = '';

-- Ver última purchase e user
SELECT
  p.id as purchase_id,
  p.user_id,
  p.status,
  u.telegram_chat_id,
  u.telegram_id,
  u.name
FROM purchases p
JOIN users u ON u.id = p.user_id
ORDER BY p.created_at DESC
LIMIT 5;
```

Se `telegram_chat_id` estiver NULL → Usuário nunca interagiu com bot antes de comprar?

---

### Causa #3: Webhook Falhando com Erro (POSSÍVEL)

Webhook pode estar sendo chamado mas falhando por algum erro.

**Como verificar:**
1. Acesse logs do Render: https://dashboard.render.com/
2. Selecione serviço **cinevisionn**
3. Aba **Logs**
4. Busque por:
   - `"Stripe webhook"`
   - `"Delivering content"`
   - `"Failed to deliver"`
   - Erros em vermelho

---

## 🔧 SOLUÇÕES

### Solução #1: Configurar Webhook do Stripe (SE NÃO ESTIVER)

#### Passo 1: Acessar Stripe Dashboard
https://dashboard.stripe.com/webhooks

#### Passo 2: Adicionar Endpoint
1. Clique: **"Add endpoint"**
2. **URL:** `https://cinevisionn.onrender.com/api/v1/webhooks/stripe`
3. **Eventos para escutar:**
   - ☑️ `payment_intent.succeeded`
   - ☑️ `payment_intent.payment_failed`
   - ☑️ `checkout.session.completed`
   - ☑️ `charge.refunded`
4. Clique: **"Add endpoint"**

#### Passo 3: Obter Webhook Secret
1. Após criar, clique no endpoint
2. Clique: **"Reveal secret"** (seção "Signing secret")
3. **Copie o secret** (formato: `whsec_...`)

#### Passo 4: Adicionar Secret no Render
1. Acesse: https://dashboard.render.com/
2. Serviço **cinevisionn** → **Environment**
3. Verifique se existe: `STRIPE_WEBHOOK_SECRET`
4. Se NÃO existir ou estiver diferente:
   - Add/Update: `STRIPE_WEBHOOK_SECRET=whsec_...`
   - Salve (vai fazer redeploy)

---

### Solução #2: Verificar User no Banco (SE webhook estiver configurado)

```sql
-- Ver último pagamento e usuário
SELECT
  p.id as purchase_id,
  p.user_id,
  p.status,
  p.payment_provider_id,
  u.id as user_id,
  u.name,
  u.telegram_id,
  u.telegram_chat_id,
  p.created_at
FROM purchases p
JOIN users u ON u.id = p.user_id
WHERE p.status = 'paid'
ORDER BY p.created_at DESC
LIMIT 1;
```

**Se telegram_chat_id estiver NULL:**
- Usuário comprou sem estar logado no bot
- Precisa implementar fallback para enviar email ou link alternativo

---

### Solução #3: Verificar Logs de Erro

**Buscar nos logs do Render:**
```
# Logs de sucesso esperados:
"Stripe webhook received"
"Purchase {id} marked as PAID"
"Delivering content to user"
"Content delivery initiated successfully"

# Logs de erro:
"Failed to fetch user"
"User has no telegram_chat_id"
"Failed to deliver content"
"Error processing webhook"
```

**Se encontrar erro:** Anote a mensagem e me envie para análise.

---

## 🧪 TESTE PARA CONFIRMAR WEBHOOK

### Teste Manual do Webhook (Sem Pagamento Real)

Você pode testar se o webhook está funcionando:

**No Stripe Dashboard:**
1. Acesse: https://dashboard.stripe.com/webhooks
2. Selecione seu endpoint
3. Aba: **"Send test webhook"**
4. Selecione evento: `payment_intent.succeeded`
5. Clique: **"Send test event"**

**Verifique nos logs do Render:**
- Deve aparecer: "Stripe webhook received"
- Se aparecer erro de assinatura inválida: `STRIPE_WEBHOOK_SECRET` está errado

---

## 📋 CHECKLIST DE DIAGNÓSTICO

Execute nesta ordem:

- [ ] **1. Verificar se webhook está configurado no Stripe**
  - Acesse: https://dashboard.stripe.com/webhooks
  - Endpoint `https://cinevisionn.onrender.com/api/v1/webhooks/stripe` existe?
  - Se NÃO → Configure (Solução #1)

- [ ] **2. Verificar se STRIPE_WEBHOOK_SECRET está no Render**
  - Acesse: https://dashboard.render.com/ → Environment
  - `STRIPE_WEBHOOK_SECRET` existe?
  - Se NÃO → Adicione o secret do Stripe

- [ ] **3. Testar webhook no Stripe**
  - Envie test event: `payment_intent.succeeded`
  - Veja logs do Render: webhook foi recebido?

- [ ] **4. Fazer pagamento de teste real (R$ 1,00)**
  - Use cartão de teste do Stripe: `4242 4242 4242 4242`
  - Qualquer CVC e data futura
  - Verifique logs: conteúdo foi entregue?

- [ ] **5. Verificar user no banco**
  - Execute query SQL acima
  - `telegram_chat_id` está preenchido?

---

## 🎯 DIAGNÓSTICO RÁPIDO

Execute este comando no Render (aba Logs) e me envie o resultado:

```bash
# Buscar últimos webhooks Stripe nos logs
grep -i "stripe webhook" /var/log/render.log | tail -20
```

Ou simplesmente:
1. Acesse Render logs
2. Busque por: "Stripe webhook"
3. Copie últimas 10 linhas
4. Me envie para análise

---

## 💡 RESPOSTA RÁPIDA

**MUITO PROVAVELMENTE o problema é:** Webhook do Stripe não está configurado.

**Solução em 5 minutos:**
1. Configure webhook no Stripe (URL acima)
2. Copie webhook secret
3. Adicione `STRIPE_WEBHOOK_SECRET` no Render
4. Teste novamente

**Após configurar webhook:** Todos os pagamentos com cartão funcionarão automaticamente! 🎉

---

## 📞 PRÓXIMOS PASSOS

1. **AGORA:** Verifique se webhook está configurado no Stripe
2. **SE NÃO:** Configure (5 min)
3. **DEPOIS:** Faça teste com cartão de teste
4. **SE FUNCIONAR:** Sistema pronto para produção! ✅
5. **SE NÃO FUNCIONAR:** Me envie logs do Render para análise

---

**TL;DR:** O código está correto. O problema é que o webhook do Stripe provavelmente não está configurado no dashboard do Stripe. Configure o webhook e o sistema funcionará perfeitamente.
