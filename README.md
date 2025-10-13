# Cine Vision - Plataforma de Streaming Integrada ao Telegram
## **Visão Geral**
O **Cine Vision** é uma plataforma de venda de filmes online, inspirada na
experiência da Netflix, mas com um diferencial: integração completa com o
**Telegram**. O objetivo é oferecer uma experiência intuitiva, rápida e
acessível para um público com pouca familiaridade com tecnologia e
dispositivos de baixa performance.
---
## **Funcionalidades Principais**
### ** Site (Vitrine + Streaming)**
- Home page inspirada na Netflix, com **banners**, **lançamentos** e
**categorias**.
- Sistema de **compra de filmes individuais** (não assinatura).
- **Integração Pix + Cartão** com liberação automática.
- Player próprio com **Chromecast e AirPlay**.
- Opção de **assistir online** ou **baixar via Telegram**.
- Aba de **Pedidos**, onde o cliente solicita filmes ou séries que deseja.
- Compatibilidade total com **smartphones antigos e conexões fracas**.
### ** Bot Telegram V2**
- Envio automático de confirmações de pagamento.
- Notificação de novos lançamentos.
- Login integrado com o site.
- Links diretos de compra.
- Downloads dos filmes mais antigos diretamente no grupo privado.
### ** Painel Administrativo (Web)**
- Controle total de **usuários**, **pagamentos**, **conteúdos**.
- Opção de **bloquear/ativar contas**.
- Atualizar chave Pix pelo painel.
- Métricas em tempo real (vendas, acessos, streaming).
---
## **Escalabilidade**
- 20k a 150k acessos mensais.
1
- Suporte de 50 a 120 usuários simultâneos no streaming.
- CDN com adaptive bitrate para streaming suave.
---
## **Tecnologias Utilizadas**
- **Front-end:** Next.js 14 (React)
- **Back-end:** NestJS (Node.js)
- **Banco de Dados:** Supabase (PostgreSQL)
- **Storage:** AWS S3 + CloudFront CDN
- **Bot:** Telegram Bot API com webhooks
- **Player:** Video.js
- **Pagamentos:** Stripe

---
## **🛠️ Ambiente de Desenvolvimento**

### **Pré-requisitos**
- Node.js 18+
- npm ou yarn
- Conta Supabase (gratuita)
- Conta AWS (S3 + CloudFront)

### **Instalação**
```bash
# 1. Clonar repositório
git clone <repo-url>

# 2. Instalar dependências (na raiz)
npm install

# 3. Configurar variáveis de ambiente
# Backend: backend/.env
# Frontend: frontend/.env.local

# 4. Rodar backend (porta 3001)
cd backend
npm run start:dev

# 5. Rodar frontend (porta 3000) - em outro terminal
cd frontend
npm run dev

# 6. Rodar bot (opcional, porta 3003) - em outro terminal
cd bot
npm run dev
```

### **Estrutura do Projeto**
```
/backend   - API NestJS (porta 3001)
/frontend  - Site Next.js (porta 3000) - inclui rotas /admin
/bot       - Bot Telegram (porta 3003)
/infra     - Scripts e configurações
```

**Nota**: Docker foi removido do projeto. O desenvolvimento é feito localmente com npm scripts.

---
## **🚀 Deploy para Produção**

### **Status da Integração**
✅ **Integração Completa Testada e Funcionando:**
- Frontend (Next.js) - http://localhost:3000
- Backend (NestJS) - http://localhost:3001  
- Bot (Telegram) - Todos os testes passaram
- Webhooks - Endpoints funcionando corretamente

### **Configuração Automática**
Execute o script de configuração para produção:
```bash
node setup-production.js
```

Este script irá:
- Coletar todas as variáveis de ambiente necessárias
- Gerar arquivo `.env.production` 
- Configurar webhook do Telegram automaticamente
- Validar todas as configurações

### **Validação Pós-Deploy**
Após o deploy, execute a validação:
```bash
node validate-production.js
```

Este script testa:
- Conectividade do frontend
- Health check do backend
- Todos os endpoints da API
- Configuração do webhook do Telegram
- Conexão com o database

### **Variáveis de Ambiente Obrigatórias**
```bash
# Segurança
JWT_SECRET=your-super-secret-jwt-key
JWT_REFRESH_SECRET=your-super-secret-refresh-key

# Telegram
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz

# Database (Supabase)
SUPABASE_URL=https://[PROJECT-ID].supabase.co
SUPABASE_ANON_KEY=[YOUR-ANON-KEY]
SUPABASE_SERVICE_ROLE_KEY=[YOUR-SERVICE-ROLE-KEY]

# Produção
NODE_ENV=production
BASE_URL=https://your-domain.com
```

### **Checklist de Deploy**
- [ ] Executar `setup-production.js`
- [ ] Deploy do backend com variáveis configuradas
- [ ] Deploy do frontend
- [ ] Deploy do bot
- [ ] Executar `validate-production.js`
- [ ] Configurar monitoramento
- [ ] Testes de carga

