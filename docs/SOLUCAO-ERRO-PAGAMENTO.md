# 🔧 Solução: Erro ao Gerar Link de Pagamento

## ❌ Problema Identificado

O erro **"erro ao gerar link de pagamento tente novamente"** está ocorrendo porque a chave do Stripe configurada é uma **Restricted Key** (`rk_`), que possui permissões limitadas e **NÃO pode criar sessões de checkout ou processar pagamentos**.

### Chave Atual (INCORRETA):
```
STRIPE_SECRET_KEY=rk_live_51SAyNlC6rXjaUiPc...
                  ^^
                  ❌ Restricted Key - Não tem permissão para criar pagamentos
```

### Chave Correta Necessária:
```
STRIPE_SECRET_KEY=sk_live_51SAyNlC6rXjaUiPc...
                  ^^
                  ✅ Secret Key - Tem permissão total
```

## 🔑 Tipos de Chaves do Stripe

| Prefixo | Tipo | Permissões | Uso |
|---------|------|------------|-----|
| `sk_live_` | **Secret Key (Produção)** | ✅ Total - Criar produtos, preços, checkout | **Necessária para pagamentos** |
| `sk_test_` | **Secret Key (Teste)** | ✅ Total - Criar produtos, preços, checkout | Ambiente de testes |
| `rk_live_` | **Restricted Key** | ❌ Limitada - Somente leitura ou operações específicas | Não serve para pagamentos |
| `pk_live_` | **Publishable Key** | 🔓 Pública - Apenas frontend | Não é secreta |

## ✅ Solução

### Passo 1: Obter a Secret Key Correta

1. Acesse o Stripe Dashboard: https://dashboard.stripe.com/
2. Faça login na sua conta
3. Vá em **Developers** → **API keys**
4. Localize a **Secret key** (começa com `sk_live_` ou `sk_test_`)
5. Se estiver oculta, clique em **Reveal live key** ou **Reveal test key**
6. Copie a chave completa

**⚠️ IMPORTANTE:** Nunca compartilhe a Secret Key publicamente!

### Passo 2: Atualizar o Arquivo .env

Abra o arquivo `backend/.env` e substitua a linha:

```env
# ANTES (INCORRETO)
STRIPE_SECRET_KEY=rk_live_51SAyNlC6rXjaUiPc... # Restricted Key - NÃO funciona

# DEPOIS (CORRETO)
STRIPE_SECRET_KEY=sk_live_51SAyNlC6rXjaUiPc... # Cole sua secret key aqui
```

### Passo 3: Reiniciar o Backend

```bash
# Pare o servidor backend (Ctrl+C)
# Depois reinicie
cd backend
npm run start:dev
```

### Passo 4: Testar

1. Abra o bot do Telegram
2. Selecione um filme para comprar
3. Clique em **💳 Comprar com Cartão** ou **📱 Pagar com PIX**
4. O link de pagamento deve ser gerado com sucesso

## 🧪 Como Testar se a Chave Está Correta

Execute o script de diagnóstico:

```bash
cd backend
node test-payment-endpoint.js
```

### Resultado Esperado:

```
✅ Conexão com Stripe OK
   Modo: PRODUÇÃO (ou TESTE)
   Saldo disponível: 1 moedas configuradas
```

Se aparecer erro de autenticação, a chave ainda está incorreta.

## 🔍 Por Que Isso Aconteceu?

Você provavelmente configurou uma **Restricted Key** em vez da **Secret Key** no arquivo `.env`. As Restricted Keys são criadas para cenários específicos onde você quer limitar as permissões (exemplo: apenas leitura de dados), mas **não servem para processar pagamentos**.

## 📋 Operações Que Requerem Secret Key

O sistema precisa executar as seguintes operações, que **só funcionam com `sk_` keys**:

1. ✅ Criar produtos no Stripe (`stripe.products.create()`)
2. ✅ Criar preços (`stripe.prices.create()`)
3. ✅ Criar sessões de checkout (`stripe.checkout.sessions.create()`)
4. ✅ Criar Payment Intents para PIX (`stripe.paymentIntents.create()`)
5. ✅ Processar webhooks de confirmação de pagamento

