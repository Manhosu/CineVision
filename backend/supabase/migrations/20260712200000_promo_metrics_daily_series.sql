-- Igor (12/07): 2 correções pro dashboard de bots promocionais.
--
-- 1) promotional_bot_metrics: garante que `daily` retorna sempre 7 rows
--    (dias vazios com starts=0). Antes: só retornava dias com dados,
--    fazendo o gráfico do frontend degenerar numa barra gigante única.
--
-- 2) count_distinct_promo_users_active: contar DISTINCT telegram_user_id
--    em promotional_bot_starts pro breakdown do /admin/broadcast. Fonte
--    real de "quem já deu /start em bot promo" — bot_username pode estar
--    no oficial se cliente veio do oficial antes (semântica primeiro-bot-
--    ganha do upsertPromoUser).

CREATE OR REPLACE FUNCTION public.promotional_bot_metrics(p_bot_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_starts',     (SELECT COUNT(*) FROM promotional_bot_starts WHERE bot_id = p_bot_id),
    'unique_users',     (SELECT COUNT(DISTINCT telegram_user_id) FROM promotional_bot_starts WHERE bot_id = p_bot_id),
    'starts_24h',       (SELECT COUNT(*) FROM promotional_bot_starts WHERE bot_id = p_bot_id AND created_at > NOW() - INTERVAL '24 hours'),
    'unique_users_24h', (SELECT COUNT(DISTINCT telegram_user_id) FROM promotional_bot_starts WHERE bot_id = p_bot_id AND created_at > NOW() - INTERVAL '24 hours'),
    'starts_7d',        (SELECT COUNT(*) FROM promotional_bot_starts WHERE bot_id = p_bot_id AND created_at > NOW() - INTERVAL '7 days'),
    'first_starts_24h', (SELECT COUNT(*) FROM promotional_bot_starts WHERE bot_id = p_bot_id AND is_first_start AND created_at > NOW() - INTERVAL '24 hours'),
    'daily', (
      SELECT jsonb_agg(row_to_json(t) ORDER BY t.day DESC)
      FROM (
        SELECT
          d::DATE AS day,
          COALESCE(COUNT(s.id), 0) AS starts,
          COALESCE(COUNT(DISTINCT s.telegram_user_id), 0) AS unique_users,
          COALESCE(COUNT(*) FILTER (WHERE s.is_first_start), 0) AS new_users
        FROM generate_series(
          ((NOW() AT TIME ZONE 'America/Sao_Paulo')::DATE - INTERVAL '6 days')::DATE,
          (NOW() AT TIME ZONE 'America/Sao_Paulo')::DATE,
          INTERVAL '1 day'
        ) d
        LEFT JOIN promotional_bot_starts s
          ON s.bot_id = p_bot_id
         AND date_trunc('day', s.created_at AT TIME ZONE 'America/Sao_Paulo')::DATE = d::DATE
        GROUP BY d
      ) t
    )
  ) INTO result;
  RETURN result;
END;
$$;

COMMENT ON FUNCTION public.promotional_bot_metrics IS
  'Igor (12/07): métricas de bot promocional. daily agora usa generate_series pra retornar sempre 7 rows (dias vazios com starts=0), garantindo gráfico consistente no frontend.';

CREATE OR REPLACE FUNCTION public.count_distinct_promo_users_active()
RETURNS BIGINT
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT COUNT(DISTINCT s.telegram_user_id)::BIGINT
  FROM promotional_bot_starts s
  JOIN telegram_bots b ON b.id = s.bot_id
  WHERE b.is_promotional = TRUE AND b.status = 'active';
$$;

COMMENT ON FUNCTION public.count_distinct_promo_users_active IS
  'Igor (12/07): número de usuários únicos que deram /start em bots promocionais ATIVOS. Usado pelo /admin/broadcast/users-breakdown pra contar "promocionais" corretamente mesmo quando o user já tinha bot_username oficial preservado.';
