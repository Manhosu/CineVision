-- Data migration: popula content_ids[] do carrossel "featured" com tudo que
-- estava marcado como is_featured=true. Roda apenas uma vez antes de remover
-- o checkbox "Destacar na página inicial" do form de criação/edição.
-- Idempotente: array_agg é ordenado por created_at DESC para manter previsibilidade.

UPDATE homepage_carousels
SET
  content_ids = COALESCE((
    SELECT array_agg(id ORDER BY created_at DESC)
    FROM content
    WHERE is_featured = true AND status = 'PUBLISHED'
  ), ARRAY[]::uuid[]),
  updated_at = NOW()
WHERE type = 'featured';
