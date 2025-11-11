-- Adicionar colunas telegram_id e telegram_username à tabela user_sessions
-- Execute este script no Supabase SQL Editor

-- 1. Adicionar colunas
ALTER TABLE user_sessions
ADD COLUMN IF NOT EXISTS telegram_id TEXT,
ADD COLUMN IF NOT EXISTS telegram_username TEXT;

-- 2. Criar índice para melhorar performance de buscas
CREATE INDEX IF NOT EXISTS idx_user_sessions_telegram_id ON user_sessions(telegram_id);

-- 3. Atualizar sessões ativas com dados da tabela users
UPDATE user_sessions
SET
  telegram_id = users.telegram_id,
  telegram_username = users.telegram_username
FROM users
WHERE user_sessions.user_id = users.id
  AND user_sessions.status = 'online'
  AND users.telegram_id IS NOT NULL;

-- 4. Verificar resultado
SELECT
  COUNT(*) as total_sessions,
  COUNT(telegram_id) as sessions_with_telegram,
  COUNT(*) - COUNT(telegram_id) as sessions_without_telegram
FROM user_sessions
WHERE status = 'online';

-- 5. Ver amostra de sessões atualizadas
SELECT
  session_id,
  user_name,
  telegram_id,
  telegram_username,
  status,
  last_activity
FROM user_sessions
WHERE status = 'online'
ORDER BY last_activity DESC
LIMIT 10;
