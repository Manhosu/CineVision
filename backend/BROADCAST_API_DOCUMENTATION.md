# 📢 Broadcast API - Documentação Completa

## Visão Geral

O endpoint de broadcast permite que administradores enviem mensagens personalizadas para IDs específicos de usuários do Telegram que iniciaram conversa com o bot.

## ✅ Status da Implementação

**Todos os testes passaram com sucesso!** ✨

- ✅ Conexão com Supabase
- ✅ Tabela `broadcasts` criada e acessível
- ✅ Bot do Telegram online (@cinevisionv2bot)
- ✅ 4 usuários com telegram_chat_id disponíveis
- ✅ AWS S3 configurado para upload de imagens

---

## 🔧 Correções Realizadas

### 1. **Prefixo de Rota Duplicado** ❌ → ✅
- **Problema**: Controller tinha `@Controller('api/v1/admin/broadcast')` quando o main.ts já define `api/v1` globalmente
- **Solução**: Alterado para `@Controller('admin/broadcast')`
- **Arquivo**: `backend/src/modules/admin/controllers/broadcast.controller.ts:22`

### 2. **Opção "Todos os Usuários" Removida** 🔒
- **Problema**: Sistema permitia enviar para todos os usuários
- **Solução**: Agora é **obrigatório** especificar `telegram_ids`
- **Arquivos Modificados**:
  - `backend/src/modules/admin/dto/broadcast.dto.ts` - tornado obrigatório
  - `backend/src/modules/admin/services/broadcast.service.ts` - validação adicionada
  - `frontend/src/app/admin/broadcast/page.tsx` - UI simplificada

### 3. **Nome da Seção** ✏️
- **De**: "Notificações em Massa"
- **Para**: "Marketing"
- **Arquivos**:
  - `frontend/src/app/admin/page.tsx:183`
  - `frontend/src/app/admin/broadcast/page.tsx:272`

---

## 📡 Endpoints Disponíveis

### Base URL
```
Production: https://cinevisionn.onrender.com
Development: http://localhost:3001
```

### 1. Upload de Imagem
```http
POST /api/v1/admin/broadcast/upload-image
```

**Headers:**
```
Authorization: Bearer {access_token}
Content-Type: multipart/form-data
```

**Body (FormData):**
```
image: File (PNG, JPG, WebP - Max 5MB)
```

**Response:**
```json
{
  "success": true,
  "image_url": "https://cinevision-cover.s3.us-east-1.amazonaws.com/..."
}
```

---

### 2. Enviar Broadcast
```http
POST /api/v1/admin/broadcast/send
```

**Headers:**
```
Authorization: Bearer {access_token}
Content-Type: application/json
```

**Body:**
```json
{
  "telegram_ids": ["5212925997", "1134910998"],
  "message_text": "🎬 Novos filmes adicionados! Confira agora.",
  "image_url": "https://cinevision-cover.s3.amazonaws.com/...",
  "button_text": "Acessar Site",
  "button_url": "https://cine-vision-murex.vercel.app"
}
```

**Campos:**
- `telegram_ids` (obrigatório): Array de Telegram IDs
- `message_text` (obrigatório): Texto da mensagem (suporta Markdown, max 4000 caracteres)
- `image_url` (opcional): URL da imagem
- `button_text` (opcional): Texto do botão
- `button_url` (opcional): URL do botão

**Response:**
```json
{
  "success": true,
  "message": "Broadcast enviado com sucesso",
  "total_users": 2,
  "successful_sends": 2,
  "failed_sends": 0,
  "broadcast_id": "uuid-aqui"
}
```

---

### 3. Histórico de Broadcasts
```http
GET /api/v1/admin/broadcast/history?limit=20
```

**Headers:**
```
Authorization: Bearer {access_token}
```

**Query Params:**
- `limit` (opcional): Número de registros (padrão: 20)

**Response:**
```json
{
  "success": true,
  "broadcasts": [
    {
      "id": "uuid",
      "message_text": "Mensagem enviada",
      "image_url": "https://...",
      "button_text": "Acessar",
      "button_url": "https://...",
      "recipients_count": 5,
      "sent_at": "2025-01-30T12:00:00Z"
    }
  ]
}
```

---

### 4. Contagem de Usuários
```http
GET /api/v1/admin/broadcast/users-count
```

**Headers:**
```
Authorization: Bearer {access_token}
```

**Response:**
```json
{
  "success": true,
  "total_users": 4
}
```

---

## 🗄️ Estrutura do Banco de Dados

### Tabela: `broadcasts`

