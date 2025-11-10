# 🔄 Mudar Bot de Webhook para Polling (Plano FREE)

## ⚠️ Por que isso é necessário?

### Problema do Webhook no Plano FREE:
```
┌─────────────────────────────────────────────────┐
│ 1. Serviço dorme após 15 min sem requisições   │
│ 2. Telegram envia webhook → Serviço dormindo   │
│ 3. Serviço leva 30-60s para acordar            │
│ 4. Telegram timeout (60s) → Webhook falha      │
│ 5. Após várias falhas → Bot para de responder  │
└─────────────────────────────────────────────────┘
```

### Vantagens do Polling:
```
┌──────────────────────────────────────────────┐
│ ✅ Bot faz requests ativos (não espera)     │
│ ✅ Funciona mesmo se serviço dormir e acordar│
│ ✅ Sem problemas de timeout                  │
│ ✅ Mais confiável para plano FREE            │
│ ✅ Grátis e funciona 24/7                    │
└──────────────────────────────────────────────┘
```

---

## 🚀 Solução Rápida (2 minutos)

### Opção 1: Variável de Ambiente (Recomendado)

1. **No Render Dashboard:**
   - Vá em seu serviço backend
   - Clique em **"Environment"**
   - **Remova** ou **comente** a variável: `TELEGRAM_WEBHOOK_URL`
   - Clique em **"Save Changes"**
   - O serviço vai reiniciar automaticamente

2. **O que acontece:**
   - Sem `TELEGRAM_WEBHOOK_URL`, o código ativa o polling automaticamente
   - Bot começa a buscar atualizações a cada 1-2 segundos
   - Funciona mesmo se o serviço dormir

### Opção 2: Forçar Polling (Alternativa)

Adicione esta variável no Render:
```
USE_TELEGRAM_POLLING=true
```

---

## 📋 Passo a Passo Detalhado

### 1️⃣ Acessar o Render

1. Vá para https://dashboard.render.com
2. Selecione seu serviço backend
3. Clique em **"Environment"** na barra lateral

### 2️⃣ Remover/Desabilitar Webhook

Procure por essas variáveis e **REMOVA ou COMENTE**:
- `TELEGRAM_WEBHOOK_URL`
- `WEBHOOK_URL` (se existir)

**Antes:**
```
TELEGRAM_WEBHOOK_URL=https://cinevisionn.onrender.com/api/v1/telegrams/webhook
```

**Depois:**
```
(variável removida ou comentada)
```

### 3️⃣ Salvar e Reiniciar

1. Clique em **"Save Changes"**
2. O Render vai reiniciar o serviço automaticamente
3. Aguarde ~2-3 minutos para o deploy

### 4️⃣ Verificar nos Logs

Após o restart, você deve ver:
```
[TelegramsEnhancedService] Production mode: No TELEGRAM_WEBHOOK_URL configured. Bot will not start.
```

**OU (se configurado corretamente):**
```
[TelegramsEnhancedService] Starting Telegram bot polling...
[TelegramsEnhancedService] Polling started successfully
```

### 5️⃣ Testar o Bot

1. No Telegram, envie `/start` para o bot
2. Bot deve responder em 1-5 segundos
3. Teste fazer uma compra
4. Bot deve funcionar perfeitamente! ✅

---

## 🔧 Opção Alternativa: Forçar Polling no Código

Se você quiser garantir que SEMPRE use polling em produção (útil para plano FREE):

### Modificar o código:

**Arquivo:** `backend/src/modules/telegrams/telegrams-enhanced.service.ts`

**Localizar (linha ~2480):**
```typescript
async onModuleInit() {
  const nodeEnv = this.configService.get<string>('NODE_ENV');
  const webhookUrl = this.configService.get<string>('TELEGRAM_WEBHOOK_URL');

  if (nodeEnv === 'production' && webhookUrl) {
    // Webhook mode
  } else if (nodeEnv === 'development') {
    // Polling mode
  }
}
```

**Substituir por:**
```typescript
async onModuleInit() {
  const nodeEnv = this.configService.get<string>('NODE_ENV');
  const usePolling = this.configService.get<string>('USE_TELEGRAM_POLLING') === 'true';
  const webhookUrl = this.configService.get<string>('TELEGRAM_WEBHOOK_URL');

  // SEMPRE usar polling no plano FREE do Render
  if (usePolling || (nodeEnv === 'production' && !webhookUrl)) {
    this.logger.log('Polling mode enabled (better for FREE tier)');
    await this.deleteWebhook();
    this.startPolling();
  } else if (nodeEnv === 'production' && webhookUrl) {
    this.logger.log('Webhook mode enabled');
  } else {
    this.logger.log('Development mode: Starting polling...');
    await this.deleteWebhook();
    this.startPolling();
  }
}
```

