# Integração PIX com Mercado Pago

## 🎯 Objetivo

Implementar pagamento PIX com validação automática usando a API do Mercado Pago para o bot CineVision no Telegram.

---

## 📋 Resumo da Implementação

### Antes (Stripe)
- ❌ PIX não ativado na conta Stripe
- ❌ Erro ao gerar QR code
- ❌ Validação manual necessária

### Depois (Mercado Pago)
- ✅ PIX nativo e ativado
- ✅ QR code gerado automaticamente
- ✅ Validação automática via webhook
- ✅ Aprovação instantânea de pagamentos

---

## 🏗️ Arquitetura

```
┌─────────────┐
│   Telegram  │
│     Bot     │
└──────┬──────┘
       │ 1. Usuário escolhe PIX
       ▼
┌─────────────────────────────┐
│  PaymentsSupabaseService    │
│  createPixPayment()         │
└──────┬──────────────────────┘
       │ 2. Chama Mercado Pago
       ▼
┌─────────────────────────────┐
│   MercadoPagoService        │
│   createPixPayment()        │
└──────┬──────────────────────┘
       │ 3. Retorna QR code
       ▼
┌─────────────────────────────┐
│   Mercado Pago API          │
│   - Gera QR code            │
│   - Monitora pagamento      │
└──────┬──────────────────────┘
       │ 4. Usuário paga
       ▼
┌─────────────────────────────┐
│  Webhook Mercado Pago       │
│  payment.updated            │
└──────┬──────────────────────┘
       │ 5. Notifica backend
       ▼
┌─────────────────────────────┐
│ MercadoPagoWebhookService   │
│ handlePaymentApproved()     │
└──────┬──────────────────────┘
       │ 6. Atualiza database
       ▼
┌─────────────────────────────┐
│   Supabase Database         │
│   - payment.status = paid   │
│   - purchase.status = paid  │
└──────┬──────────────────────┘
       │ 7. Bot detecta pagamento
       ▼
┌─────────────────────────────┐
│   Telegram Bot              │
│   Entrega conteúdo          │
└─────────────────────────────┘
```

---

## 🔧 Configuração

### 1. Variáveis de Ambiente no Render

Acesse: https://dashboard.render.com/web/srv-d3mp4ibipnbc73ctm470

Adicione estas variáveis em **Environment**:

```bash
MERCADO_PAGO_ACCESS_TOKEN=APP_USR-2790127687766077-110215-00693d48ca03833b472196039192a2eb-452973387
MERCADO_PAGO_PUBLIC_KEY=APP_USR-b7baba1e-0cf5-4050-9fea-53d3a55df377
MERCADO_PAGO_CLIENT_ID=2790127687766077
MERCADO_PAGO_CLIENT_SECRET=oD2hFV2bwfeqlxfUssWjoDqq64SQIZCC
MERCADO_PAGO_WEBHOOK_SECRET=mp_webhook_secret_cine_vision_2025
```

### 2. Configurar Webhook no Mercado Pago

1. Acesse: https://www.mercadopago.com.br/developers/panel/app
2. Selecione sua aplicação
3. Vá em **Webhooks**
4. Clique em **Configurar webhooks**
5. Cole a URL:

```
https://cinevisionn.onrender.com/api/v1/webhooks/mercadopago
```

6. Selecione o evento: **Pagamentos**
7. Clique em **Salvar**

### 3. Testar Webhook

```bash
# Mercado Pago enviará um ping test
# Verifique os logs do Render para confirmar recebimento
```

---

## 📁 Arquivos Criados

### 1. MercadoPagoService
**Arquivo:** `backend/src/modules/payments/services/mercado-pago.service.ts`

**Responsabilidade:** Comunicação com API do Mercado Pago

**Métodos principais:**
- `createPixPayment()` - Cria pagamento PIX e gera QR code
- `getPayment()` - Consulta status do pagamento
- `isPaymentApproved()` - Verifica se pagamento foi aprovado
- `createRefund()` - Cria reembolso
- `healthCheck()` - Verifica conexão com Mercado Pago

### 2. MercadoPagoWebhookService
**Arquivo:** `backend/src/modules/payments/services/mercado-pago-webhook.service.ts`

**Responsabilidade:** Processar notificações do Mercado Pago

**Métodos principais:**
- `handleWebhook()` - Processa notificação recebida
- `handlePaymentApproved()` - Aprova pagamento e purchase
- `handlePaymentFailed()` - Marca pagamento como falho
- `handlePaymentPending()` - Mantém pagamento pendente

