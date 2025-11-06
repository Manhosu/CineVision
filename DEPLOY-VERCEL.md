# Deploy do Frontend na Vercel

## Status Atual
✅ Backend rodando no Render: `https://cinevisionn.onrender.com`
✅ Código com correções enviado para GitHub
✅ Build de produção testado e funcionando

## Passos para Deploy na Vercel

### 1. Acesse a Vercel
1. Vá para: https://vercel.com
2. Faça login com sua conta GitHub

### 2. Importe o Projeto
1. Clique em "Add New..." → "Project"
2. Selecione o repositório: `Manhosu/CineVision`
3. Clique em "Import"

### 3. Configure o Projeto
Na tela de configuração:

**Framework Preset:** Next.js (detectado automaticamente)

**Root Directory:** `frontend`
- IMPORTANTE: Clique em "Edit" e selecione a pasta `frontend`

**Build Command:** `npm run build` (já configurado)

**Output Directory:** `.next` (já configurado)

### 4. Adicione as Variáveis de Ambiente
Clique em "Environment Variables" e adicione:

```
NEXT_PUBLIC_API_URL=https://cinevisionn.onrender.com
NEXT_PUBLIC_SUPABASE_URL=https://szghyvnbmjlquznxhqum.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6Z2h5dm5ibWpscXV6bnhocXVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3NDk5OTksImV4cCI6MjA3NDMyNTk5OX0._VqIPIYTflB8j8bdShAqet5GGSgXeP1auh1Mj3mLfLs
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=cinevisionv2bot
```

**IMPORTANTE:** Adicione para todos os ambientes (Production, Preview, Development)

### 5. Deploy
1. Clique em "Deploy"
2. Aguarde o build completar (aproximadamente 2-3 minutos)
3. Quando finalizar, você receberá a URL do seu site (ex: `https://cinevision-xxx.vercel.app`)

### 6. Configurar Domínio Customizado (Opcional)
Se você tiver um domínio:
1. Vá em Settings → Domains
2. Adicione seu domínio
3. Configure os DNS conforme instruções da Vercel

## Verificação Pós-Deploy

Depois do deploy, teste:

1. **Acesse o painel admin:** `https://seu-dominio.vercel.app/admin/content/manage`
2. **Edite a série Wandinha**
3. **Verifique que os episódios mostram:**
   - S1E1: ✓ Vídeo carregado - Duração: 59 min
   - S1E2: ✓ Vídeo carregado - Duração: 49 min
   - S2E1: ✓ Vídeo carregado - Duração: 45 min

## Troubleshooting

### Build falhou?
- Verifique se selecionou a pasta `frontend` como Root Directory
- Verifique se todas as variáveis de ambiente foram adicionadas

### Erro 500 após deploy?
- Verifique os logs no Vercel Dashboard → Deployment → Function Logs
- Confirme que `NEXT_PUBLIC_API_URL` está apontando para `https://cinevisionn.onrender.com`

### Backend não responde?
- Verifique se o serviço no Render está ativo
- Acesse: https://dashboard.render.com

## Próximos Passos

Após o deploy bem-sucedido:
1. Configure CORS no backend para aceitar requisições do domínio Vercel
2. Atualize as URLs no Telegram Bot para apontar para o novo domínio
3. Configure SSL/HTTPS (Vercel já fornece automaticamente)

## Correções Aplicadas Neste Deploy

✅ Detecção de episódios com vídeos existentes (checa `storage_path` e `file_storage_key`)
✅ Conversão correta de duração (minutes → seconds)
✅ Build otimizado para produção
