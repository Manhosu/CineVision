-- Script para verificar se os usuários têm dados do Telegram
-- Execute este script no Supabase SQL Editor

-- 1. Verificar quantos usuários têm telegram_id
SELECT
  COUNT(*) as total_users,
  COUNT(telegram_id) as users_with_telegram_id,
  COUNT(telegram_username) as users_with_telegram_username,
  COUNT(*) - COUNT(telegram_id) as users_without_telegram_id
FROM users;

-- 2. Listar usuários SEM telegram_id
SELECT
  id,
  name,
  email,
  telegram_id,
  telegram_username,
  created_at
FROM users
WHERE telegram_id IS NULL
ORDER BY created_at DESC
LIMIT 10;

-- 3. Listar usuários COM telegram_id (para confirmar o formato)
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

-- 4. Verificar sessões ativas e seus dados
SELECT
  s.session_id,
  s.user_id,
  s.user_name,
  s.telegram_id as session_telegram_id,
  s.telegram_username as session_telegram_username,
  u.telegram_id as user_table_telegram_id,
  u.telegram_username as user_table_telegram_username,
  s.last_activity
FROM user_sessions s
LEFT JOIN users u ON s.user_id = u.id
WHERE s.status = 'online'
ORDER BY s.last_activity DESC
LIMIT 10;
