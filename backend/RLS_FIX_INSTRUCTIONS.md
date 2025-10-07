# Instruções para Corrigir Problema de RLS (Recursão Infinita)

## Problema Identificado
- **Código de Erro**: 42P17 - "infinite recursion detected in policy for relation 'users'"
- **Causa**: Políticas RLS na tabela `users` estão causando recursão infinita
- **Impacto**: Impossível fazer consultas à tabela `users` via REST API

## Status Atual
✅ **Autenticação Supabase funciona** (login direto sem consulta à tabela)
❌ **Consultas à tabela users falham** devido ao RLS

## Solução Temporária (URGENTE)

### 1. Desabilitar RLS no Dashboard Supabase
1. Acesse o dashboard do Supabase: https://supabase.com/dashboard
2. Vá para o projeto Cine Vision
3. Navegue para: **Authentication** > **Policies**
4. Encontre a tabela `users`
5. **Desabilite temporariamente o RLS** para a tabela `users`

### 2. Testar após desabilitar RLS
```bash
# Teste o login original (deve funcionar após desabilitar RLS)
Invoke-WebRequest -Uri "http://localhost:3001/api/v1/supabase-auth/login" -Method POST -ContentType "application/json" -Body '{"email":"admin@cinevision.com","password":"admin123"}'
```

## Solução Definitiva

### 3. Corrigir Políticas RLS
As políticas atuais provavelmente têm referências circulares. Políticas corretas:

```sql
-- Política para usuários verem apenas seus próprios dados
CREATE POLICY "users_select_own_data" ON users
FOR SELECT USING (auth.uid() = id);

-- Política para usuários atualizarem apenas seus próprios dados  
CREATE POLICY "users_update_own_data" ON users
FOR UPDATE USING (auth.uid() = id);

-- Política para admins terem acesso total (SEM RECURSÃO)
CREATE POLICY "admin_full_access_users" ON users
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND auth.users.email = 'admin@cinevision.com'
  )
);
```

### 4. Reabilitar RLS
1. Aplique as políticas corrigidas no SQL Editor do Supabase
2. Reabilite o RLS para a tabela `users`
3. Teste novamente o login

## Endpoints de Teste Disponíveis

- **Login Direto** (sem consulta à tabela): `POST /api/v1/supabase-auth/login-direct`
- **Login Original** (com consulta à tabela): `POST /api/v1/supabase-auth/login`
- **Registrar Admin**: `POST /api/v1/supabase-auth/register-admin`

## Credenciais de Teste
- **Email**: admin@cinevision.com
- **Senha**: admin123
- **ID do Usuário**: c5a93bb3-bd79-49d8-bbf4-f3806aa14210

## Próximos Passos
1. ⚠️ **URGENTE**: Desabilitar RLS no dashboard
2. Testar login original
3. Corrigir políticas RLS
4. Reabilitar RLS
5. Teste final completo