---
## **Fluxo do Usuário**
1. Usuário acessa site e navega pelo catálogo.
2. Seleciona um filme e é redirecionado para o **Telegram Bot**.
3. Realiza o pagamento via Pix ou cartão.
4. Bot valida pagamento e libera opções:
- **Assistir Online** (no site).
- **Baixar pelo Telegram**.
5. Caso filme desejado não esteja disponível, cliente pode solicitar via aba
**Pedidos**.
---
## **Links Atuais do Cliente**
- Grupo Telegram: [Cine Vision Filmes](https://t.me/CineVisionFilme)
- Bot Atual: [Cine Vision Bot](https://t.me/CineVisionApp_Bot?start=)
---
## **Público Alvo**
- Usuários com **baixa familiaridade com tecnologia**.
- **Dispositivos antigos** e **internet fraca**.
- Sistema precisa ser extremamente **leve e intuitivo**.
---
## **Resumo do Projeto**
- Vitrine moderna para atrair clientes.
- Telegram como centro das transações e downloads.
- Player robusto e otimizado.
- Painel administrativo completo, sem necessidade de editar backend
diretamente.

---

## 💰 **Tabela de Preços dos Filmes**

### **⚠️ ATENÇÃO - PREÇOS OFICIAIS**
**Os preços abaixo são OFICIAIS e foram definidos pelo proprietário do sistema.**
**NÃO alterar sem autorização expressa.**

| Filme | Preço (R$) | Centavos |
|-------|-----------|----------|
| 🎬 Quarteto Fantástico: Primeiros Passos (2025) | R$ 6,90 | 690 |
| 🎬 Invocação do Mal 4: O Último Ritual (2025) | R$ 7,20 | 720 |
| 🎬 Demon Slayer: Castelo Infinito (2025) | R$ 7,50 | 750 |
| 🎬 A Longa Marcha: Caminhe ou Morra (2025) | R$ 7,00 | 700 |
| 🎬 Superman (2025) | R$ 7,10 | 710 |
| 🎬 Como Treinar o Seu Dragão (2025) | R$ 6,98 | 698 |
| 🎬 Jurassic World: Recomeço (2025) | R$ 6,85 | 685 |
| 🎬 F1: O Filme (2025) | R$ 7,05 | 705 |
| 🎬 Lilo & Stitch (2025) | R$ 6,98 | 698 |
| 🎬 A Hora do Mal (2025) | R$ 6,95 | 695 |

### **Como Atualizar Preços**

**Script Automático:**
```bash
cd backend
node set-movie-prices.js
```

Este script:
- ✅ Aplica os preços oficiais definidos acima
- ✅ Atualiza apenas filmes que correspondem à lista
- ✅ Mantém integridade dos dados
- ✅ Gera relatório detalhado

**⚠️ IMPORTANTE:**
- Os preços são armazenados em **centavos** no banco de dados
- Exemplo: R$ 6,90 = 690 centavos
- Nunca edite os preços diretamente no banco sem usar o script
- Sempre documente alterações de preços neste README

### **Estrutura de Preços no Sistema**

```typescript
// Backend - Database (Supabase)
price_cents: number  // Valor em centavos (ex: 690)

// Frontend - Exibição
formatPrice(690) → "R$ 6,90"  // Conversão automática
```

---

## 🚀 **Como Rodar Localmente**

### **Pré-requisitos**
- **Docker & Docker Compose** instalados
- **Node.js 18+** (para desenvolvimento)
- **Git** para clonagem do repositório

### **Setup Rápido com Docker**

```bash
# 1. Clonar o repositório
git clone <repository-url>
cd Filmes

# 2. Copiar variáveis de ambiente
cp .env.example .env

# 3. Iniciar todos os serviços
npm run docker:dev
# ou manualmente:
# docker-compose up --build
```

### **Serviços Disponíveis**
- **API Backend:** http://localhost:3001
- **Admin Panel:** http://localhost:3002
- **Telegram Bot:** http://localhost:3003
- **PostgreSQL:** localhost:5432
- **Redis:** localhost:6379

### **Swagger API Documentation**
- **API Docs:** http://localhost:3001/api/docs
- **OpenAPI JSON:** http://localhost:3001/api/docs-json

### **Setup Manual (Desenvolvimento)**

```

### **Scripts Disponíveis**

```bash
# Desenvolvimento
npm run dev          # Todos os serviços em modo dev
npm run build        # Build de todos os projetos
npm run start        # Executar versão de produção

# Testes e Qualidade
npm run lint         # Linter em todos os projetos
npm run test         # Testes em todos os projetos

# Docker
npm run docker:dev   # Ambiente de desenvolvimento
npm run docker:prod  # Ambiente de produção

# Utilitários
npm run install:all  # Instalar deps de todos os projetos
npm run clean        # Limpeza de builds
```

### **Estrutura do Projeto**

```
/
├── backend/         # API NestJS + SUPABASE
├── admin/           # Admin Panel Next.js
├── bot/             # Telegram Bot Node.js
├── docs/            # Documentação Swagger
├── infra/           # Configurações de infraestrutura
├── public/          # Assets estáticos
└── docker-compose.yml
```

---