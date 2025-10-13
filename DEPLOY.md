# 🚀 Guia de Deploy - Cine Vision

Este guia fornece instruções passo a passo para fazer deploy do Cine Vision em produção.

## 📋 Arquitetura de Deploy

- **Frontend**: Vercel (Next.js 14)
- **Backend**: Railway (NestJS)
- **Database**: Supabase (PostgreSQL)
- **Storage**: AWS S3 + CloudFront
- **Bot**: Telegram

---

## 🔧 Pré-requisitos

1. Conta no [Railway](https://railway.app)
2. Conta no [Vercel](https://vercel.com)
3. Conta no [Supabase](https://supabase.com) (já configurada)
4. Conta AWS com S3 e CloudFront configurados
5. Bot do Telegram criado

---

## 📦 PARTE 1: Deploy do Backend (Railway)

### 1.1. Criar Projeto no Railway

1. Acesse https://railway.app
2. Clique em "New Project"
3. Selecione "Deploy from GitHub repo"
4. Conecte seu repositório GitHub
5. Selecione a pasta `backend`

### 1.2. Configurar Variáveis de Ambiente

No Railway, vá em **Variables** e adicione:

```env
# ENVIRONMENT
NODE_ENV=production
PORT=3001

# SUPABASE
SUPABASE_URL=https://szghyvnbmjlquznxhqum.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6Z2h5dm5ibWpscXV6bnhocXVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3NDk5OTksImV4cCI6MjA3NDMyNTk5OX0._VqIPIYTflB8j8bdShAqet5GGSgXeP1auh1Mj3mLfLs
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6Z2h5dm5ibWpscXV6bnhocXVtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODc0OTk5OSwiZXhwIjoyMDc0MzI1OTk5fQ.p9_G_CjLg8h2CVZqteKLdK9WUFKFdXSqTuTolHFiWGc
SUPABASE_JWT_SECRET=3aburoRntkC26WbcuTDRp9xIndcrs1sF1hSZGq9Z9jox4rkeJL88AIC/RhdL1n1Hbznz4xYF+xa+plfMMuFbiA==

# DATABASE
DATABASE_TYPE=postgres
ENABLE_TYPEORM=false
SUPABASE_DATABASE_URL=postgresql://postgres.szghyvnbmjlquznxhqum:Umeomesmo1%2C@aws-1-sa-east-1.pooler.supabase.com:5432/postgres

# JWT - ⚠️ GERAR NOVOS SECRETS!
JWT_SECRET=<GERAR_STRING_ALEATORIA_LONGA>
JWT_EXPIRES_IN=1h
JWT_REFRESH_SECRET=<GERAR_STRING_ALEATORIA_LONGA_DIFERENTE>
JWT_REFRESH_EXPIRES_IN=7d

# TELEGRAM
TELEGRAM_BOT_TOKEN=8284657866:AAFZ9KhQ3wgr7ms5KJWpNk-8QnrnlIJHcKM
TELEGRAM_BOT_USERNAME=cinevisionv2bot
TELEGRAM_WEBHOOK_URL=https://<SEU-BACKEND>.railway.app/api/v1/telegrams/webhook
TELEGRAM_WEBHOOK_SECRET=<GERAR_STRING_ALEATORIA>

# AWS
AWS_REGION=us-east-2
AWS_ACCESS_KEY_ID=<YOUR_AWS_ACCESS_KEY_ID>
AWS_SECRET_ACCESS_KEY=<YOUR_AWS_SECRET_ACCESS_KEY>
S3_VIDEO_BUCKET=cinevision-video
S3_COVER_BUCKET=cinevision-cover
CLOUDFRONT_DISTRIBUTION_DOMAIN=dcscincghoovk.cloudfront.net

# STRIPE
STRIPE_SECRET_KEY=<YOUR_STRIPE_SECRET_KEY>
STRIPE_PUBLISHABLE_KEY=<YOUR_STRIPE_PUBLISHABLE_KEY>

# GOOGLE DRIVE
GOOGLE_CLIENT_EMAIL=cinevision-drive-uploader@projeto1workana.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n<SUA_CHAVE_PRIVADA>\n-----END PRIVATE KEY-----\n"

# CORS - ⚠️ ATUALIZAR COM DOMÍNIO DO VERCEL!
CORS_ORIGIN=https://<SEU-FRONTEND>.vercel.app
FRONTEND_URL=https://<SEU-FRONTEND>.vercel.app

# SECURITY
BCRYPT_ROUNDS=12
RATE_LIMIT_TTL=60
RATE_LIMIT_LIMIT=100
```

### 1.3. Deploy

1. Railway fará deploy automaticamente
2. Anote a URL gerada: `https://<SEU-PROJETO>.railway.app`
3. Acesse `https://<SEU-PROJETO>.railway.app/api/v1/status` para verificar

---

## 🌐 PARTE 2: Deploy do Frontend (Vercel)

### 2.1. Criar Projeto no Vercel

1. Acesse https://vercel.com
2. Clique em "New Project"
3. Importe seu repositório do GitHub
4. Configure o Root Directory como `frontend`
5. Framework Preset: **Next.js** (auto-detectado)

### 2.2. Configurar Variáveis de Ambiente

No Vercel, vá em **Settings** → **Environment Variables** e adicione:

```env
# API - ⚠️ USAR URL DO RAILWAY!
NEXT_PUBLIC_API_URL=https://<SEU-BACKEND>.railway.app

# SUPABASE
NEXT_PUBLIC_SUPABASE_URL=https://szghyvnbmjlquznxhqum.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6Z2h5dm5ibWpscXV6bnhocXVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3NDk5OTksImV4cCI6MjA3NDMyNTk5OX0._VqIPIYTflB8j8bdShAqet5GGSgXeP1auh1Mj3mLfLs

# CDN
NEXT_PUBLIC_CDN_URL=https://dcscincghoovk.cloudfront.net

# CHROMECAST
NEXT_PUBLIC_CAST_APP_ID=CC1AD845
NEXT_PUBLIC_CHROMECAST_APP_ID=CC1AD845

# STRIPE
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_51SAyO2Fqief8GJtdwnt6e4pVwl8smDW8NUwQ7SYbbpVibfYlQHVKrl1ag7I9lkdOmVi2oYlsP9JBZyNMyQ3iYZsl00FnNM20fr

# ENVIRONMENT
NODE_ENV=production
BASE_URL=https://<SEU-FRONTEND>.vercel.app
```

### 2.3. Deploy

1. Clique em "Deploy"
2. Aguarde o build (~3-5 minutos)
3. Anote a URL gerada: `https://<SEU-PROJETO>.vercel.app`

---

## 🔄 PARTE 3: Atualizar URLs Cruzadas

### 3.1. Atualizar Backend com URL do Frontend

No Railway, atualize as variáveis:

```env
CORS_ORIGIN=https://<SEU-FRONTEND>.vercel.app
FRONTEND_URL=https://<SEU-FRONTEND>.vercel.app
TELEGRAM_WEBHOOK_URL=https://<SEU-BACKEND>.railway.app/api/v1/telegrams/webhook
```

Clique em "Redeploy" no Railway.

### 3.2. Atualizar Frontend com URL do Backend

No Vercel, atualize:

```env
NEXT_PUBLIC_API_URL=https://<SEU-BACKEND>.railway.app
BASE_URL=https://<SEU-FRONTEND>.vercel.app
```

Faça um novo deploy no Vercel.

---

## 🤖 PARTE 4: Configurar Webhook do Telegram

### 4.1. Configurar Webhook

Execute este comando (substitua as URLs):

```bash
curl -X POST https://api.telegram.org/bot8284657866:AAFZ9KhQ3wgr7ms5KJWpNk-8QnrnlIJHcKM/setWebhook \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://<SEU-BACKEND>.railway.app/api/v1/telegrams/webhook",
    "secret_token": "<SEU_TELEGRAM_WEBHOOK_SECRET>"
  }'
```

### 4.2. Verificar Webhook

```bash
curl https://api.telegram.org/bot8284657866:AAFZ9KhQ3wgr7ms5KJWpNk-8QnrnlIJHcKM/getWebhookInfo
```

---

## ✅ PARTE 5: Testes Pós-Deploy

### 5.1. Verificar Backend

```bash
# Health check
curl https://<SEU-BACKEND>.railway.app/api/v1/status

# Swagger docs
# Acesse: https://<SEU-BACKEND>.railway.app/api/docs
```

### 5.2. Verificar Frontend

1. Acesse `https://<SEU-FRONTEND>.vercel.app`
2. Teste login/registro
3. Teste visualização de filmes
4. Teste compra (modo teste do Stripe)

### 5.3. Verificar Telegram

1. Envie `/start` para o bot
2. Teste vinculação de conta
3. Teste notificações de compra

---

## 🔧 PARTE 6: Troubleshooting Comum

### Erro de CORS

**Problema**: Frontend não consegue se comunicar com backend

**Solução**:
1. Verifique `CORS_ORIGIN` no Railway inclui URL do Vercel
2. Certifique-se que `NEXT_PUBLIC_API_URL` no Vercel está correto
3. Redeploy ambos após mudanças

### Erro 500 no Backend

**Problema**: Backend retorna erro 500

**Solução**:
1. Verifique logs no Railway Dashboard
2. Confirme todas as variáveis de ambiente estão configuradas
3. Verifique conexão com Supabase

### Webhook do Telegram não funciona

**Problema**: Bot não responde a comandos

**Solução**:
1. Verifique webhook com `getWebhookInfo`
2. Confirme `TELEGRAM_WEBHOOK_URL` está correto
3. Verifique logs do backend para erros

### Imagens não carregam

**Problema**: Posters/thumbnails não aparecem

**Solução**:
1. Verifique configuração S3 e CloudFront
2. Confirme `remotePatterns` em `next.config.js`
3. Verifique CORS no bucket S3

---

## 📊 PARTE 7: Monitoramento

### Railway Logs

```bash
# Acesse Railway Dashboard > Project > Deployments > View Logs
```

### Vercel Logs

```bash
# Acesse Vercel Dashboard > Project > Deployments > Function Logs
```

### Supabase Logs

```bash
# Acesse Supabase Dashboard > Logs & Monitoring
```

---

## 🔐 PARTE 8: Segurança Pós-Deploy

### ⚠️ IMPORTANTE: Gerar Novos Secrets

Gere strings aleatórias fortes para:

```bash
# JWT_SECRET (mínimo 32 caracteres)
openssl rand -base64 32

# JWT_REFRESH_SECRET (mínimo 32 caracteres)
openssl rand -base64 32

# TELEGRAM_WEBHOOK_SECRET (mínimo 16 caracteres)
openssl rand -hex 16
```

### Checklist de Segurança

- [ ] JWT secrets alterados dos valores de desenvolvimento
- [ ] CORS configurado apenas para domínios específicos
- [ ] Supabase RLS (Row Level Security) ativado
- [ ] Telegram webhook secret configurado
- [ ] Rate limiting ativado no backend
- [ ] HTTPS habilitado (automático Vercel/Railway)
- [ ] Variáveis de ambiente não commitadas no Git

---

## 🚀 Deploy Contínuo (CI/CD)

### Configuração Automática

Ambos Vercel e Railway fazem deploy automaticamente quando você faz push para o branch principal:

1. **Development**: Push para `dev` branch
   - Vercel: Preview deployment
   - Railway: Staging environment

2. **Production**: Push para `main` branch
   - Vercel: Production deployment
   - Railway: Production environment

---

## 📞 Suporte

Em caso de problemas:

1. Verifique os logs (Railway/Vercel/Supabase)
2. Consulte a documentação oficial:
   - [Railway Docs](https://docs.railway.app)
   - [Vercel Docs](https://vercel.com/docs)
   - [Next.js Docs](https://nextjs.org/docs)
   - [NestJS Docs](https://docs.nestjs.com)

---

## 📝 Checklist Final

- [ ] Backend deployado no Railway
- [ ] Frontend deployado no Vercel
- [ ] Variáveis de ambiente configuradas
- [ ] URLs cruzadas atualizadas
- [ ] Webhook do Telegram configurado
- [ ] Testes realizados
- [ ] Secrets de segurança alterados
- [ ] Monitoramento configurado
- [ ] Documentação atualizada

---

**🎉 Parabéns! Seu Cine Vision está em produção!**
