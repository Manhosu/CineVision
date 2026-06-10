-- RPC: conta usuários únicos por telegram_chat_id entre os que têm bot_username rastreado.
-- Exclui os ~103k usuários antigos sem bot_username, que inflariam o número.
CREATE OR REPLACE FUNCTION count_unique_tracked_users()
RETURNS TABLE(count BIGINT)
LANGUAGE sql STABLE AS $$
  SELECT COUNT(DISTINCT telegram_chat_id) AS count
  FROM users
  WHERE bot_username IS NOT NULL
    AND bot_username != ''
    AND telegram_chat_id IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION count_unique_tracked_users() TO anon, authenticated, service_role;
