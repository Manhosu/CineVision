# 🚀 Guia de Desenvolvimento - Cine Vision

## 📋 Pré-requisitos

- **Node.js** 18+ ([Download](https://nodejs.org/))
- **PostgreSQL** via Supabase (já configurado)
- **Git** para controle de versão
- **Editor de código** (VSCode recomendado)

---

## 🔧 Setup Inicial

### 1. Clone o Repositório
```bash
git clone <repository-url>
cd Filmes
```

### 2. Configurar Variáveis de Ambiente

#### **Backend** (`backend/.env`)
```bash
cd backend
cp .env.example .env
# Edite .env com suas credenciais do Supabase
```

**Variáveis OBRIGATÓRIAS**:
- `SUPABASE_DATABASE_URL` - String de conexão PostgreSQL do Supabase
- `JWT_SECRET` - Chave secreta para JWT (mínimo 32 caracteres)
- `JWT_REFRESH_SECRET` - Chave secreta para refresh tokens

#### **Frontend** (`frontend/.env.local`)
```bash
cd ../frontend
cp .env.example .env.local
```

**Variáveis OBRIGATÓRIAS**:
- `NEXT_PUBLIC_API_URL=http://localhost:3001`

### 3. Instalar Dependências

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

---

## ▶️ Rodando o Projeto

### **Opção 1: Script Automático (Recomendado para Windows)**
```powershell
# Execute na raiz do projeto
.\scripts\dev.ps1
```

Este script:
✅ Verifica se arquivos `.env` existem
✅ Verifica se dependências estão instaladas
✅ Inicia backend primeiro
✅ Aguarda backend ficar saudável
✅ Inicia frontend
✅ Abre browser automaticamente

### **Opção 2: Manual**

**Terminal 1 - Backend:**
```bash
cd backend
npm run start:dev
```

Aguarde a mensagem:
```
[Nest] Application successfully started
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

---

## 🌐 URLs de Acesso

| Serviço | URL | Descrição |
|---------|-----|-----------|
| Frontend | http://localhost:3000 | Interface do usuário |
| Backend API | http://localhost:3001 | API RESTful |
| API Docs | http://localhost:3001/api | Swagger Documentation |
| Health Check | http://localhost:3001/health | Status do backend |

---

## 🔍 Troubleshooting

### ❌ **"ERR_CONNECTION_REFUSED" no console do browser**

**Problema**: Backend não está rodando

**Solução**:
1. Abra um terminal na pasta `backend`
2. Execute: `npm run start:dev`
3. Aguarde a mensagem de sucesso
4. Recarregue o frontend (F5)

---

### ❌ **"Failed to fetch" repetidamente**

**Problema**: Variável de ambiente `NEXT_PUBLIC_API_URL` incorreta

**Solução**:
1. Verifique `frontend/.env.local`:
   ```bash
   NEXT_PUBLIC_API_URL=http://localhost:3001
   ```
2. Reinicie o servidor frontend:
   ```bash
   cd frontend
   npm run dev
   ```

---

### ❌ **"SUPABASE_DATABASE_URL must be set"**

**Problema**: Variável de ambiente do banco não configurada

**Solução**:
1. Copie a connection string do seu projeto Supabase
2. Adicione em `backend/.env`:
   ```bash
   SUPABASE_DATABASE_URL=postgresql://postgres:password@host:5432/postgres
   ```
3. Reinicie o backend

---

### ❌ **Service Worker violating CSP**

**Problema**: Service Worker tentando fazer requisições bloqueadas

**Solução**: Este problema foi corrigido na versão mais recente. Se persistir:
1. Limpe o cache do browser (Ctrl+Shift+Del)
2. Desregistre o Service Worker:
   - Abra DevTools (F12)
   - Application → Service Workers → Unregister
3. Recarregue a página

---

### ❌ **Backend inicia mas não conecta ao banco**

**Problema**: Credenciais do Supabase incorretas

**Solução**:
1. Verifique a connection string no Supabase Dashboard:
   - Settings → Database → Connection String
2. Certifique-se de usar a string de **conexão direta** (não pooler)
3. Teste a conexão manualmente:
   ```bash
   psql "postgresql://user:pass@host:5432/postgres"
   ```

---

## 📦 Scripts Úteis

### Backend
```bash
npm run start:dev      # Desenvolvimento com hot reload
npm run build          # Build para produção
npm run start:prod     # Rodar versão de produção
npm run test           # Rodar testes
npm run migration:run  # Rodar migrations
```

### Frontend
```bash
npm run dev            # Desenvolvimento
npm run build          # Build para produção
npm run start          # Rodar build de produção
npm run lint           # Verificar lint
```

---

## 🗄️ Estrutura do Projeto

```
Filmes/
├── backend/                # API NestJS
│   ├── src/
│   │   ├── modules/       # Módulos da aplicação
│   │   ├── health/        # Health check
│   │   └── main.ts        # Entry point
│   └── .env               # Variáveis de ambiente
├── frontend/              # Next.js App
│   ├── src/
│   │   ├── app/           # Pages (App Router)
│   │   └── components/    # Componentes React
│   └── .env.local         # Variáveis de ambiente
└── scripts/               # Scripts auxiliares
```

---

## 🧪 Testando o Setup

1. **Verificar Health Check**:
   ```bash
   curl http://localhost:3001/health
   ```
   Deve retornar: `{"status":"ok",...}`

2. **Verificar Frontend**:
   - Acesse http://localhost:3000
   - Deve carregar sem erros no console

3. **Verificar API**:
   ```bash
   curl http://localhost:3001/api/v1/content/movies
   ```

---

## 📚 Documentação Adicional

- [Supabase Docs](https://supabase.com/docs)
- [NestJS Docs](https://docs.nestjs.com/)
- [Next.js Docs](https://nextjs.org/docs)
- [TypeORM Docs](https://typeorm.io/)

---

## 💡 Dicas de Desenvolvimento

1. **Use o VSCode** com as extensões:
   - ESLint
   - Prettier
   - TypeScript and JavaScript Language Features

2. **Mantenha os terminais abertos**: Backend e frontend devem rodar simultaneamente

3. **Hot Reload**: Ambos suportam hot reload - mudanças no código aplicam automaticamente

4. **Logs**: Verifique os logs dos terminais para debugar problemas

---

## 🆘 Suporte

Se encontrar problemas não listados aqui:

1. Verifique os logs do backend e frontend
2. Certifique-se de que todas as variáveis de ambiente estão configuradas
3. Limpe `node_modules` e reinstale:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

---

**🎬 Desenvolvido com ❤️ pela equipe Cine Vision**
