-- Adiciona campo is_new_season para marcar séries com nova temporada lançada.
-- Idempotente: se já existir (criado direto pelo dashboard Supabase), não falha.

ALTER TABLE content ADD COLUMN IF NOT EXISTS is_new_season BOOLEAN DEFAULT false;

COMMENT ON COLUMN content.is_new_season IS
  'Marca séries que tiveram nova temporada lançada — exibido como badge "Nova Temp." no card.';

-- Índice para lookup rápido de séries em nova temporada
CREATE INDEX IF NOT EXISTS idx_content_new_season_status
  ON content(is_new_season, status) WHERE is_new_season = true;

-- Índice composto para o carrossel "Lançamentos" (mix de is_release + is_new_season)
CREATE INDEX IF NOT EXISTS idx_content_releases_or_new_season
  ON content(content_type, status, created_at DESC)
  WHERE (is_release = true OR is_new_season = true);
