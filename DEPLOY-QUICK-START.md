# 🚀 Deploy Rápido - Cine Vision

Guia rápido de 15 minutos para colocar o Cine Vision em produção.

## ✅ Checklist Pré-Deploy

- [ ] Git repositório criado e código commitado
- [ ] Conta Railway criada (railway.app)
- [ ] Conta Vercel criada (vercel.com)
- [ ] Supabase já configurado ✅
- [ ] AWS S3 já configurado ✅

---

## 1️⃣ Deploy Backend (Railway) - 5 minutos

### Passo 1: Criar Projeto
1. Acesse https://railway.app
2. "New Project" → "Deploy from GitHub repo"
3. Selecione seu repositório
4. Root Directory: `backend`

### Passo 2: Adicionar Variáveis (copie e cole)
```env
NODE_ENV=production
PORT=3001
ENABLE_TYPEORM=false
DATABASE_TYPE=postgres

SUPABASE_URL=https://szghyvnbmjlquznxhqum.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6Z2h5dm5ibWpscXV6bnhocXVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3NDk5OTksImV4cCI6MjA3NDMyNTk5OX0._VqIPIYTflB8j8bdShAqet5GGSgXeP1auh1Mj3mLfLs
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6Z2h5dm5ibWpscXV6bnhocXVtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODc0OTk5OSwiZXhwIjoyMDc0MzI1OTk5fQ.p9_G_CjLg8h2CVZqteKLdK9WUFKFdXSqTuTolHFiWGc
SUPABASE_JWT_SECRET=3aburoRntkC26WbcuTDRp9xIndcrs1sF1hSZGq9Z9jox4rkeJL88AIC/RhdL1n1Hbznz4xYF+xa+plfMMuFbiA==
SUPABASE_DATABASE_URL=postgresql://postgres.szghyvnbmjlquznxhqum:Umeomesmo1%2C@aws-1-sa-east-1.pooler.supabase.com:5432/postgres

JWT_SECRET=your-production-secret-change-me-123456789
JWT_REFRESH_SECRET=your-production-refresh-secret-change-me-987654321
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

TELEGRAM_BOT_TOKEN=8284657866:AAFZ9KhQ3wgr7ms5KJWpNk-8QnrnlIJHcKM
TELEGRAM_BOT_USERNAME=cinevisionv2bot
TELEGRAM_WEBHOOK_SECRET=production-webhook-secret

AWS_REGION=us-east-2
AWS_ACCESS_KEY_ID=<YOUR_AWS_ACCESS_KEY_ID>
AWS_SECRET_ACCESS_KEY=<YOUR_AWS_SECRET_ACCESS_KEY>
S3_VIDEO_BUCKET=cinevision-video
S3_COVER_BUCKET=cinevision-cover
CLOUDFRONT_DISTRIBUTION_DOMAIN=dcscincghoovk.cloudfront.net

STRIPE_SECRET_KEY=<YOUR_STRIPE_SECRET_KEY>
STRIPE_PUBLISHABLE_KEY=<YOUR_STRIPE_PUBLISHABLE_KEY>

GOOGLE_CLIENT_EMAIL=cinevision-drive-uploader@projeto1workana.iam.gserviceaccount.com

BCRYPT_ROUNDS=12
RATE_LIMIT_TTL=60
RATE_LIMIT_LIMIT=100
```

### Passo 3: Deploy
1. Railway faz deploy automaticamente
2. **Copie a URL gerada**: `https://SEU-PROJETO.railway.app`

---

## 2️⃣ Deploy Frontend (Vercel) - 5 minutos

### Passo 1: Criar Projeto
1. Acesse https://vercel.com
2. "New Project" → Import do GitHub
3. Root Directory: `frontend`
4. Framework: Next.js (auto-detect)

### Passo 2: Adicionar Variáveis (substitua a URL)
```env
NEXT_PUBLIC_API_URL=https://SEU-BACKEND.railway.app

NEXT_PUBLIC_SUPABASE_URL=https://szghyvnbmjlquznxhqum.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6Z2h5dm5ibWpscXV6bnhocXVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3NDk5OTksImV4cCI6MjA3NDMyNTk5OX0._VqIPIYTflB8j8bdShAqet5GGSgXeP1auh1Mj3mLfLs

NEXT_PUBLIC_CDN_URL=https://dcscincghoovk.cloudfront.net
NEXT_PUBLIC_CAST_APP_ID=CC1AD845
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_51SAyO2Fqief8GJtdwnt6e4pVwl8smDW8NUwQ7SYbbpVibfYlQHVKrl1ag7I9lkdOmVi2oYlsP9JBZyNMyQ3iYZsl00FnNM20fr

NODE_ENV=production
```

### Passo 3: Deploy
1. Clique em "Deploy"
2. **Copie a URL gerada**: `https://SEU-PROJETO.vercel.app`

---

## 3️⃣ Conectar Backend + Frontend - 3 minutos

### No Railway (atualizar backend):
Adicione estas variáveis:
```env
CORS_ORIGIN=https://SEU-FRONTEND.vercel.app
FRONTEND_URL=https://SEU-FRONTEND.vercel.app
TELEGRAM_WEBHOOK_URL=https://SEU-BACKEND.railway.app/api/v1/telegrams/webhook
```
Clique em "Redeploy"

---

## 4️⃣ Configurar Telegram - 2 minutos

Execute no terminal (substitua as URLs):
```bash
curl -X POST https://api.telegram.org/bot8284657866:AAFZ9KhQ3wgr7ms5KJWpNk-8QnrnlIJHcKM/setWebhook \
  -H "Content-Type: application/json" \
  -d '{"url": "https://SEU-BACKEND.railway.app/api/v1/telegrams/webhook", "secret_token": "production-webhook-secret"}'
```

---

## ✅ Testes Finais

1. **Backend**: `https://SEU-BACKEND.railway.app/api/v1/status`
2. **Frontend**: `https://SEU-FRONTEND.vercel.app`
3. **Telegram**: Envie `/start` para @cinevisionv2bot

---

## 🔥 Problemas Comuns

### CORS Error
- Verifique `CORS_ORIGIN` no Railway
- Certifique-se que URL do Vercel está correta
- Redeploy ambos

### Backend 500
- Verifique logs no Railway Dashboard
- Confirme todas variáveis estão configuradas

### Telegram não funciona
```bash
# Verificar webhook
curl https://api.telegram.org/bot8284657866:AAFZ9KhQ3wgr7ms5KJWpNk-8QnrnlIJHcKM/getWebhookInfo
```

---

## 📊 Arquivos Criados

Os seguintes arquivos foram criados para facilitar o deploy:

### Backend:
- `backend/.env.production` - Variáveis de produção
- `backend/railway.json` - Config Railway
- `backend/Procfile` - Comando de start

### Frontend:
- `frontend/.env.production` - Variáveis de produção
- `frontend/vercel.json` - Config Vercel

### Geral:
- `DEPLOY.md` - Guia completo de deploy
- `DEPLOY-QUICK-START.md` - Este arquivo

---

## 🎉 Pronto!

Seu Cine Vision está em produção!

**URLs:**
- Frontend: `https://SEU-PROJETO.vercel.app`
- Backend: `https://SEU-PROJETO.railway.app`
- API Docs: `https://SEU-PROJETO.railway.app/api/docs`

---

## 📝 Próximos Passos

1. Configure um domínio personalizado (opcional)
2. Configure alertas de monitoramento
3. Atualize secrets de segurança (JWT, Telegram)
4. Configure CI/CD para deploys automáticos

Ver **DEPLOY.md** para guia completo.
