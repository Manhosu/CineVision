-- Igor (15/07): LogoEditor com 4 slots. Detalhes (ContentHero) continua
-- usando logo_position + logo_scale (+_mobile). Hero carrossel (HeroBanner)
-- ganha _hero (+_mobile). NULL nas colunas hero → herda das colunas details.
--
-- Também amplia range do slider: 50-150 → 25-150 (logos altos/quadrados a
-- 50% em ContentHero desktop = 288px, extravasa h-40=160px).

ALTER TABLE content
  ADD COLUMN IF NOT EXISTS logo_position_hero        VARCHAR(20),
  ADD COLUMN IF NOT EXISTS logo_position_hero_mobile VARCHAR(20),
  ADD COLUMN IF NOT EXISTS logo_scale_hero           SMALLINT,
  ADD COLUMN IF NOT EXISTS logo_scale_hero_mobile    SMALLINT;

-- Novos ranges 25-150 (ADD IF NOT EXISTS via DO block pra ser idempotente)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'logo_scale_hero_range') THEN
    ALTER TABLE content
      ADD CONSTRAINT logo_scale_hero_range
      CHECK (logo_scale_hero IS NULL OR logo_scale_hero BETWEEN 25 AND 150);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'logo_scale_hero_mobile_range') THEN
    ALTER TABLE content
      ADD CONSTRAINT logo_scale_hero_mobile_range
      CHECK (logo_scale_hero_mobile IS NULL OR logo_scale_hero_mobile BETWEEN 25 AND 150);
  END IF;
END $$;

-- Amplia range das colunas existentes (details) pra bater com hero
ALTER TABLE content
  DROP CONSTRAINT IF EXISTS logo_scale_range,
  DROP CONSTRAINT IF EXISTS logo_scale_mobile_range;

ALTER TABLE content
  ADD CONSTRAINT logo_scale_range
  CHECK (logo_scale IS NULL OR logo_scale BETWEEN 25 AND 150);
ALTER TABLE content
  ADD CONSTRAINT logo_scale_mobile_range
  CHECK (logo_scale_mobile IS NULL OR logo_scale_mobile BETWEEN 25 AND 150);

COMMENT ON COLUMN content.logo_position_hero IS
  'Igor (15/07): posição do logo no HeroBanner (carrossel da home) desktop, formato "X% Y%". NULL herda logo_position (details).';
COMMENT ON COLUMN content.logo_position_hero_mobile IS
  'Igor (15/07): posição do logo no HeroBanner mobile. NULL herda logo_position_hero → logo_position_mobile → logo_position.';
COMMENT ON COLUMN content.logo_scale_hero IS
  'Igor (15/07): tamanho do logo no HeroBanner desktop (25-150). NULL herda logo_scale (details).';
COMMENT ON COLUMN content.logo_scale_hero_mobile IS
  'Igor (15/07): tamanho do logo no HeroBanner mobile (25-150). NULL herda logo_scale_hero → logo_scale_mobile → logo_scale.';
