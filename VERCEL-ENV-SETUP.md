# Configuração de Variáveis de Ambiente na Vercel

## ⚠️ IMPORTANTE: Configure estas variáveis no Dashboard da Vercel

O arquivo `.env.production` NÃO é usado automaticamente pela Vercel. Você precisa configurar as variáveis manualmente no Dashboard.

## Passo a Passo:

1. **Acesse o Dashboard da Vercel:**
   - Vá para: https://vercel.com/dashboard
   - Clique no projeto: `filmes`

2. **Acesse as Configurações:**
   - Clique na aba **Settings**
   - No menu lateral, clique em **Environment Variables**

3. **Configure as seguintes variáveis:**

### Variáveis Obrigatórias:

```
NEXT_PUBLIC_API_URL=https://cinevisionn.onrender.com
```

### Variáveis Opcionais (mas recomendadas):

```
NEXT_PUBLIC_SUPABASE_URL=https://szghyvnbmjlquznxhqum.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6Z2h5dm5ibWpscXV6bnhocXVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3NDk5OTksImV4cCI6MjA3NDMyNTk5OX0._VqIPIYTflB8j8bdShAqet5GGSgXeP1auh1Mj3mLfLs
NEXT_PUBLIC_CDN_URL=https://dcscincghoovk.cloudfront.net
NEXT_PUBLIC_CAST_APP_ID=CC1AD845
NEXT_PUBLIC_CHROMECAST_APP_ID=CC1AD845
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_51SAyO2Fqief8GJtdwnt6e4pVwl8smDW8NUwQ7SYbbpVibfYlQHVKrl1ag7I9lkdOmVi2oYlsP9JBZyNMyQ3iYZsl00FnNM20fr
NODE_ENV=production
BASE_URL=https://filmes-two.vercel.app
```

## 4. **Ambiente:**

Para cada variável, selecione:
- ✅ **Production**
- ✅ **Preview** (opcional)
- ✅ **Development** (opcional)

## 5. **Redeploy:**

Após adicionar todas as variáveis:
1. Vá para a aba **Deployments**
2. Encontre o último deployment
3. Clique nos três pontos (**...**)
4. Clique em **Redeploy**
5. Marque a opção **"Use existing Build Cache"** (opcional, para deploy mais rápido)
6. Clique em **Redeploy**

## ✅ Verificação:

Após o deploy, acesse:
- https://filmes-two.vercel.app

E teste:
1. A página inicial deve mostrar os filmes
2. Ao clicar em um filme, a página de detalhes deve carregar sem erro 404
3. As imagens devem carregar do S3

## 🔧 Alternativa Rápida (CLI):

Se você tiver o Vercel CLI instalado:

```bash
# Instalar Vercel CLI (se não tiver)
npm install -g vercel

# Login
vercel login

# Navegar até o projeto frontend
cd frontend

# Adicionar variáveis de ambiente
vercel env add NEXT_PUBLIC_API_URL production
# Digite: https://cinevisionn.onrender.com

# Fazer redeploy
vercel --prod
```

## 📋 Checklist Final:

- [ ] Variável `NEXT_PUBLIC_API_URL` configurada na Vercel
- [ ] Redeploy feito na Vercel
- [ ] Backend rodando no Render (https://cinevisionn.onrender.com)
- [ ] Teste: página inicial carrega filmes
- [ ] Teste: página de detalhes funciona sem erro 404
- [ ] Teste: imagens carregam do S3

## 🎯 URLs do Sistema:

- **Frontend (Vercel):** https://filmes-two.vercel.app
- **Backend (Render):** https://cinevisionn.onrender.com
- **API Health Check:** https://cinevisionn.onrender.com/api/v1/status
- **API Movies:** https://cinevisionn.onrender.com/api/v1/content/movies
