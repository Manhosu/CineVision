# Remoção do Docker do Sistema CineVision

## 📅 Data: 10/10/2025

## ⚠️ **Motivo da Remoção**
O Docker foi removido do sistema por decisão do projeto, pois:
- Não estava sendo utilizado no ambiente de desenvolvimento
- Ocupava espaço desnecessário
- Adiciona complexidade sem benefício no contexto atual
- O sistema roda perfeitamente com npm scripts locais

## 🗑️ **Arquivos Removidos**

### Dockerfiles:
- `admin/Dockerfile`
- `backend/Dockerfile`
- `bot/Dockerfile`
- `docker/transcoder/Dockerfile`

### Docker Compose:
- `docker-compose.yml`
- `docker-compose.prod.yml`
- `infra/docker-compose.yml`
- `docker/transcoder/docker-compose.transcoder.yml`

### Diretórios:
- `docker/` (inteiro)

### Configurações:
- Todos os arquivos `.dockerignore`

## ✅ **Ambiente Atual de Desenvolvimento**

### Serviços Rodando:
```bash
# Frontend (porta 3000)
cd frontend && npm run dev

# Backend (porta 3001)
cd backend && npm run start:dev

# Bot Telegram (porta 3003)
cd bot && npm run dev
```

### Infraestrutura:
- **Banco de Dados**: Supabase (cloud)
- **Storage**: AWS S3
- **Cache**: Não utilizado (Redis removido)
- **CDN**: CloudFront

## 📝 **Notas Importantes**

1. **PostgreSQL Local**: Não é necessário. Usamos Supabase cloud.
2. **Redis**: Não está em uso no projeto atual.
3. **Deploy**: Para produção, use serviços de hosting como Vercel, Railway, ou AWS diretamente.

## 🚀 **Como Rodar o Sistema**

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente (.env)
# Backend: .env
# Frontend: .env.local

# 3. Rodar backend
cd backend
npm run start:dev

# 4. Rodar frontend (em outro terminal)
cd frontend
npm run dev

# 5. Rodar bot (opcional, em outro terminal)
cd bot
npm run dev
```

## 📊 **Arquitetura Simplificada**

```
Frontend (Next.js) :3000
    ↓
Backend (NestJS) :3001
    ↓
Supabase (PostgreSQL)
AWS S3 (Storage)
CloudFront (CDN)
```

## 🔄 **Se Precisar de Docker Novamente**

Caso seja necessário reimplementar Docker no futuro:
1. Consultar este arquivo para contexto
2. Criar Dockerfiles específicos para cada serviço
3. Configurar docker-compose.yml com todos os serviços
4. Documentar processo de build e deploy

---

**Última atualização**: 10/10/2025
**Autor**: Sistema automatizado
