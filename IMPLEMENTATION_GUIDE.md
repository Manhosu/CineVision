# Guia de Implementação - Sistema de Autenticação e Dashboard CineVision

## ✅ Implementações Concluídas

### 1. **Sistema de Autenticação com Supabase**

#### Backend
- ✅ Migration criada para usuário admin (`20250103000001_add_admin_user.sql`)
  - Email: `adm@cinevision.com.br`
  - Senha: `Admin123`
  - Hash bcrypt: `$2b$12$RkZ492rLZOf4bkLDj61kyOtgJyvguKUHZnYmUSeYN60GU9IZ9a2vK`

#### Frontend
- ✅ Supabase SDK instalado (`@supabase/supabase-js@^2.58.0`)
- ✅ Arquivo de configuração criado (`frontend/src/lib/supabase.ts`)
- ✅ Hook `useAuth` atualizado com integração Supabase
  - Autenticação com Supabase Auth
  - Mapeamento automático de roles (admin/user)
  - Listeners de eventos de autenticação em tempo real
  - Compatibilidade com sistema JWT legado

### 2. **Página de Dashboard do Usuário**

Arquivo: `frontend/src/app/dashboard/page.tsx`

#### Funcionalidades:
- **Tab "Meus Filmes"**: Exibe catálogo de conteúdo adquirido
- **Tab "Histórico de Compras"**: Lista todas as transações com status
- **Tab "Minhas Solicitações"**: Mostra requests de filmes com atualizações em tempo real

#### Integrações:
- ✅ **Supabase Realtime** para atualização automática de solicitações
- ✅ **Integração com API** para buscar:
  - Conteúdo adquirido (via site e Telegram)
  - Histórico de compras
  - Solicitações de filmes

### 3. **Player de Vídeo Multilíngue**

Arquivo: `frontend/src/components/VideoPlayer/AudioSubtitleSelector.tsx`

#### Recursos:
- ✅ Seletor de faixas de áudio (dublado)
- ✅ Seletor de legendas (com opção de desativar)
- ✅ Interface intuitiva com tabs
- ✅ Detecção automática de idiomas
- ✅ Mapeamento de códigos de idioma para nomes (PT, EN, ES, etc.)

### 4. **Integração Telegram no Dashboard**

Arquivo: `frontend/src/components/Dashboard/TelegramContentSection.tsx`

#### Funcionalidades:
- ✅ Exibição de conteúdo adquirido via Telegram
- ✅ Link direto para abrir o bot do Telegram
- ✅ Informações de data de aquisição
- ✅ Visual consistente com o tema da plataforma

### 5. **Sincronização em Tempo Real**

- ✅ **Supabase Realtime** configurado no dashboard
- ✅ Atualização automática quando status de solicitação muda
- ✅ Notificações toast para feedback ao usuário
- ✅ Reconexão automática em caso de perda de conexão

## 📋 Configurações Necessárias

### 1. Variáveis de Ambiente

**Frontend** (`.env.local`):
```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SUPABASE_URL=https://szghyvnbmjlquznxhqum.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Backend** (`.env`):
```bash
SUPABASE_URL=https://szghyvnbmjlquznxhqum.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 2. Migrations do Banco de Dados

Execute as migrations na ordem:
```bash
# No Supabase SQL Editor ou via CLI
psql -h db.szghyvnbmjlquznxhqum.supabase.co -U postgres -d postgres -f backend/src/database/migrations/20250103000001_add_admin_user.sql
```

### 3. Configuração do Supabase Realtime

No dashboard do Supabase:
1. Vá em **Database** → **Publications**
2. Certifique-se de que a tabela `content_requests` está incluída na publicação `supabase_realtime`
3. Se necessário, crie uma nova publicação:
```sql
CREATE PUBLICATION supabase_realtime FOR TABLE content_requests;
```

## 🔄 Fluxos de Uso

### Login de Administrador

1. Acesse `http://localhost:3000/auth/login`
2. Email: `adm@cinevision.com.br`
3. Senha: `Admin123`
4. Redirecionamento automático para `/admin`

### Login de Usuário Regular

1. Acesse `http://localhost:3000/auth/login`
2. Insira email e senha cadastrados
3. Redirecionamento automático para `/dashboard`

### Cadastro de Novo Usuário

1. Acesse `http://localhost:3000/auth/register`
2. Preencha nome, email e senha
3. Sistema cria usuário no Supabase Auth e no backend
4. Redirecionamento para login