## ⚠️ Problema Adicional: PIX QR Code

Após investigação, identifiquei que **o pagamento PIX também não está funcionando corretamente** devido a uma incompatibilidade na implementação:

### O Problema:

O código do Telegram bot espera receber:
- `qr_code_image` (imagem base64 do QR Code)
- `copy_paste_code` (código Pix Copia e Cola)
- `amount_brl` (valor formatado)

Mas o serviço de pagamentos (`createPixPayment()`) apenas redireciona para o Stripe Checkout, que retorna:
- `payment_url` (URL da página do Stripe)
- Sem QR code image
- Sem código copia e cola

### Por que isso aconteceu?

O comentário no código diz: *"DEPRECATED: Use createPayment() instead - Stripe now supports both PIX and card"*

Isso significa que a implementação foi alterada para usar o Stripe Checkout (página hospedada), mas o bot do Telegram ainda espera receber um QR code diretamente para enviar ao usuário.

### Solução:

Você tem 2 opções:

**Opção 1 - Manter Stripe Checkout (Recomendado para Card):**
- Remover o botão "📱 Pagar com PIX" do bot
- Manter apenas "💳 Comprar com Cartão"
- O Stripe Checkout mostra o QR Code PIX na página deles
- Usuário é redirecionado para a página do Stripe

**Opção 2 - Implementar PIX Nativo (Melhor UX no Telegram):**
- Integrar com gateway PIX brasileiro (ex: Mercado Pago, PagSeguro, Asaas)
- Gerar QR Code nativo no backend
- Enviar QR Code diretamente no Telegram (sem redirect)
- Melhor experiência para usuários do Telegram

**Recomendação:** Para corrigir rapidamente, use a Opção 1 e depois migre para Opção 2 se quiser PIX direto no Telegram.

## 🚨 Se o Problema Persistir

Após substituir a chave do Stripe, se o erro continuar:

1. **Verifique os logs do backend:**
   ```bash
   # Logs em tempo real
   npm run start:dev
   ```

2. **Verifique os logs no Stripe Dashboard:**
   - Acesse: https://dashboard.stripe.com/logs
   - Procure por erros de API nas últimas horas

3. **Verifique o banco de dados:**
   ```sql
   SELECT created_at, level, message
   FROM system_logs
   WHERE message ILIKE '%stripe%' OR message ILIKE '%payment%'
   ORDER BY created_at DESC
   LIMIT 20;
   ```

4. **Teste manualmente a API:**
   ```bash
   # Criar um produto de teste
   curl https://api.stripe.com/v1/products \
     -u sk_live_SUA_CHAVE_AQUI: \
     -d name="Teste"
   ```

   Se retornar erro 401, a chave ainda está incorreta.

## ✅ Checklist Final

Antes de ir para produção:

- [ ] Secret Key (`sk_live_` ou `sk_test_`) configurada no `.env`
- [ ] Publishable Key (`pk_live_` ou `pk_test_`) configurada no `.env`
- [ ] Webhook Secret configurado (opcional mas recomendado)
- [ ] Backend reiniciado após mudança
- [ ] Teste de compra realizado com sucesso
- [ ] Logs monitorados sem erros

## 🔒 Segurança

- ✅ **Nunca** commite o arquivo `.env` no Git
- ✅ **Nunca** compartilhe a Secret Key publicamente
- ✅ Use **Test Keys** (`sk_test_`) durante desenvolvimento
- ✅ Use **Live Keys** (`sk_live_`) apenas em produção
- ✅ Rotate as chaves periodicamente no Stripe Dashboard

---

**Documentação criada em:** 01/02/2025
**Problema:** Erro ao gerar link de pagamento no bot Telegram
**Causa:** Restricted Key (`rk_`) em vez de Secret Key (`sk_`)
**Solução:** Substituir por Secret Key no arquivo `.env`