### 3. MercadoPagoWebhookController
**Arquivo:** `backend/src/modules/payments/controllers/mercado-pago-webhook.controller.ts`

**Responsabilidade:** Endpoint para receber webhooks

**Endpoints:**
- `POST /api/v1/webhooks/mercadopago` - Recebe notificações
- `POST /api/v1/webhooks/mercadopago/health` - Health check

### 4. PaymentsSupabaseService (Atualizado)
**Arquivo:** `backend/src/modules/payments/payments-supabase.service.ts`

**Mudanças:**
- Injeta `MercadoPagoService` no constructor
- `createPixPayment()` usa Mercado Pago ao invés de Stripe
- Salva `provider: 'mercadopago'` no banco de dados
- Retorna formato compatível com bot Telegram

---

## 🚀 Fluxo de Pagamento PIX

### 1. Usuário Solicita PIX no Bot

```typescript
// Telegram bot chama:
POST /api/v1/payments/pix/create
{
  "purchase_id": "uuid-da-compra"
}
```

### 2. Backend Cria Pagamento Mercado Pago

```typescript
// PaymentsSupabaseService.createPixPayment()
const pixResult = await this.mercadoPagoService.createPixPayment({
  amount: 750, // R$ 7,50 em centavos
  description: 'CineVision - Filme XYZ',
  email: 'cliente@email.com',
  metadata: {
    purchase_id: 'uuid-da-compra',
    content_id: 'uuid-do-filme',
  },
});
```

### 3. Mercado Pago Retorna QR Code

```json
{
  "paymentId": "1234567890",
  "status": "pending",
  "qrCode": "00020126580014br.gov.bcb.pix...",
  "qrCodeBase64": "iVBORw0KGgoAAAANSUhEUgAA...",
  "expiresAt": "2025-11-02T11:30:00Z",
  "amount": 750
}
```

### 4. Bot Envia QR Code para Telegram

```typescript
// Bot recebe:
{
  "provider_payment_id": "1234567890",
  "qr_code_text": "00020126580014br.gov.bcb.pix...",
  "qr_code_image": "iVBORw0KGgoAAAANSUhEUgAA...",
  "amount_brl": "7.50",
  "expires_in": 1800, // 30 minutos
  "payment_instructions": "Escaneie o QR Code..."
}
```

### 5. Usuário Paga via PIX

- Abre app do banco
- Escaneia QR code ou cola código PIX
- Confirma pagamento
- **Pagamento é instantâneo!**

### 6. Mercado Pago Envia Webhook

```json
POST /api/v1/webhooks/mercadopago
{
  "type": "payment",
  "action": "payment.updated",
  "data": {
    "id": "1234567890"
  }
}
```

### 7. Backend Processa Webhook

```typescript
// MercadoPagoWebhookService.handleWebhook()

// 1. Busca pagamento no Mercado Pago
const payment = await mercadoPagoService.getPayment('1234567890');

// 2. Verifica status
if (payment.status === 'approved') {
  // 3. Atualiza payment na database
  UPDATE payments SET status = 'paid', paid_at = NOW()
  WHERE provider_payment_id = '1234567890';

  // 4. Atualiza purchase na database
  UPDATE purchases SET status = 'paid'
  WHERE id = payment.purchase_id;
}
```

### 8. Bot Detecta Pagamento e Entrega Conteúdo

```typescript
// Bot monitora purchases com status = 'paid'
// Envia link do filme para o usuário automaticamente
```

---

## 🔍 Teste do Fluxo Completo

### 1. Ambiente de Teste Mercado Pago

```bash
# Usar credenciais de teste
# Acesse: https://www.mercadopago.com.br/developers/panel/test-users

# Criar usuário de teste vendedor
# Criar usuário de teste comprador
```

### 2. Testar Criação de QR Code

```bash
curl -X POST https://cinevisionn.onrender.com/api/v1/payments/pix/create \
  -H "Content-Type: application/json" \
  -d '{
    "purchase_id": "uuid-de-teste"
  }'
```

**Resposta esperada:**
```json
{
  "provider_payment_id": "1234567890",
  "qr_code_text": "00020126...",
  "qr_code_image": "iVBORw0KGgoAAAA...",
  "amount_brl": "7.50"
}
```

### 3. Simular Pagamento no Mercado Pago

