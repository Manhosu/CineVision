-- Igor (11/07): Top 10 sticky pós-reset semanal.
--
-- Bug reportado: quando o cron weekly-reset zera weekly_sales, todo
-- filme fica com 0 e o desempate cai em views_count DESC. Isso subia
-- filmes antigos com views histórico alto (ex: "Os Bons Companheiros"
-- que nunca foi vendido). Igor vê o dashboard com filmes aleatórios
-- por dias até novas compras substituírem.
--
-- Solução: snapshot da posição no top 10 anterior ANTES de zerar
-- weekly_sales. Queries de leitura usam previous_rank como desempate
-- PRIMÁRIO (antes de views_count), mantendo os últimos filmes do top
-- no lugar até nova venda substituir.

ALTER TABLE content
  ADD COLUMN IF NOT EXISTS previous_rank SMALLINT NULL;

CREATE INDEX IF NOT EXISTS idx_content_top10_composite
  ON content (content_type, status, weekly_sales DESC, previous_rank ASC NULLS LAST)
  WHERE status = 'PUBLISHED';

COMMENT ON COLUMN content.previous_rank IS
  'Igor (11/07): posição 1..10 do snapshot da semana anterior. NULL = fora do top 10. Repopulado pelo cron weekly-reset ANTES de zerar weekly_sales — vira desempate primário quando a semana nova começa e todos têm weekly_sales=0.';
