# 🚨 INSTRUÇÕES PARA DESABILITAR RLS MANUALMENTE

## Problema Identificado
- **RLS (Row Level Security)** está causando **recursão infinita** na tabela `users`
- Erro: `"infinite recursion detected in policy for relation 'users'"`
- Autenticação Supabase funciona, mas consultas à tabela `users` falham

## ✅ Status Atual
- [x] Admin registrado no Supabase Auth (`admin@cinevision.com`)
- [x] Admin inserido na tabela `users` com password_hash
- [x] Login direto funciona (bypassa tabela `users`)
- [x] Login original falha (consulta tabela `users` com RLS)

## 🔧 SOLUÇÃO TEMPORÁRIA: Desabilitar RLS

### Passo 1: Acessar Dashboard Supabase
1. Acesse: https://supabase.com/dashboard
2. Faça login na sua conta
3. Selecione o projeto **Cine Vision**

### Passo 2: Ir para SQL Editor
1. No menu lateral, clique em **SQL Editor**
2. Clique em **New Query**

### Passo 3: Executar Comando SQL
Cole e execute o seguinte comando:

```sql
-- Desabilitar RLS temporariamente na tabela users
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
```

### Passo 4: Verificar se RLS foi Desabilitado
Execute para confirmar:

```sql
-- Verificar status do RLS
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'users' AND schemaname = 'public';
```

**Resultado esperado:** `rowsecurity` deve ser `false`

## 🧪 TESTE APÓS DESABILITAR RLS

Após desabilitar o RLS, teste o endpoint de login original:

```bash
# PowerShell
Invoke-WebRequest -Uri "http://localhost:3001/api/v1/supabase-auth/login" -Method POST -Headers @{"Content-Type"="application/json"} -Body '{"email":"admin@cinevision.com","password":"admin123"}' | Select-Object StatusCode, Content
```

**Resultado esperado:** Login deve funcionar sem erro de RLS

## 🔄 SOLUÇÃO DEFINITIVA: Corrigir Políticas RLS

### Após confirmar que o login funciona sem RLS:

1. **Re-habilitar RLS:**
```sql
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
```

2. **Remover políticas problemáticas:**
```sql
-- Listar políticas existentes
SELECT * FROM pg_policies WHERE tablename = 'users';

-- Remover todas as políticas (substitua POLICY_NAME pelos nomes reais)
DROP POLICY IF EXISTS "POLICY_NAME" ON public.users;
```

3. **Criar políticas simples sem recursão:**
```sql
-- Política para usuários verem seus próprios dados
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT USING (auth.uid()::text = id::text);

-- Política para service role ter acesso total
CREATE POLICY "service_role_all" ON public.users
  FOR ALL USING (current_setting('role') = 'service_role');
```

## 📋 CHECKLIST DE VERIFICAÇÃO

- [ ] RLS desabilitado manualmente no dashboard
- [ ] Login original testado e funcionando
- [ ] RLS re-habilitado com políticas corretas
- [ ] Login testado novamente com RLS ativo
- [ ] Autenticação completa funcionando

## 🚨 IMPORTANTE

- **NÃO deixar RLS desabilitado em produção**
- Esta é uma solução temporária apenas para diagnóstico
- Sempre re-habilitar RLS com políticas corretas
- Testar todos os endpoints após re-habilitar RLS

## 📞 PRÓXIMOS PASSOS

1. Desabilitar RLS manualmente (instruções acima)
2. Testar autenticação
3. Implementar políticas RLS corretas
4. Re-habilitar RLS
5. Testar autenticação completa