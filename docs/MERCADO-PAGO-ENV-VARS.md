# Variáveis de Ambiente - Mercado Pago

## 📋 Copie e cole estas variáveis no Render

Acesse: https://dashboard.render.com/web/srv-d3mp4ibipnbc73ctm470

Vá em: **Environment** → **Add Environment Variable**

Cole cada uma destas variáveis:

```bash
# Mercado Pago - Credenciais de Produção
MERCADO_PAGO_ACCESS_TOKEN=APP_USR-2790127687766077-110215-00693d48ca03833b472196039192a2eb-452973387
MERCADO_PAGO_PUBLIC_KEY=APP_USR-b7baba1e-0cf5-4050-9fea-53d3a55df377
MERCADO_PAGO_CLIENT_ID=2790127687766077
MERCADO_PAGO_CLIENT_SECRET=oD2hFV2bwfeqlxfUssWjoDqq64SQIZCC

# Webhook URL - Será configurado automaticamente após deploy
MERCADO_PAGO_WEBHOOK_SECRET=mp_webhook_secret_cine_vision_2025
```

## 🔐 Segurança

⚠️ **IMPORTANTE:**
- Nunca commite estas chaves no Git
- Adicione apenas no Render como variáveis de ambiente
- Este arquivo está no .gitignore

## 📝 Como Adicionar no Render

### Método 1: Interface Web (Recomendado)

1. Acesse: https://dashboard.render.com
2. Selecione o serviço **CineVisionn**
3. Vá na aba **Environment**
4. Clique em **Add Environment Variable**
5. Cole cada variável uma por vez:
   - **Key:** MERCADO_PAGO_ACCESS_TOKEN
   - **Value:** APP_USR-2790127687766077-110215-00693d48ca03833b472196039192a2eb-452973387
6. Clique em **Save Changes**
7. Repita para todas as variáveis

### Método 2: Via CLI (Opcional)

```bash
render env set MERCADO_PAGO_ACCESS_TOKEN="APP_USR-2790127687766077-110215-00693d48ca03833b472196039192a2eb-452973387" --service srv-d3mp4ibipnbc73ctm470
render env set MERCADO_PAGO_PUBLIC_KEY="APP_USR-b7baba1e-0cf5-4050-9fea-53d3a55df377" --service srv-d3mp4ibipnbc73ctm470
render env set MERCADO_PAGO_CLIENT_ID="2790127687766077" --service srv-d3mp4ibipnbc73ctm470
render env set MERCADO_PAGO_CLIENT_SECRET="oD2hFV2bwfeqlxfUssWjoDqq64SQIZCC" --service srv-d3mp4ibipnbc73ctm470
render env set MERCADO_PAGO_WEBHOOK_SECRET="mp_webhook_secret_cine_vision_2025" --service srv-d3mp4ibipnbc73ctm470
```

## 🎯 Próximos Passos

Após adicionar as variáveis:

1. ✅ Deploy automático será iniciado
2. ✅ Sistema carregará as credenciais do Mercado Pago
3. ✅ PIX funcionará via Mercado Pago
4. ✅ Validação automática ativada

## 🔗 Links Úteis

- **Dashboard Mercado Pago:** https://www.mercadopago.com.br/developers/panel
- **Documentação PIX:** https://www.mercadopago.com.br/developers/pt/docs/checkout-api/integration-configuration/pix
- **Webhooks:** https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
- **Testar Pagamentos:** https://www.mercadopago.com.br/developers/pt/docs/checkout-api/testing

## ✅ Checklist

Antes de fazer deploy, certifique-se:

- [ ] Todas as 5 variáveis foram adicionadas no Render
- [ ] Access Token começa com `APP_USR-`
- [ ] Public Key começa com `APP_USR-`
- [ ] Client ID é numérico (2790127687766077)
- [ ] Webhook secret foi definido
- [ ] Salvou as mudanças no Render

Após adicionar, aguarde o código ser deployado para começar a usar PIX! 🚀