### Dashboard do Usuário

1. Após login, acesse `/dashboard`
2. **Tab "Meus Filmes"**:
   - Visualize filmes adquiridos
   - Clique para assistir
3. **Tab "Histórico de Compras"**:
   - Veja transações realizadas
   - Status: Pago, Pendente, Falhou
4. **Tab "Minhas Solicitações"**:
   - Acompanhe status de requests
   - Receba atualizações em tempo real
   - Veja respostas do admin

## 🎬 Reprodução de Vídeo Multilíngue

### Estrutura de Armazenamento no S3/Supabase Storage

```
content/
  ├── movie-id/
  │   ├── video.m3u8 (manifest principal)
  │   ├── audio/
  │   │   ├── pt-BR/ (Português Dublado)
  │   │   ├── en/ (Inglês Original)
  │   │   └── es/ (Espanhol)
  │   └── subtitles/
  │       ├── pt-BR.vtt
  │       ├── en.vtt
  │       └── es.vtt
```

### Como Usar o Seletor

1. Durante a reprodução, clique no ícone de legendas/áudio
2. Selecione a tab "Áudio" ou "Legendas"
3. Escolha o idioma desejado
4. A alteração é aplicada imediatamente

## 🔐 Segurança

### RLS (Row Level Security) no Supabase

Certifique-se de que as seguintes políticas estão ativas:

```sql
-- Usuários podem ver suas próprias compras
CREATE POLICY "Users can view own purchases"
ON purchases FOR SELECT
USING (auth.uid()::text = user_id::text);

-- Usuários podem ver suas próprias solicitações
CREATE POLICY "Users can view own requests"
ON content_requests FOR SELECT
USING (auth.uid()::text = user_id::text);

-- Usuários podem criar solicitações
CREATE POLICY "Users can create requests"
ON content_requests FOR INSERT
WITH CHECK (auth.uid()::text = user_id::text);
```

## 📱 Integração Telegram

### Endpoints Necessários

```typescript
// Backend precisa ter estes endpoints implementados:
GET /api/v1/purchases/telegram/:userId
GET /api/v1/telegram/bot-info
```

### Configuração do Bot

No `.env` do backend:
```bash
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_BOT_USERNAME=cinevision_bot
```

## 🧪 Testes

### Testar Autenticação

```bash
# Login admin
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"adm@cinevision.com.br","password":"Admin123"}'
```

### Testar Dashboard

1. Faça login como usuário
2. Verifique se `/dashboard` carrega
3. Teste navegação entre tabs
4. Verifique se Realtime está funcionando (abra em duas janelas e atualize uma solicitação no admin)

## 🚀 Deploy

### Frontend (Vercel/Netlify)

1. Configure variáveis de ambiente
2. Build:
```bash
cd frontend
npm run build
```

### Backend (Railway/Render)

1. Configure variáveis de ambiente do Supabase
2. Execute migrations
3. Inicie servidor:
```bash
cd backend
npm run start:prod
```

## 📊 Monitoramento

### Logs Importantes

- **Supabase Realtime**: Verifique conexões WebSocket no console do navegador
- **Autenticação**: Logs de login/logout em `localStorage`
- **API Calls**: Network tab do DevTools

### Métricas de Sucesso

- ✅ Taxa de login bem-sucedido > 95%
- ✅ Latência de atualização Realtime < 2s
- ✅ Tempo de carregamento do dashboard < 3s

## 🐛 Troubleshooting

### Problema: Usuário admin não consegue logar

**Solução**: Verifique se a migration foi executada:
```sql
SELECT * FROM users WHERE email = 'adm@cinevision.com.br';
```

### Problema: Realtime não atualiza

**Solução**:
1. Verifique se a publicação `supabase_realtime` existe
2. Confirme que o canal está subscrito no console
3. Verifique permissões RLS

### Problema: Vídeo não reproduz áudio/legenda

**Solução**:
1. Verifique estrutura de arquivos no S3
2. Confirme que o manifest HLS inclui as faixas
3. Teste com diferentes navegadores

## 📖 Documentação Adicional

- [Supabase Realtime](https://supabase.com/docs/guides/realtime)
- [Shaka Player](https://shaka-player-demo.appspot.com/docs/api/index.html)
- [AWS S3 Multipart Upload](https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpuoverview.html)
