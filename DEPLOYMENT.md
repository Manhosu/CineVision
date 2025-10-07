# 🚀 CineVision - Guia de Deployment para Produção

**Versão**: 2.0
**Última Atualização**: 03/01/2025
**Tempo Estimado de Deploy**: 30-45 minutos

---

## 📋 Pré-requisitos

### **Ambiente**
- ✅ Node.js >= 18.0.0
- ✅ PostgreSQL >= 14 (via Supabase)
- ✅ Redis >= 6.0 (para cache)
- ✅ Docker & Docker Compose (opcional, recomendado)
- ✅ AWS Account (S3 + CloudFront configurados)
- ✅ Domínio com SSL/HTTPS

### **Acessos e Credenciais**
- [ ] Supabase Project criado e configurado
- [ ] AWS IAM User com permissões S3 + CloudFront
- [ ] Stripe Account (production keys)
- [ ] Telegram Bot Token
- [ ] Domínio DNS configurado

---

## 🔧 Fase 1: Configuração do Servidor

### **1.1. Instalar Dependências do Sistema**

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y nodejs npm postgresql-client redis-server nginx certbot

# Verificar versões
node --version  # v18+
npm --version
redis-cli --version
```

### **1.2. Configurar Redis**

```bash
# Editar configuração do Redis
sudo nano /etc/redis/redis.conf

# Mudanças recomendadas:
# maxmemory 256mb
# maxmemory-policy allkeys-lru
# save 900 1
# save 300 10

# Reiniciar Redis
sudo systemctl restart redis
sudo systemctl enable redis

# Testar
redis-cli ping  # Deve retornar: PONG
```

### **1.3. Clonar Repositório**

```bash
cd /var/www
git clone https://github.com/seu-usuario/cinevision.git
cd cinevision

# Checkout para branch de produção
git checkout main
```

---

## 🔐 Fase 2: Configuração de Variáveis de Ambiente

### **2.1. Backend (.env)**

```bash
cd backend
cp .env.example .env
nano .env
```

**Configurações OBRIGATÓRIAS para Produção:**

```env
# Application
NODE_ENV=production
PORT=3001
LOG_LEVEL=info

# Database (Supabase)
SUPABASE_DATABASE_URL=postgresql://postgres:<PASSWORD>@<HOST>:5432/postgres
SUPABASE_URL=https://<PROJECT_ID>.supabase.co
SUPABASE_ANON_KEY=<ANON_KEY>
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY>

# JWT (GERAR NOVOS SECRETS!)
JWT_SECRET=$(openssl rand -base64 32)
JWT_REFRESH_SECRET=$(openssl rand -base64 32)
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# Redis (HABILITAR!)
REDIS_ENABLED=true
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# AWS
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=<YOUR_KEY>
AWS_SECRET_ACCESS_KEY=<YOUR_SECRET>
AWS_S3_BUCKET=cinevision-storage

# CloudFront
CLOUDFRONT_DISTRIBUTION_DOMAIN=<YOUR_DIST>.cloudfront.net
CLOUDFRONT_KEY_PAIR_ID=<KEY_PAIR_ID>
CLOUDFRONT_PRIVATE_KEY_PATH=./cloudfront-private-key.pem

# Stripe (PRODUCTION KEYS!)
STRIPE_SECRET_KEY=sk_live_<YOUR_KEY>
STRIPE_PUBLISHABLE_KEY=pk_live_<YOUR_KEY>
STRIPE_WEBHOOK_SECRET=whsec_<YOUR_SECRET>

# Telegram
TELEGRAM_BOT_TOKEN=<BOT_TOKEN>
TELEGRAM_WEBHOOK_URL=https://api.cinevision.com/api/v1/telegram/webhook

# Monitoring (Opcional)
SENTRY_DSN=https://<DSN>@sentry.io/<PROJECT>
SENTRY_ENVIRONMENT=production
```

### **2.2. Frontend (.env.local)**

```bash
cd ../frontend
cp .env.example .env.local
nano .env.local
```

```env
NEXT_PUBLIC_API_URL=https://api.cinevision.com/api/v1
NEXT_PUBLIC_SUPABASE_URL=https://<PROJECT_ID>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY>
NEXT_PUBLIC_SENTRY_DSN=<DSN> # Opcional
```

---

## 📦 Fase 3: Instalação de Dependências

### **3.1. Backend**

```bash
cd /var/www/cinevision/backend

# Instalar dependências
npm ci --production=false

# Verificar instalação
npm list winston winston-daily-rotate-file ioredis
```

### **3.2. Frontend**

```bash
cd /var/www/cinevision/frontend

# Instalar dependências
npm ci --production=false
```

---

## 🗄️ Fase 4: Configuração do Banco de Dados

### **4.1. Executar Migrations**

```bash
cd /var/www/cinevision/backend

# Verificar migrations pendentes
npm run migration:show

# Executar migrations
npm run migration:run

