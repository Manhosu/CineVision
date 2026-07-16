-- Eduardo (16/07): sinais de saúde reais pros bots. Antes healthcheckDeep
-- só olhava getMe:ok — que retorna 200 mesmo com bot bloqueado só no BR
-- (o Telegram valida token globalmente). Passamos a coletar também os
-- 3 sinais que getWebhookInfo entrega e a gente ignorava:
--   * pending_update_count: mensagens que Telegram acumulou sem entregar
--   * last_error_date + last_error_message: último erro no webhook
--
-- + 3 sinais operacionais:
--   * consecutive_getme_failures: contador — 3 seguidas = auto-quarantine
--   * last_failure_at + last_failure_reason: rastro humano do último problema
--   * last_update_received_at: fire-and-forget no /webhook/:id → prova viva
--     de que o Telegram tá entregando updates de verdade
--   * dead_alert_sent_at: anti-spam do alerta push pro admin
--   * auto_quarantined_at: marca quando a auto-quarantine rodou (idempotência)

ALTER TABLE telegram_bots
  ADD COLUMN IF NOT EXISTS consecutive_getme_failures INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_failure_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_failure_reason TEXT,
  ADD COLUMN IF NOT EXISTS webhook_pending_count INT,
  ADD COLUMN IF NOT EXISTS webhook_last_error_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS webhook_last_error_message TEXT,
  ADD COLUMN IF NOT EXISTS last_update_received_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dead_alert_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS auto_quarantined_at TIMESTAMPTZ;

-- Índice parcial pra query de rotação (só bots saudáveis).
CREATE INDEX IF NOT EXISTS idx_telegram_bots_healthy_attendance
  ON telegram_bots (attendance_weight DESC)
  WHERE status = 'active'
    AND is_promotional = false
    AND attendance_weight > 0
    AND consecutive_getme_failures < 3;

COMMENT ON COLUMN telegram_bots.consecutive_getme_failures IS
  'Eduardo (16/07): incrementa a cada healthcheckDeep que detecta bot morto (getMe fail, webhook mismatch, pending>100, error_date <10min). 3+ seguidas = auto-quarantine (attendance_weight=0). Reset em qualquer success.';
COMMENT ON COLUMN telegram_bots.webhook_pending_count IS
  'Eduardo (16/07): pending_update_count do getWebhookInfo. >100 é forte sinal de webhook broken.';
COMMENT ON COLUMN telegram_bots.last_update_received_at IS
  'Eduardo (16/07): tocado fire-and-forget em /webhook/:id (throttle 60s por bot). Prova viva de que Telegram entrega updates. NULL em bot sem tráfego há muito tempo.';
COMMENT ON COLUMN telegram_bots.auto_quarantined_at IS
  'Eduardo (16/07): marca quando auto-quarantine rodou. Impede re-notificação em cada cron.';

-- Atualiza RPC count_unique_tracked_users pra excluir bots dead da contagem.
-- Antes contava users grudados em bots banned_br/disabled inflando o total.
CREATE OR REPLACE FUNCTION count_unique_tracked_users()
RETURNS TABLE(count bigint) AS $$
  SELECT COUNT(DISTINCT u.telegram_chat_id)::bigint AS count
  FROM users u
  JOIN telegram_bots b ON b.username = u.bot_username
  WHERE u.bot_username IS NOT NULL
    AND u.telegram_chat_id IS NOT NULL
    AND b.status = 'active'
    AND COALESCE(b.consecutive_getme_failures, 0) < 3;
$$ LANGUAGE sql STABLE;