```bash
# Usar app de teste Mercado Pago
# Ou simular webhook manualmente:

curl -X POST https://cinevisionn.onrender.com/api/v1/webhooks/mercadopago \
  -H "Content-Type: application/json" \
  -d '{
    "type": "payment",
    "action": "payment.updated",
    "data": {
      "id": "1234567890"
    }
  }'
```

### 4. Verificar Database

```sql
-- Ver payment criado
SELECT * FROM payments
WHERE provider_payment_id = '1234567890';

-- Ver purchase atualizado
SELECT * FROM purchases
WHERE id = (SELECT purchase_id FROM payments WHERE provider_payment_id = '1234567890');
```

---

## 📊 Monitoramento

### Logs do Render

```bash
# Ver logs em tempo real
https://dashboard.render.com/web/srv-d3mp4ibipnbc73ctm470/logs

# Procurar por:
[MercadoPagoService] Creating PIX payment
[MercadoPagoService] PIX payment created: 1234567890
[MercadoPagoWebhookService] Payment 1234567890 approved!
[MercadoPagoWebhookService] ✅ Payment successfully processed
```

### Dashboard Mercado Pago

```
https://www.mercadopago.com.br/home/vendasrecentes

- Ver pagamentos recebidos
- Status de cada pagamento
- Webhooks enviados
- Logs de notificações
```

---

## ⚠️ Tratamento de Erros

### 1. QR Code Não Gerado

```typescript
if (!pixResult.qrCode || !pixResult.qrCodeBase64) {
  throw new BadRequestException('Failed to generate PIX QR code');
}
```

### 2. Webhook Duplicado

```typescript
// Webhook retorna 200 OK imediatamente
// Processamento é assíncrono
// Evita retry do Mercado Pago
```

### 3. Payment Não Encontrado

```typescript
if (!dbPayment) {
  this.logger.warn(`Payment ${paymentId} not found in database`);
  return; // Não lança erro, só loga
}
```

### 4. Erro no Mercado Pago API

```typescript
try {
  const payment = await mercadoPago.getPayment(id);
} catch (error) {
  this.logger.error(`Mercado Pago API error: ${error.message}`);
  throw new BadRequestException('Payment provider unavailable');
}
```

---

## 🎯 Vantagens do Mercado Pago

| Recurso | Mercado Pago | Stripe |
|---------|--------------|--------|
| **PIX Nativo** | ✅ Sim | ❌ Requer ativação |
| **QR Code Automático** | ✅ Sim | ⚠️ Após ativação |
| **Validação Automática** | ✅ Webhook | ✅ Webhook |
| **Aprovação PIX** | ⚡ Instantânea | ⚡ Instantânea |
| **Taxas PIX** | 📉 1,39% | 📊 2,39% + R$ 0,60 |
| **Integração Brasil** | 🇧🇷 Nativa | 🌎 Global |
| **Suporte Brasil** | ✅ PT-BR | ⚠️ EN |

---

## 📚 Links Úteis

- **Dashboard:** https://www.mercadopago.com.br/developers/panel
- **Docs PIX:** https://www.mercadopago.com.br/developers/pt/docs/checkout-api/integration-configuration/pix
- **Docs Webhook:** https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
- **Teste Sandbox:** https://www.mercadopago.com.br/developers/pt/docs/checkout-api/testing
- **Status API:** https://status.mercadopago.com/

---

## ✅ Checklist de Deploy

Antes de fazer deploy em produção:

- [x] SDK Mercado Pago instalado (`mercadopago@2.0.15`)
- [ ] Variáveis de ambiente adicionadas no Render
- [ ] Webhook configurado no Mercado Pago
- [ ] URL webhook testada (`/api/v1/webhooks/mercadopago`)
- [ ] QR code PIX gerado com sucesso
- [ ] Pagamento teste aprovado
- [ ] Database atualizada automaticamente
- [ ] Bot Telegram recebendo conteúdo após pagamento
- [ ] Logs monitorados no Render

---

## 🚀 Próximos Passos

1. **Adicionar variáveis no Render** (ver `MERCADO-PAGO-ENV-VARS.md`)
2. **Configurar webhook no Mercado Pago Dashboard**
3. **Fazer commit e deploy do código**
4. **Testar pagamento PIX completo**
5. **Monitorar logs de aprovação automática**

**O sistema está pronto! Só falta configurar as variáveis e webhook.** 🎉
