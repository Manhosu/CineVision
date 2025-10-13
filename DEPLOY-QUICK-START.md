# 🚀 Deploy Rápido - Cine Vision

Guia rápido de 15 minutos para colocar o Cine Vision em produção usando **Render** + **Vercel**.

## ✅ Checklist Pré-Deploy

- [ ] Git repositório criado e código commitado
- [ ] Conta Render criada (render.com)
- [ ] Conta Vercel criada (vercel.com)
- [ ] Supabase já configurado ✅
- [ ] AWS S3 já configurado ✅

---

## 1️⃣ Deploy Backend (Render) - 5 minutos

### Passo 1: Criar Web Service
1. Acesse https://dashboard.render.com
2. Clique em "New +" → "Web Service"
3. Conecte seu repositório GitHub
4. Configure:
   - **Name**: cinevision-backend
   - **Root Directory**: `backend`
   - **Environment**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start:prod`
   - **Instance Type**: Free (ou Starter $7/mês)

### Passo 2: Adicionar Variáveis de Ambiente

No Render, vá em **Environment** e adicione uma por uma:

```
NODE_ENV=production
PORT=3001
ENABLE_TYPEORM=false
DATABASE_TYPE=postgres
SUPABASE_URL=https://szghyvnbmjlquznxhqum.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6Z2h5dm5ibWpscXV6bnhocXVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3NDk5OTksImV4cCI6MjA3NDMyNTk5OX0._VqIPIYTflB8j8bdShAqet5GGSgXeP1auh1Mj3mLfLs
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6Z2h5dm5ibWpscXV6bnhocXVtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODc0OTk5OSwiZXhwIjoyMDc0MzI1OTk5fQ.p9_G_CjLg8h2CVZqteKLdK9WUFKFdXSqTuTolHFiWGc
SUPABASE_JWT_SECRET=3aburoRntkC26WbcuTDRp9xIndcrs1sF1hSZGq9Z9jox4rkeJL88AIC/RhdL1n1Hbznz4xYF+xa+plfMMuFbiA==
SUPABASE_DATABASE_URL=postgresql://postgres.szghyvnbmjlquznxhqum:Umeomesmo1%2C@aws-1-sa-east-1.pooler.supabase.com:5432/postgres
JWT_SECRET=GERE-UM-SECRET-ALEATORIO-LONGO
JWT_REFRESH_SECRET=GERE-OUTRO-SECRET-DIFERENTE
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d
TELEGRAM_BOT_TOKEN=8284657866:AAFZ9KhQ3wgr7ms5KJWpNk-8QnrnlIJHcKM
TELEGRAM_BOT_USERNAME=cinevisionv2bot
TELEGRAM_WEBHOOK_SECRET=gere-um-secret-para-webhook
AWS_REGION=us-east-2
AWS_ACCESS_KEY_ID=SUA-AWS-KEY
AWS_SECRET_ACCESS_KEY=SUA-AWS-SECRET
S3_VIDEO_BUCKET=cinevision-video
S3_COVER_BUCKET=cinevision-cover
CLOUDFRONT_DISTRIBUTION_DOMAIN=dcscincghoovk.cloudfront.net
STRIPE_SECRET_KEY=SUA-STRIPE-SECRET-KEY
STRIPE_PUBLISHABLE_KEY=SUA-STRIPE-PUBLISHABLE-KEY
GOOGLE_CLIENT_EMAIL=cinevision-drive-uploader@projeto1workana.iam.gserviceaccount.com
BCRYPT_ROUNDS=12
RATE_LIMIT_TTL=60
RATE_LIMIT_LIMIT=100
```

### Passo 3: Deploy
1. Clique em "Create Web Service"
2. Aguarde o build (~3-5 minutos)
3. **Copie a URL gerada**: Ex: `https://cinevision-backend.onrender.com`

---

## 2️⃣ Deploy Frontend (Vercel) - 5 minutos

### Passo 1: Criar Projeto
1. Acesse https://vercel.com
2. "New Project" → Import do GitHub
3. Root Directory: `frontend`
4. Framework: Next.js (auto-detect)

### Passo 2: Adicionar Variáveis
```
NEXT_PUBLIC_API_URL=https://SUA-URL.onrender.com
NEXT_PUBLIC_SUPABASE_URL=https://szghyvnbmjlquznxhqum.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6Z2h5dm5ibWpscXV6bnhocXVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3NDk5OTksImV4cCI6MjA3NDMyNTk5OX0._VqIPIYTflB8j8bdShAqet5GGSgXeP1auh1Mj3mLfLs
NEXT_PUBLIC_CDN_URL=https://dcscincghoovk.cloudfront.net
NEXT_PUBLIC_CAST_APP_ID=CC1AD845
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=SUA-STRIPE-PUBLISHABLE-KEY
NODE_ENV=production
```

### Passo 3: Deploy
1. Clique em "Deploy"
2. **Copie a URL gerada**: Ex: `https://seu-projeto.vercel.app`

---

## 3️⃣ Conectar Backend + Frontend - 3 minutos

### No Render (atualizar backend):
Adicione estas variáveis em **Environment**:
```
CORS_ORIGIN=https://seu-projeto.vercel.app
FRONTEND_URL=https://seu-projeto.vercel.app
TELEGRAM_WEBHOOK_URL=https://SUA-URL.onrender.com/api/v1/telegrams/webhook
```
Clique em **"Manual Deploy"** → **"Deploy latest commit"**

---

## 4️⃣ Configurar Telegram - 2 minutos

```bash
curl -X POST https://api.telegram.org/bot8284657866:AAFZ9KhQ3wgr7ms5KJWpNk-8QnrnlIJHcKM/setWebhook \
  -H "Content-Type: application/json" \
  -d '{"url": "https://SUA-URL.onrender.com/api/v1/telegrams/webhook", "secret_token": "seu-webhook-secret"}'
```

---

## ✅ Testes Finais

1. **Backend**: `https://SUA-URL.onrender.com/api/v1/status`
2. **Frontend**: `https://seu-projeto.vercel.app`
3. **API Docs**: `https://SUA-URL.onrender.com/api/docs`
4. **Telegram**: `/start` para @cinevisionv2bot

---

## 🔥 Problemas Comuns

### CORS Error
- Verifique `CORS_ORIGIN` no Render
- URL do Vercel deve estar correta
- Faça "Manual Deploy" após mudanças

### Backend 500
- Verifique logs: Render Dashboard → Logs
- Confirme variáveis de ambiente

### Backend demora (Render Free)
⚠️ **Importante**: Render Free tier coloca serviço em "sleep" após 15 min de inatividade
- Primeira requisição: 30-60 segundos
- Upgrade para Starter ($7/mês) para always-on

---

## 💰 Custos Mensais

| Serviço | Plano | Custo |
|---------|-------|-------|
| Vercel | Hobby | $0 |
| Render | Free* | $0 |
| Render | Starter | $7/mês |
| Supabase | Free | $0 |
| AWS | Pay-as-you-go | ~$2-5 |
| **TOTAL (Free)** | | **~$2-5/mês** |
| **TOTAL (Starter)** | | **~$9-12/mês** |

*Free tier: 750h/mês, sleep após inatividade

---

## 🎉 Pronto!

Seu Cine Vision está em produção!

Ver **DEPLOY.md** para guia completo.
