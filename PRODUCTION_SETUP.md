# 🚀 Guia de Configuração para Produção - CineVision

## ✅ Status da Integração

A integração completa foi testada e está funcionando:
- ✅ Frontend (Next.js) - http://localhost:3000
- ✅ Backend (NestJS) - http://localhost:3001
- ✅ Bot (Telegram) - Todos os testes passaram
- ✅ Webhooks - Endpoints funcionando

## 📋 Variáveis de Ambiente Obrigatórias

### 🔐 Segurança
```bash
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-in-production
```

### 🤖 Telegram Bot
```bash
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_WEBHOOK_URL=https://your-domain.com/api/telegrams/webhook
```

### 🗄️ Database (Supabase)
```bash
DATABASE_TYPE=postgres
SUPABASE_DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-ID].supabase.co:5432/postgres
SUPABASE_URL=https://[PROJECT-ID].supabase.co
SUPABASE_ANON_KEY=[YOUR-ANON-KEY]
SUPABASE_SERVICE_ROLE_KEY=[YOUR-SERVICE-ROLE-KEY]
```

### 💳 Pagamentos
```bash
PAYMENT_PROVIDER_KEY=your-payment-provider-api-key
```

### 🌐 Produção
```bash
NODE_ENV=production
BASE_URL=https://your-domain.com
```

## 🚀 Passos para Deploy

### 1. Configurar Telegram Bot
1. Criar bot no @BotFather
2. Obter token do bot
3. Configurar webhook: `POST /telegrams/setup-webhook`

### 2. Configurar Database
1. Criar projeto no Supabase
2. Executar migrations: `npm run migration:run`
3. Configurar variáveis de conexão

### 3. Deploy dos Serviços

#### Frontend (Vercel/Netlify)
```bash
cd frontend
npm run build
# Deploy para Vercel/Netlify
```

#### Backend (Railway/Heroku)
```bash
cd backend
npm run build
# Deploy para Railway/Heroku
```

#### Bot (Railway/Heroku)
```bash
cd bot
npm run build
# Deploy para Railway/Heroku
```

## 🔧 Configurações Específicas

### Webhook do Telegram
Após deploy do backend, configurar webhook:
```bash
curl -X POST https://your-backend.com/telegrams/setup-webhook \
  -H "Content-Type: application/json" \
  -d '{"url":"https://your-backend.com/telegrams/webhook"}'
```

### CORS
Configurar CORS no backend para permitir frontend:
```typescript
app.enableCors({
  origin: ['https://your-frontend.com'],
  credentials: true
});
```

## ✅ Checklist de Produção

- [ ] Variáveis de ambiente configuradas
- [ ] Database migrado
- [ ] Bot do Telegram criado
- [ ] Webhook configurado
- [ ] Frontend deployado
- [ ] Backend deployado
- [ ] Bot deployado
- [ ] Testes de integração executados
- [ ] Monitoramento configurado

## 🧪 Testes de Produção

### 1. Teste de Conectividade
```bash
curl https://your-backend.com/simple-test/ping
```

### 2. Teste de Webhook
```bash
curl -X POST https://your-backend.com/telegrams/webhook \
  -H "Content-Type: application/json" \
  -d '{"message":{"text":"test"}}'
```

### 3. Teste de Notificação
```bash
curl -X POST https://your-backend.com/telegrams/send-notification \
  -H "Content-Type: application/json" \
  -d '{"userId":"123","message":"Teste de produção"}'
```

## 📊 Monitoramento

### Logs Importantes
- Erros de webhook do Telegram
- Falhas de pagamento
- Erros de entrega de conteúdo
- Performance de streaming

### Métricas
- Uptime dos serviços
- Tempo de resposta das APIs
- Taxa de sucesso de webhooks
- Conversão de pagamentos

## 🔒 Segurança

### Validação de Webhooks
- Verificar assinatura HMAC do Telegram
- Validar origem das requisições
- Rate limiting configurado

### Dados Sensíveis
- Tokens nunca em logs
- Senhas hasheadas (bcrypt/argon2)
- JWT com expiração adequada
- HTTPS obrigatório

## 📞 Suporte

Em caso de problemas:
1. Verificar logs dos serviços
2. Testar endpoints individualmente
3. Validar configurações de webhook
4. Verificar conectividade entre serviços