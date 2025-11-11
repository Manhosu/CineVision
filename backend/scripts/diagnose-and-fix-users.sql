-- ========================================
-- DIAGNÓSTICO DE USUÁRIOS SEM DADOS DO TELEGRAM
-- ========================================

-- 1. CONTAR USUÁRIOS COM/SEM TELEGRAM_ID
SELECT
  COUNT(*) as total_usuarios,
  COUNT(telegram_id) as usuarios_com_telegram,
  COUNT(*) - COUNT(telegram_id) as usuarios_sem_telegram,
  ROUND(100.0 * COUNT(telegram_id) / COUNT(*), 2) as percentual_com_telegram
FROM users;

-- 2. LISTAR USUÁRIOS SEM TELEGRAM_ID (primeiros 20)
SELECT
  id,
  name,
  email,
  telegram_id,
  telegram_username,
  created_at,
  CASE
    WHEN email LIKE 'telegram_%@cinevision.temp' THEN 'Criado pelo Telegram (mas sem ID??)'
    WHEN email LIKE '%@gmail.com' OR email LIKE '%@hotmail.com' THEN 'Email real (não Telegram)'
    ELSE 'Outro método'
  END as tipo_criacao
FROM users
WHERE telegram_id IS NULL
ORDER BY created_at DESC
LIMIT 20;

-- 3. LISTAR USUÁRIOS COM TELEGRAM_ID (para confirmar o formato correto)
SELECT
  id,
  name,
  email,
  telegram_id,
  telegram_username,
  created_at
FROM users
WHERE telegram_id IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;

-- 4. VERIFICAR SESSÕES ATIVAS E SEUS DADOS
SELECT
  s.session_id,
  s.user_id,
  s.user_name as sessao_nome,
  s.telegram_id as sessao_telegram_id,
  s.telegram_username as sessao_telegram_username,
  u.name as user_nome,
  u.telegram_id as user_telegram_id,
  u.telegram_username as user_telegram_username,
  s.last_activity,
  CASE
    WHEN u.telegram_id IS NULL THEN '⚠️ USUÁRIO SEM TELEGRAM_ID NA TABELA'
    WHEN s.telegram_id IS NULL THEN '⚠️ SESSÃO SEM TELEGRAM_ID'
    ELSE '✅ TUDO OK'
  END as status
FROM user_sessions s
LEFT JOIN users u ON s.user_id = u.id
WHERE s.status = 'online'
ORDER BY s.last_activity DESC
LIMIT 20;

-- ========================================
-- POSSÍVEIS SOLUÇÕES
-- ========================================

-- OPÇÃO 1: Se os usuários foram criados pelo Telegram mas o telegram_id não foi salvo
-- Procurar usuários com email telegram_XXX@cinevision.temp e extrair o ID

-- Ver quantos usuários têm esse padrão:
SELECT
  COUNT(*) as usuarios_telegram_sem_id,
  string_agg(id::text, ', ') as primeiros_ids
FROM users
WHERE email LIKE 'telegram_%@cinevision.temp'
  AND telegram_id IS NULL
LIMIT 10;

-- OPÇÃO 2: Atualizar telegram_id baseado no email (se foi criado pelo Telegram)
-- CUIDADO: Execute isso APENAS se os resultados acima mostrarem que faz sentido

/*
UPDATE users
SET telegram_id = substring(email from 'telegram_(\d+)@'),
    updated_at = NOW()
WHERE email LIKE 'telegram_%@cinevision.temp'
  AND telegram_id IS NULL;
*/

-- OPÇÃO 3: Usuários criados por email/senha nunca terão telegram_id
-- Isso é NORMAL e esperado. Eles aparecerão como "Visitante" até fazerem login pelo Telegram

-- ========================================
-- LIMPEZA DE SESSÕES ANTIGAS (FORÇAR REFRESH)
-- ========================================

-- Ver quantas sessões seriam limpas (mais de 1 minuto de inatividade)
SELECT COUNT(*) as sessoes_antigas
FROM user_sessions
WHERE last_activity < NOW() - INTERVAL '1 minute';

-- Limpar sessões antigas (EXECUTE APENAS SE NECESSÁRIO)
/*
DELETE FROM user_sessions
WHERE last_activity < NOW() - INTERVAL '1 minute';
*/
