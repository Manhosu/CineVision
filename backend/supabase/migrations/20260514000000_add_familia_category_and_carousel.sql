-- Igor (13/05): adiciona o gênero/categoria "Família" e o carrossel
-- correspondente na home. Aplicado em produção via script Node antes do
-- commit; este arquivo serve de histórico/repo. Idempotente.

-- 1. Categoria Família (se não existir)
INSERT INTO categories (name, slug, description, sort_order, is_active)
VALUES ('Família', 'familia', 'Filmes e séries para assistir com a família', 100, true)
ON CONFLICT (name) DO UPDATE SET is_active = true;

-- 2. Reordena os carrosséis em display_order >= 4 (abre espaço pro novo)
--    Só roda se ainda não tiver o slug 'family' (idempotência).
DO $$
DECLARE
  family_cat_id uuid;
BEGIN
  SELECT id INTO family_cat_id FROM categories WHERE name = 'Família';

  IF NOT EXISTS (SELECT 1 FROM homepage_carousels WHERE slug = 'family') THEN
    UPDATE homepage_carousels
      SET display_order = display_order + 1
      WHERE display_order >= 4;

    INSERT INTO homepage_carousels (slug, type, title, category_id, content_ids, is_visible, display_order)
    VALUES (
      'family',
      'category',
      'Para assistir com a Família',
      family_cat_id,
      ARRAY[]::uuid[],
      true,
      4
    );
  END IF;

  -- 3. Bulk-link: tudo que já tinha 'Família' em genres[] vincula à categoria.
  --    PK composto (content_id, category_id) garante idempotência.
  INSERT INTO content_categories (content_id, category_id)
  SELECT c.id, family_cat_id
  FROM content c
  WHERE 'Família' = ANY(c.genres)
    AND c.status = 'PUBLISHED'
    AND NOT EXISTS (
      SELECT 1 FROM content_categories cc
      WHERE cc.content_id = c.id AND cc.category_id = family_cat_id
    );
END $$;
