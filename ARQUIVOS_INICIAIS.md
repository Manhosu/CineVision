# Lista de Arquivos Iniciais - Cine Vision

## 📁 **Estrutura de Pastas Criadas**
```
/backend          ✅ API Node.js (Nest.js/Fastify)
/frontend         ✅ Site Next.js (React)
/admin            ✅ Painel administrativo
/bot              ✅ Bot Telegram V2
/player           ✅ Componente player customizado
/shared           ✅ Tipos TypeScript e utilitários compartilhados
/infra            ✅ Docker, CI/CD, deploy configs
/docs             ✅ Documentação técnica e APIs
/database         ✅ Migrations e schemas PostgreSQL
```

---

## 🗂️ **Arquivos por Pasta**

### `/backend` - API Node.js
```
backend/
├── src/
│   ├── app.module.ts
│   ├── main.ts
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── jwt.strategy.ts
│   │   └── guards/
│   ├── users/
│   │   ├── users.module.ts
│   │   ├── users.controller.ts
│   │   ├── users.service.ts
│   │   └── entities/user.entity.ts
│   ├── movies/
│   │   ├── movies.module.ts
│   │   ├── movies.controller.ts
│   │   ├── movies.service.ts
│   │   └── entities/movie.entity.ts
│   ├── payments/
│   │   ├── payments.module.ts
│   │   ├── payments.controller.ts
│   │   ├── payments.service.ts
│   │   └── entities/payment.entity.ts
│   ├── requests/
│   │   ├── requests.module.ts
│   │   ├── requests.controller.ts
│   │   ├── requests.service.ts
│   │   └── entities/request.entity.ts
│   ├── telegram/
│   │   ├── telegram.module.ts
│   │   ├── telegram.controller.ts
│   │   └── telegram.service.ts
│   ├── common/
│   │   ├── decorators/
│   │   ├── filters/
│   │   ├── guards/
│   │   ├── interceptors/
│   │   └── pipes/
│   └── config/
│       ├── database.config.ts
│       ├── jwt.config.ts
│       └── app.config.ts
├── package.json
├── tsconfig.json
├── nest-cli.json
├── .env.example
└── README.md
```

### `/frontend` - Site Next.js
```
frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── globals.css
│   │   ├── loading.tsx
│   │   ├── error.tsx
│   │   ├── not-found.tsx
│   │   ├── movie/
│   │   │   └── [id]/page.tsx
│   │   ├── category/
│   │   │   └── [slug]/page.tsx
│   │   ├── search/
│   │   │   └── page.tsx
│   │   ├── requests/
│   │   │   └── page.tsx
│   │   ├── player/
│   │   │   └── [id]/page.tsx
│   │   └── auth/
│   │       ├── login/page.tsx
│   │       └── register/page.tsx
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Modal.tsx
│   │   │   └── Loading.tsx
│   │   ├── layout/
│   │   │   ├── Header.tsx
│   │   │   ├── Footer.tsx
│   │   │   └── Navigation.tsx
│   │   ├── movie/
│   │   │   ├── MovieCard.tsx
│   │   │   ├── MovieCarousel.tsx
│   │   │   ├── MovieGrid.tsx
│   │   │   ├── MovieDetails.tsx
│   │   │   └── HeroBanner.tsx
│   │   └── forms/
│   │       ├── SearchForm.tsx
│   │       ├── RequestForm.tsx
│   │       └── ContactForm.tsx
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useMovies.ts
│   │   ├── useLocalStorage.ts
│   │   └── useDebounce.ts
│   ├── lib/
│   │   ├── api.ts
│   │   ├── auth.ts
│   │   ├── utils.ts
│   │   └── constants.ts
│   ├── styles/
│   │   ├── globals.css
│   │   ├── components.css
│   │   └── utilities.css
│   └── types/
│       ├── movie.ts
│       ├── user.ts
│       └── api.ts
├── public/
│   ├── icons/
│   ├── images/
│   └── manifest.json
├── package.json
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
└── README.md
```

### `/admin` - Painel Administrativo
```
admin/
├── src/
│   ├── pages/
│   │   ├── index.tsx
│   │   ├── dashboard.tsx
│   │   ├── users/
│   │   │   ├── index.tsx
│   │   │   └── [id].tsx
│   │   ├── movies/
│   │   │   ├── index.tsx
│   │   │   ├── create.tsx
│   │   │   └── [id]/edit.tsx
│   │   ├── payments/
│   │   │   └── index.tsx
│   │   ├── requests/
│   │   │   └── index.tsx
│   │   └── settings/
│   │       └── index.tsx
│   ├── components/
│   │   ├── Layout/
│   │   ├── Dashboard/
│   │   ├── Tables/
│   │   ├── Forms/
│   │   └── Charts/
│   ├── hooks/
│   ├── services/
│   ├── utils/
│   └── styles/
├── package.json
├── next.config.js
└── README.md
```

### `/bot` - Bot Telegram V2
```
bot/
├── src/
│   ├── index.ts
│   ├── bot.ts
│   ├── handlers/
│   │   ├── start.handler.ts
│   │   ├── payment.handler.ts
│   │   ├── download.handler.ts
│   │   └── login.handler.ts
│   ├── services/
│   │   ├── telegram.service.ts
│   │   ├── payment.service.ts
│   │   ├── user.service.ts
│   │   └── movie.service.ts
│   ├── middleware/
│   │   ├── auth.middleware.ts
│   │   └── logging.middleware.ts
│   ├── utils/
│   │   ├── keyboards.ts
│   │   ├── messages.ts
│   │   └── validators.ts
│   └── config/
│       └── bot.config.ts
├── package.json
├── tsconfig.json
└── README.md
```

