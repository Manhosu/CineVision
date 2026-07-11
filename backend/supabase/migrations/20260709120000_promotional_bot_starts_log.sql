-- Igor (09/07): analytics diário dos bots promocionais.
-- Sem log de starts com timestamp, não dá pra fazer "quantos deram /start
-- nas últimas 24h" ou "crescimento dia a dia". Antes só tinha o contador
-- total (promotional_start_count).

CREATE TABLE IF NOT EXISTS promotional_bot_starts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES telegram_bots(id) ON DELETE CASCADE,
  telegram_user_id BIGINT NOT NULL,
  telegram_chat_id BIGINT,
  is_first_start BOOLEAN NOT NULL DEFAULT FALSE,  -- true na primeira vez que esse user deu /start neste bot
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promo_starts_bot_created
  ON promotional_bot_starts (bot_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_promo_starts_bot_user
  ON promotional_bot_starts (bot_id, telegram_user_id);

COMMENT ON TABLE promotional_bot_starts IS
  'Igor (09/07): log de /start por bot promocional pra analytics diário/24h.';

-- RPC: métricas do bot promo (starts total, últimas 24h, últimos 7 dias, breakdown por dia)
CREATE OR REPLACE FUNCTION promotional_bot_metrics(p_bot_id UUID)
RETURNS JSONB
LANGUAGE SQL
STABLE
AS $$
  SELECT jsonb_build_object(
    'total_starts', (SELECT COUNT(*) FROM promotional_bot_starts WHERE bot_id = p_bot_id),
    'unique_users', (SELECT COUNT(DISTINCT telegram_user_id) FROM promotional_bot_starts WHERE bot_id = p_bot_id),
    'starts_24h',
      (SELECT COUNT(*) FROM promotional_bot_starts
       WHERE bot_id = p_bot_id AND created_at > NOW() - INTERVAL '24 hours'),
    'unique_users_24h',
      (SELECT COUNT(DISTINCT telegram_user_id) FROM promotional_bot_starts
       WHERE bot_id = p_bot_id AND created_at > NOW() - INTERVAL '24 hours'),
    'starts_7d',
      (SELECT COUNT(*) FROM promotional_bot_starts
       WHERE bot_id = p_bot_id AND created_at > NOW() - INTERVAL '7 days'),
    'first_starts_24h',
      (SELECT COUNT(*) FROM promotional_bot_starts
       WHERE bot_id = p_bot_id AND is_first_start = TRUE
       AND created_at > NOW() - INTERVAL '24 hours'),
    'daily',
      COALESCE((
        SELECT jsonb_agg(row_to_json(t) ORDER BY t.day DESC)
        FROM (
          SELECT
            date_trunc('day', created_at AT TIME ZONE 'America/Sao_Paulo')::DATE AS day,
            COUNT(*) AS starts,
            COUNT(DISTINCT telegram_user_id) AS unique_users,
            COUNT(*) FILTER (WHERE is_first_start) AS new_users
          FROM promotional_bot_starts
          WHERE bot_id = p_bot_id
            AND created_at > NOW() - INTERVAL '14 days'
          GROUP BY 1
        ) t
      ), '[]'::jsonb)
  );
$$;

COMMENT ON FUNCTION promotional_bot_metrics IS
  'Dashboard analytics do bot promocional: total, 24h, 7d, breakdown diário.';
