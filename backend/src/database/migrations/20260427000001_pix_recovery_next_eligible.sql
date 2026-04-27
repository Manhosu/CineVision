-- ============================================================================
-- Migration: PIX Recovery — anti-abuse with randomized next-eligibility
-- Date: 2026-04-27
-- Replaces the simple cooldown_hours check with a per-user "next_eligible_at"
-- timestamp randomized between block_days_min and block_days_max (default 30-60
-- days). Clients can no longer predict when they'll be eligible for a recovery
-- discount, which prevents the "always wait to pay" abuse pattern.
-- ============================================================================

ALTER TABLE pix_recovery_history
  ADD COLUMN IF NOT EXISTS next_eligible_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_recovery_user_next_eligible
  ON pix_recovery_history(user_id, next_eligible_at DESC);

CREATE INDEX IF NOT EXISTS idx_recovery_chat_next_eligible
  ON pix_recovery_history(telegram_chat_id, next_eligible_at DESC);

-- Backfill existing rows: assume already past their cooldown so they don't
-- accidentally block users who paid before this migration ran.
UPDATE pix_recovery_history
SET next_eligible_at = COALESCE(next_eligible_at, offered_at + INTERVAL '30 days')
WHERE next_eligible_at IS NULL;

-- Seed new admin_settings keys (idempotent)
INSERT INTO admin_settings (key, value)
VALUES
  ('pix_recovery_block_days_min', '30'),
  ('pix_recovery_block_days_max', '60')
ON CONFLICT (key) DO NOTHING;

COMMENT ON COLUMN pix_recovery_history.next_eligible_at IS
  'Earliest timestamp at which this user can receive another recovery offer. Randomized within [block_days_min, block_days_max] window to prevent predictable abuse.';
