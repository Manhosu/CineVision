#!/bin/bash
# 🚀 Comandos Essenciais para Deploy - Cine Vision

# ============================================
# DEPLOY SIMULADO LOCAL
# ============================================

echo "🔨 Testando builds localmente..."

# Build Backend
echo "📦 Building backend..."
cd backend && npm run build
if [ $? -eq 0 ]; then
    echo "✅ Backend build OK"
else
    echo "❌ Backend build FAILED"
    exit 1
fi

# Build Frontend
echo "📦 Building frontend..."
cd ../frontend && npm run build
if [ $? -eq 0 ]; then
    echo "✅ Frontend build OK"
else
    echo "❌ Frontend build FAILED"
    exit 1
fi

cd ..
echo "✅ Todos os builds passaram!"

# ============================================
# GERAR SECRETS DE SEGURANÇA
# ============================================

echo ""
echo "🔐 Gerando secrets de segurança..."
echo ""
echo "JWT_SECRET:"
openssl rand -base64 32
echo ""
echo "JWT_REFRESH_SECRET:"
openssl rand -base64 32
echo ""
echo "TELEGRAM_WEBHOOK_SECRET:"
openssl rand -hex 16
echo ""
echo "⚠️  Copie estes valores e atualize no Railway!"

# ============================================
# CONFIGURAR WEBHOOK DO TELEGRAM
# ============================================

# Substitua com suas URLs após deploy
BACKEND_URL="https://SEU-BACKEND.railway.app"
WEBHOOK_SECRET="production-webhook-secret"
BOT_TOKEN="8284657866:AAFZ9KhQ3wgr7ms5KJWpNk-8QnrnlIJHcKM"

echo ""
echo "🤖 Para configurar webhook do Telegram após deploy, execute:"
echo ""
echo "curl -X POST https://api.telegram.org/bot${BOT_TOKEN}/setWebhook \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"url\": \"${BACKEND_URL}/api/v1/telegrams/webhook\", \"secret_token\": \"${WEBHOOK_SECRET}\"}'"
echo ""

# ============================================
# VERIFICAR WEBHOOK DO TELEGRAM
# ============================================

echo "Para verificar webhook:"
echo ""
echo "curl https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo"
echo ""

# ============================================
# HEALTH CHECKS
# ============================================

echo "🏥 Comandos de health check:"
echo ""
echo "Backend:  curl ${BACKEND_URL}/api/v1/status"
echo "Swagger:  ${BACKEND_URL}/api/docs"
echo ""

# ============================================
# INFORMAÇÕES ÚTEIS
# ============================================

echo "📝 Arquivos criados para deploy:"
echo "  - backend/.env.production"
echo "  - backend/railway.json"
echo "  - backend/Procfile"
echo "  - frontend/.env.production"
echo "  - frontend/vercel.json"
echo "  - DEPLOY.md (guia completo)"
echo "  - DEPLOY-QUICK-START.md (guia rápido)"
echo "  - DEPLOY-SUMMARY.md (resumo)"
echo ""

echo "🎉 Sistema pronto para deploy!"
echo ""
echo "Próximos passos:"
echo "1. Criar projeto no Railway (backend)"
echo "2. Criar projeto no Vercel (frontend)"
echo "3. Configurar variáveis de ambiente"
echo "4. Atualizar URLs cruzadas"
echo "5. Configurar webhook do Telegram"
echo ""
echo "📖 Leia DEPLOY-QUICK-START.md para instruções detalhadas"
