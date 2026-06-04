-- Igor (04/06): pré-venda de conteúdos novos.
--   * content.is_presale: flag que ativa o modo pré-venda
--   * content.presale_price_cents: preço com desconto exclusivo da pré-venda
--   * content.presale_release_at: data prevista de liberação (UI mostra contador)
--   * content.presale_purchases_count: cache do total pré-comprado (incrementado
--     a cada compra, decrementado em refund — evita COUNT(*) em tempo real)
--   * purchases.is_presale_purchase: marca que a compra foi feita durante a
--     pré-venda do conteúdo (pra na hora de liberar, achar todo mundo que comprou)
--   * purchases.presale_released_at: timestamp de quando o conteúdo foi liberado
--     pra essa purchase específica (evita re-notificar e dá auditoria)

ALTER TABLE content
  ADD COLUMN IF NOT EXISTS is_presale BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS presale_price_cents INTEGER,
  ADD COLUMN IF NOT EXISTS presale_release_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS presale_purchases_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS is_presale_purchase BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS presale_released_at TIMESTAMPTZ;

-- Index pra acelerar a busca de compras de pré-venda na hora de liberar
-- (admin clica "Liberar e notificar todos" → query por content_id + flag).
CREATE INDEX IF NOT EXISTS idx_purchases_presale_pending
  ON purchases (content_id)
  WHERE is_presale_purchase = TRUE AND presale_released_at IS NULL;

COMMENT ON COLUMN content.is_presale IS
  'Igor (04/06): conteúdo em pré-venda. Preço usado vira presale_price_cents, badge "PRÉ-VENDA" aparece nos cards, e compras ficam aguardando liberação manual.';
COMMENT ON COLUMN purchases.is_presale_purchase IS
  'Igor (04/06): compra feita enquanto conteúdo estava em pré-venda. Quando admin libera, dispara notificação Telegram pra essa lista.';
