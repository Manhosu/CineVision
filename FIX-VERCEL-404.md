# Como Corrigir o Erro 404 nas Páginas de Detalhes dos Filmes

## Problema Identificado

Quando você acessa qualquer página de detalhes de filme no Vercel (exemplo: `https://cine-vision-murex.vercel.app/movies/cea7478d-abcd-4039-bb1b-b15839da4cfe`), recebe um erro 404.

**Causa Raiz:** A variável de ambiente `NEXT_PUBLIC_API_URL` não está configurada no Vercel, fazendo com que o build falhe ao tentar buscar os dados dos filmes.

## Solução: Configurar Variável de Ambiente no Vercel

### Passo 1: Acessar o Dashboard do Vercel

1. Acesse: https://vercel.com/dashboard
2. Faça login com sua conta
3. Selecione o projeto **cine-vision-murex**

### Passo 2: Adicionar a Variável de Ambiente

1. Clique em **Settings** (Configurações) no menu superior
2. No menu lateral esquerdo, clique em **Environment Variables**
3. Clique no botão **Add New**
4. Preencha os campos:
   - **Key (Nome):** `NEXT_PUBLIC_API_URL`
   - **Value (Valor):** `https://cinevisionn.onrender.com`
   - **Environments (Ambientes):** Selecione todos os três:
     - ☑️ Production
     - ☑️ Preview
     - ☑️ Development
5. Clique em **Save**

### Passo 3: Fazer Redeploy Manual

**IMPORTANTE:** Apenas adicionar a variável não é suficiente. Você precisa fazer um redeploy para que o build seja executado novamente com a variável configurada.

1. Volte para a página principal do projeto (clique em **Overview** no menu superior)
2. Na aba **Deployments**, encontre o deployment mais recente
3. Clique nos três pontos (⋯) ao lado do deployment
4. Selecione **Redeploy**
5. Na janela de confirmação, clique em **Redeploy** novamente

### Passo 4: Aguardar o Build

- O Vercel vai iniciar um novo build (~2-5 minutos)
- Você pode acompanhar o progresso na aba **Deployments**
- Aguarde até ver o status **Ready** com um ✓ verde

### Passo 5: Testar

Após o build finalizar, teste novamente:

1. Acesse: https://cine-vision-murex.vercel.app
2. Clique em qualquer card de filme
3. Verifique se a página de detalhes carrega corretamente
4. Teste com vários filmes diferentes

## Verificações Adicionais

### Verificar Backend Render

Certifique-se de que o backend no Render está funcionando:

```bash
curl https://cinevisionn.onrender.com/api/v1/content/movies/cea7478d-abcd-4039-bb1b-b15839da4cfe
```

Se retornar os dados do filme em JSON, o backend está OK.

### Verificar CORS no Render

O CORS já foi atualizado para aceitar requisições do Vercel. Se precisar verificar:

1. Acesse: https://dashboard.render.com
2. Selecione o serviço **cinevisionn**
3. Vá em **Environment**
4. Procure por `CORS_ORIGIN`
5. Deve conter: `https://cine-vision-murex.vercel.app,https://cine-vision-murex-git-main.vercel.app`

## Resumo das Alterações Feitas

### 1. Código Melhorado
- ✅ Adicionada validação para `NEXT_PUBLIC_API_URL` antes de fazer requisições
- ✅ Adicionado logging detalhado para depuração
- ✅ Adicionada configuração de cache para melhor performance SSR
- ✅ Commit feito e push para GitHub (já está no repositório)

### 2. CORS Atualizado
- ✅ Backend configurado para aceitar requisições do domínio Vercel
- ✅ Render vai reiniciar automaticamente (~2-3 minutos)

### 3. Ambiente de Produção
- ✅ Arquivo `.env.production` atualizado com URLs corretas
- ✅ Documentação criada em `VERCEL-ENV-SETUP.md`

## Ação Necessária

**Você precisa fazer apenas UMA coisa:**

👉 **Configurar `NEXT_PUBLIC_API_URL` no Vercel e fazer redeploy** (seguindo os passos acima)

Depois disso, tudo deve funcionar perfeitamente!

## Problemas?

Se após seguir todos os passos ainda houver erro 404:

1. Verifique se a variável foi salva corretamente no Vercel
2. Certifique-se de que fez o redeploy (não apenas salvou a variável)
3. Aguarde alguns minutos para o cache do Vercel invalidar
4. Teste em uma aba anônima do navegador
5. Verifique os logs do Vercel em **Deployments → [seu deployment] → Build Logs**

---

**Data:** 2025-10-13
**Status Backend:** ✅ Funcionando em https://cinevisionn.onrender.com
**Status Frontend:** ⏳ Aguardando configuração da variável de ambiente
