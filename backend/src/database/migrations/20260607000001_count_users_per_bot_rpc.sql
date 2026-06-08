-- N30 (Igor 07/06): RPC para contar usuários por bot_username.
-- Usada no endpoint GET /admin/bots/user-stats para mostrar quantos
-- usuários iniciaram cada bot individualmente.

CREATE OR REPLACE FUNCTION count_users_per_bot()
RETURNS TABLE(bot_username TEXT, user_count BIGINT)
LANGUAGE sql
STABLE
AS $$
  SELECT
    bot_username,
    COUNT(*) AS user_count
  FROM users
  WHERE
    bot_username IS NOT NULL
    AND bot_username != ''
    AND telegram_chat_id IS NOT NULL
  GROUP BY bot_username
  ORDER BY user_count DESC;
$$;

GRANT EXECUTE ON FUNCTION count_users_per_bot() TO anon, authenticated, service_role;
