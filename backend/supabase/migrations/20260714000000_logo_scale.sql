-- Igor (14/07): Controle de tamanho do logo PNG no hero, separado por
-- breakpoint. Slider no LogoEditor grava 50-150. Runtime aplica como
-- style={{ width: `${scale}%` }} no <img> do logo (position: absolute
-- com left/top: X% Y%). NULL herda 100 (100%).

ALTER TABLE content
  ADD COLUMN IF NOT EXISTS logo_scale SMALLINT DEFAULT 100,
  ADD COLUMN IF NOT EXISTS logo_scale_mobile SMALLINT DEFAULT 100;

-- Ranges: 50-150 protegem contra valores loucos vindos do slider corrompido.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'logo_scale_range'
  ) THEN
    ALTER TABLE content
      ADD CONSTRAINT logo_scale_range
      CHECK (logo_scale IS NULL OR (logo_scale BETWEEN 50 AND 150));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'logo_scale_mobile_range'
  ) THEN
    ALTER TABLE content
      ADD CONSTRAINT logo_scale_mobile_range
      CHECK (logo_scale_mobile IS NULL OR (logo_scale_mobile BETWEEN 50 AND 150));
  END IF;
END $$;

COMMENT ON COLUMN content.logo_scale IS
  'Igor (14/07): tamanho do logo no hero desktop, % do container (50-150, default 100). Aplicado como width: X% no <img> absolutamente posicionado.';
COMMENT ON COLUMN content.logo_scale_mobile IS
  'Igor (14/07): tamanho do logo no hero mobile, % do container (50-150, default 100). Se NULL, herda logo_scale.';
