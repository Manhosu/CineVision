# 🔧 Como Configurar o Mercado Pago para PIX

## ❌ Problema Atual

O sistema está retornando erro ao gerar QR Code PIX porque o **MERCADO_PAGO_ACCESS_TOKEN não está configurado** ou está **inválido/expirado**.

**Erro nos logs:**
```
Failed to create PIX payment: At least one policy returned UNAUTHORIZED.
```

---

## ✅ Solução: Configurar Access Token no Render

### Passo 1: Obter o Access Token do Mercado Pago

1. Acesse: **https://www.mercadopago.com.br/developers/panel/app**
2. Faça login com sua conta Mercado Pago
3. Se não tiver uma aplicação, clique em **"Criar aplicação"**
4. Copie o **Access Token de PRODUÇÃO** (formato: `APP_USR-...`)

**⚠️ IMPORTANTE:**
- **NÃO** use o token de TEST em produção!
- O token de PRODUÇÃO começa com `APP_USR-`
- O token de TEST começa com `TEST-`

---

### Passo 2: Configurar no Render

1. Acesse: **https://dashboard.render.com/**
2. Selecione o serviço **cinevisionn** (backend)
3. Vá em **Environment** (menu lateral esquerdo)
4. Procure pela variável **MERCADO_PAGO_ACCESS_TOKEN**

**Se a variável JÁ EXISTE:**
- Clique no ícone de **editar** (lápis)
- Cole o novo Access Token
- Clique em **Save Changes**

**Se a variável NÃO EXISTE:**
- Clique em **Add Environment Variable**
- Key: `MERCADO_PAGO_ACCESS_TOKEN`
- Value: Cole o Access Token (ex: `APP_USR-1234567890abcdef...`)
- Clique em **Save Changes**

---

### Passo 3: Aguardar Deploy Automático

Após salvar, o Render vai fazer **redeploy automático** (4-6 minutos).

**Como verificar se funcionou:**

1. Vá em **Logs** no Render
2. Procure pela linha:
   ```
   ✅ Mercado Pago service initialized successfully
   🔑 Using PRODUCTION credentials
   ```

**Se aparecer:**
```
❌ MERCADO_PAGO_ACCESS_TOKEN is not configured!
```
Significa que o token não foi salvo corretamente. Refaça o Passo 2.

---

### Passo 4: Testar PIX no Telegram Bot

1. Abra o bot do Telegram
2. Tente comprar um filme/série
3. Escolha **PIX** como forma de pagamento
4. O QR Code deve aparecer corretamente

**Se ainda der erro**, verifique os logs do Render para mais detalhes.

---

## 🔍 Troubleshooting

### Erro: "Token inválido ou expirado"

**Solução:**
1. Gere um NOVO Access Token no Mercado Pago
2. Substitua no Render
3. Aguarde o redeploy

### Erro: "Invalid format"

**Causa:** Token não começa com `APP_USR-` ou `TEST-`

**Solução:**
- Verifique se copiou o token completo
- Certifique-se de usar o token de PRODUÇÃO (não de TEST)

### PIX funciona em teste mas não em produção

**Causa:** Está usando token de TEST (`TEST-...`) em produção

**Solução:**
- Use o token de PRODUÇÃO (`APP_USR-...`)

---

## 📝 Checklist Final

- [ ] Access Token obtido do painel do Mercado Pago
- [ ] Token de PRODUÇÃO (começa com `APP_USR-`)
- [ ] Variável configurada no Render
- [ ] Deploy completado com sucesso
- [ ] Logs mostram "Mercado Pago service initialized successfully"
- [ ] Teste de compra com PIX funcionando no bot

---

## 🆘 Suporte

Se o problema persistir após seguir todos os passos:

1. Verifique os logs completos do Render
2. Certifique-se de que sua conta Mercado Pago está ativa
3. Verifique se sua conta tem permissão para criar pagamentos PIX