# Verificar status
npm run migration:show
```

**Migrations Esperadas:**
- ✅ `20250101000000_add_stripe_and_storage_fields`
- ✅ `20250101000001_create_series_and_episodes`
- ✅ `20250101000002_create_user_favorites`
- ✅ `20250102000001_create_admin_settings`
- ✅ `20250103000001_add_admin_user`
- ✅ `20250104000001_add_performance_indexes`

### **4.2. Executar Seeds de Produção**

```bash
# IMPORTANTE: Usar seed de produção (sem dados mock)
psql $SUPABASE_DATABASE_URL -f src/database/seeds/production-seed.sql

# Verificar dados
psql $SUPABASE_DATABASE_URL -c "SELECT COUNT(*) FROM categories;"
# Deve retornar: 10

psql $SUPABASE_DATABASE_URL -c "SELECT email, role FROM users WHERE role='admin';"
# Deve retornar: adm@cinevision.com.br | admin
```

### **4.3. Verificar Índices**

```bash
psql $SUPABASE_DATABASE_URL -c "\di+ idx_*"
```

**Índices Esperados:**
- `idx_content_status_created`
- `idx_purchases_user_status`
- `idx_content_requests_user`
- `idx_content_views`
- `idx_content_category`
- `idx_streaming_analytics_content`
- `idx_streaming_analytics_user`
- `idx_payments_user_status`
- `idx_content_search`

---

## 🏗️ Fase 5: Build da Aplicação

### **5.1. Build Backend**

```bash
cd /var/www/cinevision/backend

# Compilar TypeScript
npm run build

# Verificar build
ls -lh dist/

# Teste rápido
NODE_ENV=production node dist/main.js &
sleep 5
curl http://localhost:3001/api/v1/health
kill %1
```

### **5.2. Build Frontend**

```bash
cd /var/www/cinevision/frontend

# Build Next.js
npm run build

# Verificar build
ls -lh .next/

# Bundle size deve ser <500KB (gzipped)
```

---

## 🚀 Fase 6: Deploy com PM2

### **6.1. Instalar PM2**

```bash
npm install -g pm2
```

### **6.2. Configurar PM2 Backend**

```bash
cd /var/www/cinevision/backend

# Criar ecosystem file
cat > ecosystem.config.js <<'EOF'
module.exports = {
  apps: [{
    name: 'cinevision-api',
    script: 'dist/main.js',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: 'logs/pm2-error.log',
    out_file: 'logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    max_memory_restart: '500M',
    watch: false,
    ignore_watch: ['node_modules', 'logs'],
  }]
};
EOF

# Iniciar
pm2 start ecosystem.config.js

# Verificar
pm2 status
pm2 logs cinevision-api --lines 50
```

### **6.3. Configurar PM2 Frontend**

```bash
cd /var/www/cinevision/frontend

cat > ecosystem.config.js <<'EOF'
module.exports = {
  apps: [{
    name: 'cinevision-web',
    script: 'node_modules/next/dist/bin/next',
    args: 'start -p 3000',
    instances: 1,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production'
    },
    error_file: 'logs/pm2-error.log',
    out_file: 'logs/pm2-out.log',
    max_memory_restart: '1G',
  }]
};
EOF

pm2 start ecosystem.config.js
pm2 status
```

### **6.4. Configurar Autostart**

```bash
# Salvar configuração PM2
pm2 save

# Gerar script de startup
pm2 startup

# Copiar e executar o comando mostrado
# Exemplo: sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu
```

---

## 🌐 Fase 7: Configuração do Nginx

### **7.1. Configurar Reverse Proxy**

```bash
sudo nano /etc/nginx/sites-available/cinevision
```

```nginx
# API Backend
server {
    listen 80;
    server_name api.cinevision.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Healthcheck
    location /api/v1/health {
        proxy_pass http://localhost:3001/api/v1/health;
        access_log off;
    }
}

