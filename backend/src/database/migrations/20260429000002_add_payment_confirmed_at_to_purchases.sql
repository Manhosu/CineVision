-- ============================================================================
-- Add payment_confirmed_at to purchases
-- ============================================================================
-- A entidade TypeORM declara `payment_confirmed_at` (purchase.entity.ts) e
-- vários consumidores escrevem nessa coluna:
--   - stripe-webhook.service.ts (via TypeORM repo)
--   - oasyfy-webhook.controller.ts (via supabase.client)
--   - admin-manual-grant.controller.ts (via supabase.client)
-- Mas a coluna nunca tinha sido migrada pro Postgres. Isso quebrava o
-- INSERT do supabase.client com o erro "Could not find the
-- 'payment_confirmed_at' column ... in the schema cache" — bloqueando a
-- liberação manual de conteúdo para usuários que não pagaram (caso do
-- Igor liberando filme pra Yanna).
-- ============================================================================

ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS payment_confirmed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_purchases_payment_confirmed_at
  ON purchases(payment_confirmed_at)
  WHERE payment_confirmed_at IS NOT NULL;