```sql
CREATE TABLE broadcasts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_text TEXT NOT NULL,
  image_url TEXT,
  video_url TEXT,
  button_text VARCHAR(100),
  button_url TEXT,
  recipients_count INTEGER DEFAULT 0,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Índices:**
- `idx_broadcasts_admin_id` - Busca rápida por admin
- `idx_broadcasts_sent_at` - Ordenação por data

**RLS (Row Level Security):**
- Apenas admins podem criar/ler broadcasts

---

## 🔐 Autenticação

Todos os endpoints requerem:
1. **JWT Token válido** no header `Authorization: Bearer {token}`
2. **Role de Admin** - O usuário deve ter `role = 'admin'`

---

## 🤖 Integração com Telegram

### Bot Information
- **Nome**: CineVision V2
- **Username**: @cinevisionv2bot
- **ID**: 8284657866

### Como Funciona
1. O serviço busca usuários no Supabase usando os `telegram_ids` fornecidos
2. Filtra apenas usuários com `telegram_chat_id` (que iniciaram conversa com o bot)
3. Envia mensagens via API do Telegram com rate limiting (25 msg/segundo)
4. Suporta:
   - ✅ Texto (Markdown)
   - ✅ Imagens
   - ✅ Botões inline
   - ✅ Rate limiting automático

---

## 📝 Exemplos de Uso

### Exemplo 1: Mensagem Simples
```bash
curl -X POST https://cinevisionn.onrender.com/api/v1/admin/broadcast/send \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "telegram_ids": ["5212925997"],
    "message_text": "Olá! Temos novidades para você."
  }'
```

### Exemplo 2: Mensagem com Imagem e Botão
```bash
curl -X POST https://cinevisionn.onrender.com/api/v1/admin/broadcast/send \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "telegram_ids": ["5212925997", "1134910998"],
    "message_text": "🎬 **Novos Filmes Adicionados!**\n\nConfira agora os lançamentos da semana.",
    "image_url": "https://cinevision-cover.s3.us-east-1.amazonaws.com/cover-123.jpg",
    "button_text": "Ver Filmes",
    "button_url": "https://cine-vision-murex.vercel.app"
  }'
```

### Exemplo 3: Upload de Imagem + Envio
```javascript
// 1. Upload da imagem
const formData = new FormData();
formData.append('image', imageFile);

const uploadResponse = await fetch(
  'https://cinevisionn.onrender.com/api/v1/admin/broadcast/upload-image',
  {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData
  }
);

const { image_url } = await uploadResponse.json();

// 2. Enviar broadcast com a imagem
const sendResponse = await fetch(
  'https://cinevisionn.onrender.com/api/v1/admin/broadcast/send',
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      telegram_ids: ['5212925997'],
      message_text: 'Confira esta novidade!',
      image_url: image_url,
      button_text: 'Acessar',
      button_url: 'https://cine-vision-murex.vercel.app'
    })
  }
);
```

---

## 🧪 Teste da Integração

Execute o script de teste para validar toda a integração:

```bash
cd backend
node test-broadcast-integration.js
```

**O que é testado:**
- ✅ Conexão com Supabase
- ✅ Existência da tabela `broadcasts`
- ✅ Conexão com bot do Telegram
- ✅ Usuários com telegram_chat_id
- ✅ Configuração AWS S3

---

## ⚠️ Validações e Erros

### Validações de Input
- `telegram_ids`: Obrigatório, deve ser array de strings
- `message_text`: Obrigatório, min 1 caractere, max 4000 caracteres
- `image_url`: Opcional, deve ser URL válida
- `button_text`: Opcional, max 100 caracteres
- `button_url`: Opcional, deve ser URL válida

### Erros Comuns

**400 Bad Request**
```json
{
  "statusCode": 400,
  "message": "telegram_ids é obrigatório e deve conter pelo menos um ID"
}
```

**404 Not Found**
```json
{
  "statusCode": 404,
  "message": "Nenhum usuário encontrado com os IDs fornecidos. Certifique-se de que os usuários iniciaram conversa com o bot."
}
```

**401 Unauthorized**
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

**403 Forbidden**
```json
{
  "statusCode": 403,
  "message": "Forbidden resource"
}
```

---

## 🎨 Interface do Admin

Acesse: `/admin/broadcast`

**Funcionalidades:**
- 📝 Compor mensagem com Markdown
- 🖼️ Upload de imagem (drag & drop)
- 🔘 Configurar botão com link
- 📋 Listar Telegram IDs (separados por vírgula)
- 📊 Ver histórico de broadcasts
- 👥 Ver contagem de usuários disponíveis

---

## 🔄 Rate Limiting

O serviço implementa rate limiting automático:
- **25 mensagens por segundo** (limite do Telegram: 30/s)
- **~40ms de delay** entre cada mensagem
- Previne bloqueio do bot pelo Telegram

---

## 📌 Variáveis de Ambiente Necessárias

```env
# Supabase
SUPABASE_URL=https://szghyvnbmjlquznxhqum.supabase.co
SUPABASE_SERVICE_ROLE_KEY=seu-service-role-key

# Telegram
TELEGRAM_BOT_TOKEN=8284657866:AAFZ9KhQ3wgr7ms5KJWpNk-8QnrnlIJHcKM

# AWS S3 (para imagens)
AWS_ACCESS_KEY_ID=sua-access-key
AWS_SECRET_ACCESS_KEY=sua-secret-key
AWS_REGION=us-east-1
S3_COVER_BUCKET=cinevision-cover
```

---

## 🚀 Deploy

O serviço está rodando em:
- **Backend**: https://cinevisionn.onrender.com
- **Frontend**: https://cine-vision-murex.vercel.app

**Status**: ✅ Online e funcional

---

## 📞 Suporte

Para problemas ou dúvidas:
1. Verifique os logs no Render Dashboard
2. Execute o script de teste: `node test-broadcast-integration.js`
3. Verifique as variáveis de ambiente no Render

---

**Última atualização**: 30/01/2025
**Versão**: 1.0.0
**Status**: ✅ Produção