### `/player` - Player Customizado
```
player/
├── src/
│   ├── index.ts
│   ├── Player.tsx
│   ├── components/
│   │   ├── Controls.tsx
│   │   ├── ProgressBar.tsx
│   │   ├── VolumeControl.tsx
│   │   ├── FullscreenButton.tsx
│   │   ├── CastButton.tsx
│   │   └── SettingsMenu.tsx
│   ├── hooks/
│   │   ├── usePlayer.ts
│   │   ├── useCast.ts
│   │   └── useKeyboardShortcuts.ts
│   ├── services/
│   │   ├── cast.service.ts
│   │   └── analytics.service.ts
│   ├── utils/
│   │   ├── video-utils.ts
│   │   └── device-detection.ts
│   └── styles/
│       └── player.css
├── package.json
├── rollup.config.js
└── README.md
```

### `/shared` - Tipos e Utilitários
```
shared/
├── src/
│   ├── types/
│   │   ├── user.types.ts
│   │   ├── movie.types.ts
│   │   ├── payment.types.ts
│   │   ├── api.types.ts
│   │   └── index.ts
│   ├── utils/
│   │   ├── validation.ts
│   │   ├── formatting.ts
│   │   ├── constants.ts
│   │   └── index.ts
│   ├── enums/
│   │   ├── user-roles.enum.ts
│   │   ├── payment-status.enum.ts
│   │   └── index.ts
│   └── interfaces/
│       ├── api-response.interface.ts
│       └── index.ts
├── package.json
├── tsconfig.json
└── README.md
```

### `/infra` - Infraestrutura
```
infra/
├── scripts/
│   ├── deploy.sh
│   ├── backup.sh
│   ├── migrate.sh
│   └── setup-env.sh
├── nginx/
│   ├── nginx.conf
│   └── ssl/
└── monitoring/
    ├── prometheus.yml
    └── grafana/
```

### `/docs` - Documentação
```
docs/
├── api/
│   ├── openapi.yaml
│   ├── endpoints.md
│   └── authentication.md
├── deployment/
│   ├── setup-guide.md
│   └── environment-variables.md
├── development/
│   ├── getting-started.md
│   ├── coding-standards.md
│   └── testing-guide.md
├── user-guides/
│   ├── admin-panel.md
│   ├── bot-commands.md
│   └── troubleshooting.md
├── architecture/
│   ├── system-overview.md
│   ├── database-schema.md
│   └── api-flow.md
└── README.md
```

### `/database` - Banco de Dados
```
database/
├── migrations/
│   ├── 001_create_users_table.sql
│   ├── 002_create_movies_table.sql
│   ├── 003_create_payments_table.sql
│   ├── 004_create_requests_table.sql
│   └── 005_create_indexes.sql
├── seeds/
│   ├── users.sql
│   ├── movies.sql
│   └── categories.sql
├── schemas/
│   ├── user.schema.sql
│   ├── movie.schema.sql
│   └── payment.schema.sql
├── procedures/
│   └── cleanup.sql
└── triggers/
    └── audit_logs.sql
```

---

## 📋 **Arquivos de Configuração Raiz**
```
/
├── .gitignore                    ✅ Git ignore rules
├── .env.example                  ✅ Environment variables template
├── README.md                     ✅ Project overview
├── CHECKLIST_GLOBAL.md           ✅ Global project checklist
├── DESIGN_BRIEF.md               ✅ Design system and guidelines
├── ARQUIVOS_INICIAIS.md          ✅ This file
├── package.json                  ✅ Root package.json (workspaces)
├── turbo.json                    ⏳ Turbo repo configuration
├── .github/                      ⏳ GitHub Actions workflows
│   └── workflows/
│       ├── ci.yml
│       └── deploy.yml
└── scripts/                      ⏳ Utility scripts
    ├── setup.sh
    ├── dev.sh
    └── build.sh
```

---

## 🚀 **Próximos Passos**

### **Ordem de Implementação Sugerida:**
1. **Setup inicial:** Docker, banco, variáveis ambiente
2. **Backend:** API base com autenticação
3. **Bot Telegram:** Integração básica
4. **Frontend:** Homepage e navegação
5. **Player:** Componente de vídeo
6. **Admin:** Painel básico
7. **Integrações:** Pagamentos e webhooks
8. **Testes:** E2E e performance
9. **Deploy:** Staging e produção

### **Comandos de Setup:**
```bash
# Instalar dependências
npm install

# Setup desenvolvimento
npm run setup:dev

# Rodar todos os serviços
npm run dev

# Build para produção
npm run build

# Deploy
npm run deploy:staging
```

---

## ✅ **Status Atual**
- ✅ Estrutura de pastas criada
- ✅ CHECKLIST_GLOBAL.md completo
- ✅ DESIGN_BRIEF.md com tokens de design
- ✅ Lista de arquivos iniciais documentada
- ⏳ Aguardando início da implementação

**Próximo passo:** Iniciar implementação seguindo o CHECKLIST_GLOBAL.md