---

## ✅ Como Verificar que está Funcionando

### 1. Logs do Render

Acesse os logs e procure por:
```
✅ BOM SINAL:
[TelegramsEnhancedService] Polling started successfully
[TelegramsEnhancedService] Polling for updates... (offset: 0)

❌ MAU SINAL:
[TelegramsEnhancedService] Webhook mode enabled
[TelegramsEnhancedService] Bot will not start
```

### 2. Testar o Bot

```bash
# Envie no Telegram:
/start

# Deve responder em segundos:
🎬 Bem-vindo ao CineVision!
...
```

### 3. Verificar Webhook no Telegram

Execute este comando para ver o status:
```bash
curl "https://api.telegram.org/bot<SEU_BOT_TOKEN>/getWebhookInfo"
```

**Com Polling (correto):**
```json
{
  "ok": true,
  "result": {
    "url": "",
    "has_custom_certificate": false,
    "pending_update_count": 0
  }
}
```

**Com Webhook (problema):**
```json
{
  "ok": true,
  "result": {
    "url": "https://cinevisionn.onrender.com/...",
    "last_error_date": 1705000000,
    "last_error_message": "Connection timed out"
  }
}
```

---

## 🎯 Comparação: Webhook vs Polling

| Aspecto | Webhook (Plano FREE ❌) | Polling (Plano FREE ✅) |
|---------|------------------------|------------------------|
| **Latência** | 0-1s (quando acordado) | 1-2s |
| **Com serviço dormindo** | ❌ Falha timeout | ✅ Funciona |
| **Confiabilidade** | ❌ Baixa (timeouts) | ✅ Alta |
| **CPU/Banda** | Baixo | Médio (mas OK no free) |
| **Configuração** | Complexa | Simples |
| **Recomendado para FREE** | ❌ NÃO | ✅ SIM |

---

## 📊 Monitoramento

### Script para Verificar Status

```bash
# Criar script de teste
cat > test-bot-status.sh << 'EOF'
#!/bin/bash
TOKEN="SEU_BOT_TOKEN_AQUI"

echo "=== Status do Webhook ==="
curl -s "https://api.telegram.org/bot${TOKEN}/getWebhookInfo" | jq '.'

echo ""
echo "=== Testando /start ==="
YOUR_CHAT_ID="SEU_CHAT_ID"
curl -s "https://api.telegram.org/bot${TOKEN}/sendMessage" \
  -d "chat_id=${YOUR_CHAT_ID}" \
  -d "text=🧪 Teste de conectividade" | jq '.ok'
EOF

chmod +x test-bot-status.sh
./test-bot-status.sh
```

---

## 🚨 Troubleshooting

### Problema: Bot ainda não responde após mudar para polling

**Solução:**
1. Verifique os logs do Render
2. Procure por erros de "getUpdates"
3. Certifique-se que removeu `TELEGRAM_WEBHOOK_URL`
4. Force restart: `Render Dashboard → Manual Deploy → Clear cache`

### Problema: "Conflict: terminated by other getUpdates"

**Causa:** Webhook ainda ativo ou outro processo fazendo polling

**Solução:**
```bash
# Deletar webhook manualmente
curl "https://api.telegram.org/bot<TOKEN>/deleteWebhook"

# Aguardar 30 segundos
# Reiniciar serviço no Render
```

### Problema: Polling funciona mas é lento

**Normal!** Polling tem latência de 1-3 segundos, é esperado.

**Para melhorar:**
- Upgrade para plano pago do Render (US$ 7/mês)
- Webhook vai funcionar perfeitamente
- Latência: <1 segundo

---

## 💡 Dicas Importantes

1. **Polling é a solução certa para plano FREE**
   - Não se preocupe com a latência de 1-2s
   - É muito melhor que o bot não funcionar!

2. **Quando fazer upgrade para webhook:**
   - Quando migrar para plano pago do Render
   - Quando tiver muitos usuários simultâneos
   - Quando precisar de latência <1s

3. **Monitorar logs regularmente:**
   - Verifique se polling está ativo
   - Procure por erros de "Conflict"
   - Garanta que não há webhook configurado

---

## 📝 Checklist Final

- [ ] Removi `TELEGRAM_WEBHOOK_URL` do Render
- [ ] Salvei as mudanças
- [ ] Serviço reiniciou automaticamente
- [ ] Verifiquei os logs (polling ativo)
- [ ] Testei `/start` no bot
- [ ] Bot respondeu corretamente
- [ ] Testei fazer uma compra
- [ ] Tudo funcionando! 🎉

---

**Criado:** Janeiro 2025
**Problema:** Bot para de responder no plano FREE
**Solução:** Usar POLLING ao invés de WEBHOOK
**Tempo:** 2 minutos para implementar
