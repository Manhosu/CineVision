# Como Ativar PIX no Stripe

## ❌ Erro Atual

```
Failed to create PIX payment intent: The payment method type "pix" is invalid.
Please ensure the provided type is activated in your dashboard
```

**Causa:** PIX não está ativado na sua conta Stripe.

---

## 🔧 Solução: Ativar PIX no Stripe Dashboard

### Passo 1: Acessar Configurações de Pagamento

1. Acesse: https://dashboard.stripe.com/settings/payment_methods
2. Faça login na sua conta Stripe

### Passo 2: Verificar Requisitos da Conta

Para ativar PIX no Stripe, você precisa:

✅ **Conta Stripe Brasil**
- Sua conta precisa estar configurada para Brasil
- Moeda padrão: BRL (Real Brasileiro)

✅ **Verificação Completa**
- Conta verificada com documentos brasileiros
- CNPJ ou CPF cadastrado
- Informações bancárias brasileiras

### Passo 3: Ativar PIX

1. No Dashboard Stripe, vá em **Settings** → **Payment methods**
2. Localize **PIX** na lista de métodos de pagamento
3. Clique em **Enable** ao lado de PIX
4. Configure as opções:
   - ✅ **Enable PIX for Checkout Sessions** (se usar checkout)
   - ✅ **Enable PIX for Payment Intents** (necessário para QR code)
   - ✅ **Enable PIX for Invoices** (opcional)

### Passo 4: Configurar Expiração

Recomendado: **1 hora** (3600 segundos)
- Tempo que o QR code PIX permanece válido
- Após expirar, cliente precisa gerar novo QR code

### Passo 5: Verificar Ativação

Execute este comando para testar:

```bash
curl https://api.stripe.com/v1/payment_methods \
  -u sk_live_SUACHAVESECRETA: \
  -d "type"="pix" \
  -d "billing_details[email]"="teste@exemplo.com"
```

**Resposta esperada:**
```json
{
  "id": "pm_xxxxx",
  "type": "pix",
  "billing_details": {...}
}
```

---

## 🌍 Requisitos Regionais

### Conta Stripe Brasil

PIX só funciona em contas Stripe configuradas para o Brasil:

| Configuração | Valor Necessário |
|--------------|-----------------|
| **Country** | BR (Brasil) |
| **Currency** | BRL |
| **Bank Account** | Banco brasileiro |
| **Tax ID** | CPF ou CNPJ |

### Como Verificar

```bash
# Verificar configuração da conta
curl https://api.stripe.com/v1/account \
  -u sk_live_SUACHAVESECRETA:
```

Procure por:
```json
{
  "country": "BR",
  "default_currency": "brl",
  "capabilities": {
    "pix_payments": "active"  // ← Deve estar "active"
  }
}
```

---

## ⚠️ Problemas Comuns

### 1. "PIX is not available for your account"

**Causa:** Conta não é brasileira ou não está completamente verificada.

**Solução:**
1. Acesse: https://dashboard.stripe.com/settings/account
2. Verifique se **Country** = Brazil
3. Complete a verificação da conta com documentos brasileiros

### 2. "PIX payments capability is restricted"

**Causa:** Conta em análise ou com restrições.

**Solução:**
1. Contate o suporte Stripe: https://support.stripe.com
2. Forneça detalhes do seu negócio
3. Aguarde aprovação (geralmente 1-2 dias úteis)

### 3. "Cannot enable PIX for this currency"

**Causa:** Tentando usar PIX com moeda diferente de BRL.

**Solução:**
```typescript
// Certifique-se de usar BRL
const paymentIntent = await stripe.paymentIntents.create({
  amount: 1000, // R$ 10,00 em centavos
  currency: 'brl', // ← Deve ser BRL
  payment_method_types: ['pix'],
});
```

---

## 🚀 Próximos Passos Após Ativação

### 1. Testar em Modo Test

```bash
# Usar chave de teste
export STRIPE_SECRET_KEY=sk_test_SUACHAVEDETESTE

# Testar criação de Payment Intent PIX
curl https://api.stripe.com/v1/payment_intents \
  -u sk_test_SUACHAVEDETESTE: \
  -d "amount"=1000 \
  -d "currency"=brl \
  -d "payment_method_types[]"=pix
```

### 2. Verificar QR Code Gerado

```bash
# Após criar Payment Intent, confirmar para gerar QR code
curl https://api.stripe.com/v1/payment_intents/pi_xxxxx/confirm \
  -u sk_test_SUACHAVEDETESTE:
```

Resposta deve conter:
```json
{
  "next_action": {
    "type": "pix_display_qr_code",
    "pix_display_qr_code": {
      "data": "00020126....",  // ← Código PIX Copia e Cola
      "image_url_png": "https://...",  // ← URL da imagem QR
      "expires_at": 1234567890
    }
  }
}
```

### 3. Fazer Deploy do Código

Após ativar PIX no Stripe:

```bash
# Fazer commit e push (código já está pronto)
git push origin main

# Deploy será automático no Render
```

---

## 📞 Suporte Stripe

Se tiver dificuldades para ativar PIX:

- **Email:** support@stripe.com
- **Chat:** https://dashboard.stripe.com (canto inferior direito)
- **Docs:** https://stripe.com/docs/payments/pix
- **Status:** https://status.stripe.com

**Informações úteis para fornecer:**
- Country: Brazil
- Feature: PIX payment method
- Use case: E-commerce digital (venda de conteúdo)
- Integration: Payment Intents API
- Monthly volume: [seu volume estimado]

---

## ✅ Checklist Final

Antes de usar PIX em produção:

- [ ] PIX ativado no Stripe Dashboard
- [ ] Conta verificada com documentos brasileiros
- [ ] Capability `pix_payments` = "active"
- [ ] Testado em modo test primeiro
- [ ] QR code gerado corretamente
- [ ] Webhook configurado para `payment_intent.succeeded`
- [ ] Código deployado em produção

---

## 📊 Métricas Esperadas

Após ativação bem-sucedida:

| Métrica | Valor Esperado |
|---------|----------------|
| **Taxa de conversão PIX** | ~70% (Brasil) |
| **Tempo médio de pagamento** | 2-5 minutos |
| **Taxa de expiração QR** | <10% |
| **Taxa de sucesso** | >95% |

PIX é o método de pagamento mais popular no Brasil, com aprovação instantânea! 🇧🇷
