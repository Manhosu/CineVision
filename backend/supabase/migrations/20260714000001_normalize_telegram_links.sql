-- Igor (14/07): backfill dos telegram_group_link cadastrados sem https://
--
-- Bug reportado: cliente comprou "Todo Mundo em Pânico" → clicou "Assistir"
-- → link t.me/+QzRJMwb9tZM6MWQx (sem https://) → Chrome tentou tratar como
-- URL relativa/hostname → DNS_PROBE_FINISHED_NXDOMAIN → cliente sem acesso.
--
-- O admin backend já foi corrigido (normalizeTelegramLink no
-- admin-content-simple.service). Esse SQL corrige as linhas antigas que
-- já estavam gravadas errado.
--
-- Idempotente: só toca em linhas onde o link existe E não começa com
-- http:// / https:// / tg://.

UPDATE content
SET
  telegram_group_link = 'https://' || TRIM(telegram_group_link),
  updated_at = NOW()
WHERE
  telegram_group_link IS NOT NULL
  AND TRIM(telegram_group_link) <> ''
  AND TRIM(telegram_group_link) !~* '^(https?|tg)://';
