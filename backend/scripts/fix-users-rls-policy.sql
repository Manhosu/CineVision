-- ========================================
-- FIX RLS POLICIES FOR USERS TABLE
-- ========================================
-- Permitir que usuários autenticados leiam seus próprios dados
-- Isso corrige o problema de sessões não mostrarem telegram_id

-- 1. Verificar se RLS está habilitado
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'users' AND schemaname = 'public';

-- 2. Listar policies existentes
SELECT * FROM pg_policies WHERE tablename = 'users';

-- 3. Remover policy antiga que pode estar bloqueando (se existir)
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "users_read_own" ON users;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON users;

-- 4. Criar policy correta: usuários autenticados podem ler seus próprios dados
CREATE POLICY "users_can_read_own_data"
ON users
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- 5. IMPORTANTE: Permitir que usuários autenticados leiam QUALQUER usuário
-- Isso é necessário para o analytics buscar dados de outros usuários nas sessões
CREATE POLICY "authenticated_users_can_read_all_users"
ON users
FOR SELECT
TO authenticated
USING (true);

-- 6. Verificar policies criadas
SELECT
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'users'
ORDER BY policyname;

-- 7. Teste: verificar se consegue ler dados
-- Execute este SELECT logado no Supabase Dashboard (deve retornar seus dados)
SELECT id, name, email, telegram_id, telegram_username
FROM users
WHERE telegram_id IS NOT NULL
LIMIT 5;
