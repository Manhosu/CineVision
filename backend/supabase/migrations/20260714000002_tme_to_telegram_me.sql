-- Igor (13/07/2026 noite): Telegram perdeu o domínio t.me (serverHold no
-- registrador). telegram.me continua funcionando. Migra em massa TODOS os
-- links armazenados. Idempotente — só toca linhas com "://t.me/".
--
-- Cobre 4 tabelas com URLs cadastradas:
--   1. content.telegram_group_link (~1377 rows, o principal)
--   2. content.telegram_chat_id (legado — se contém link em vez de Chat ID)
--   3. telegram_bots.promotional_target_url
--   4. broadcasts.button_url
--
-- SKIP (texto livre / regex-replace quebraria formato):
--   broadcasts.message_text, group_broadcast_messages.message_text,
--   telegram_bots.notes, system_logs.*, activity_events.metadata.

BEGIN;

-- 1) content.telegram_group_link — PRINCIPAL
--    Prefixa https:// se falta E converte host t.me → telegram.me.
--    Regex ancorado em '://' pra NUNCA tocar em 'telegram.me' já correto
--    (senão viraria 'telegramtelegram.me').
UPDATE content
SET
  telegram_group_link = regexp_replace(
    CASE
      WHEN TRIM(telegram_group_link) ~* '^(https?|tg)://' THEN TRIM(telegram_group_link)
      ELSE 'https://' || TRIM(telegram_group_link)
    END,
    '://t\.me/', '://telegram.me/', 'i'
  ),
  updated_at = NOW()
WHERE telegram_group_link IS NOT NULL
  AND TRIM(telegram_group_link) <> ''
  AND (
    telegram_group_link <> TRIM(telegram_group_link)
    OR TRIM(telegram_group_link) !~* '^(https?|tg)://'
    OR telegram_group_link ~* '://t\.me/'
  );

-- 2) content.telegram_chat_id — se contém link (não numérico), move pra group_link
UPDATE content
SET
  telegram_group_link = regexp_replace(
    COALESCE(
      NULLIF(TRIM(telegram_group_link), ''),
      CASE
        WHEN TRIM(telegram_chat_id) ~* '^(https?|tg)://' THEN TRIM(telegram_chat_id)
        ELSE 'https://' || TRIM(telegram_chat_id)
      END
    ),
    '://t\.me/', '://telegram.me/', 'i'
  ),
  telegram_chat_id = NULL,
  updated_at = NOW()
WHERE telegram_chat_id IS NOT NULL
  AND TRIM(telegram_chat_id) <> ''
  AND TRIM(telegram_chat_id) !~ '^-?\d{6,}$';

-- 3) telegram_bots.promotional_target_url
UPDATE telegram_bots
SET
  promotional_target_url = regexp_replace(
    CASE
      WHEN TRIM(promotional_target_url) ~* '^(https?|tg)://' THEN TRIM(promotional_target_url)
      ELSE 'https://' || TRIM(promotional_target_url)
    END,
    '://t\.me/', '://telegram.me/', 'i'
  ),
  updated_at = NOW()
WHERE promotional_target_url IS NOT NULL
  AND TRIM(promotional_target_url) <> ''
  AND (
    promotional_target_url <> TRIM(promotional_target_url)
    OR TRIM(promotional_target_url) !~* '^(https?|tg)://'
    OR promotional_target_url ~* '://t\.me/'
  );

-- 4) broadcasts.button_url
UPDATE broadcasts
SET button_url = regexp_replace(
    CASE
      WHEN TRIM(button_url) ~* '^(https?|tg)://' THEN TRIM(button_url)
      ELSE 'https://' || TRIM(button_url)
    END,
    '://t\.me/', '://telegram.me/', 'i'
  )
WHERE button_url IS NOT NULL
  AND TRIM(button_url) <> ''
  AND (
    button_url <> TRIM(button_url)
    OR TRIM(button_url) !~* '^(https?|tg)://'
    OR button_url ~* '://t\.me/'
  );

COMMIT;