# Frontend
server {
    listen 80;
    server_name cinevision.com www.cinevision.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Next.js static files
    location /_next/static {
        proxy_pass http://localhost:3000/_next/static;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
}
```

```bash
# Habilitar site
sudo ln -s /etc/nginx/sites-available/cinevision /etc/nginx/sites-enabled/

# Testar configuração
sudo nginx -t

# Recarregar Nginx
sudo systemctl reload nginx
```

### **7.2. Configurar SSL com Certbot**

```bash
# Instalar certificados
sudo certbot --nginx -d cinevision.com -d www.cinevision.com -d api.cinevision.com

# Verificar renovação automática
sudo certbot renew --dry-run
```

---

## ✅ Fase 8: Validação Pós-Deploy

### **8.1. Healthchecks**

```bash
# API Health
curl https://api.cinevision.com/api/v1/health
# Esperado: {"status":"ok","timestamp":"..."}

# Database
curl https://api.cinevision.com/api/v1/health/database
# Esperado: {"status":"ok","latency":"<50ms"}

# Redis
curl https://api.cinevision.com/api/v1/health/cache
# Esperado: {"status":"ok","connected":true}

# Frontend
curl -I https://cinevision.com
# Esperado: HTTP/2 200
```

### **8.2. Testes Funcionais**

```bash
# Login Admin
curl -X POST https://api.cinevision.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"adm@cinevision.com.br","password":"Admin123"}'

# Listar Categorias
curl https://api.cinevision.com/api/v1/content/categories

# Top 10 Filmes
curl https://api.cinevision.com/api/v1/content/top
```

### **8.3. Verificar Cache**

```bash
# Verificar Redis
redis-cli INFO stats | grep keyspace_hits
redis-cli KEYS "content:*" | wc -l

# Logs de cache
pm2 logs cinevision-api | grep "Cache"
```

### **8.4. Verificar Logs**

```bash
# PM2 Logs
pm2 logs cinevision-api --lines 100
pm2 logs cinevision-web --lines 100

# Winston Logs
tail -f /var/www/cinevision/backend/logs/combined-$(date +%Y-%m-%d).log
tail -f /var/www/cinevision/backend/logs/error-$(date +%Y-%m-%d).log
```

---

## 🔄 Fase 9: Monitoramento

### **9.1. Configurar PM2 Monitoring**

```bash
# PM2 Plus (opcional, gratuito para 1 servidor)
pm2 link <PUBLIC_KEY> <PRIVATE_KEY>
```

### **9.2. Configurar Log Rotation**

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

### **9.3. Alertas (opcional)**

```bash
# Instalar pm2-slack
pm2 install pm2-slack
pm2 set pm2-slack:slack_url https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

---

## 🔧 Operações Comuns

### **Atualizar Aplicação**

```bash
# 1. Pull código
cd /var/www/cinevision
git pull origin main

# 2. Instalar dependências
cd backend && npm ci && npm run build
cd ../frontend && npm ci && npm run build

# 3. Executar migrations (se houver)
cd ../backend && npm run migration:run

# 4. Restart PM2
pm2 restart all

# 5. Verificar
pm2 status
curl https://api.cinevision.com/api/v1/health
```

### **Rollback**

```bash
# 1. Voltar para commit anterior
git log --oneline -10
git checkout <COMMIT_HASH>

# 2. Rebuild
cd backend && npm run build
cd ../frontend && npm run build

# 3. Reverter migration (se necessário)
cd backend && npm run migration:revert

# 4. Restart
pm2 restart all
```

### **Limpar Cache**

```bash
# Redis
redis-cli FLUSHDB

# PM2 restart (limpa cache in-memory)
pm2 restart all
```

### **Backup Database**

```bash
# Backup completo
pg_dump $SUPABASE_DATABASE_URL > backup-$(date +%Y%m%d-%H%M%S).sql

# Backup apenas schema
pg_dump --schema-only $SUPABASE_DATABASE_URL > schema-backup.sql

# Automatizar backups (crontab)
crontab -e
# Adicionar: 0 3 * * * pg_dump $SUPABASE_DATABASE_URL > /backups/db-$(date +\%Y\%m\%d).sql
```

---

## 🐛 Troubleshooting

### **API não inicia**

```bash
# Verificar logs
pm2 logs cinevision-api --err

# Verificar porta em uso
lsof -i :3001

# Testar manualmente
cd /var/www/cinevision/backend
NODE_ENV=production node dist/main.js
```

### **Redis connection failed**

```bash
# Verificar status
sudo systemctl status redis

# Testar conexão
redis-cli ping

# Verificar configuração
redis-cli CONFIG GET bind
redis-cli CONFIG GET protected-mode
```

### **Database connection timeout**

```bash
# Verificar conectividade
psql $SUPABASE_DATABASE_URL -c "SELECT 1"

# Verificar firewall/security groups
# Supabase: Database Settings > Connection Pooling
```

### **High memory usage**

```bash
# Verificar uso
pm2 monit

# Restart processo específico
pm2 restart cinevision-api

# Limpar cache Redis
redis-cli FLUSHDB
```

---

## 📊 Métricas de Sucesso

Após o deploy, verificar:

- ✅ **Uptime > 99%**: `pm2 status` (uptime)
- ✅ **Response Time < 200ms**: `curl -w "@curl-format.txt" -o /dev/null -s https://api.cinevision.com/api/v1/health`
- ✅ **Cache Hit Rate > 60%**: `redis-cli INFO stats | grep keyspace_hits`
- ✅ **Error Rate < 1%**: Verificar logs Sentry/Winston
- ✅ **Database Queries < 100ms**: Verificar logs com `performance()`

---

## 🎯 Checklist Final

- [ ] Servidor configurado (Node, Redis, PostgreSQL)
- [ ] Variáveis de ambiente configuradas
- [ ] Dependências instaladas (backend + frontend)
- [ ] Migrations executadas
- [ ] Seeds de produção aplicados
- [ ] Build gerado (backend + frontend)
- [ ] PM2 configurado e rodando
- [ ] Nginx reverse proxy configurado
- [ ] SSL/HTTPS ativo
- [ ] Healthchecks passando
- [ ] Cache Redis funcionando
- [ ] Logs estruturados ativos
- [ ] Monitoramento configurado
- [ ] Backups automáticos agendados
- [ ] DNS apontando corretamente
- [ ] Testes E2E executados com sucesso

---

**Sistema Production-Ready!** 🚀

**Documento gerado em**: 03/01/2025
**Contato**: contato@cinevision.com.br
