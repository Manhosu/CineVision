-- Igor (16/05): suporte ao novo tipo de conteúdo "Novelinha" (minisséries
-- verticais estilo ReelShort). Aplicado em produção via script Node;
-- arquivo aqui é histórico.

-- 1. Permite o carrossel top10_novelinhas no CHECK de homepage_carousels.type.
ALTER TABLE homepage_carousels DROP CONSTRAINT IF EXISTS homepage_carousels_type_check;
ALTER TABLE homepage_carousels ADD CONSTRAINT homepage_carousels_type_check
  CHECK (type IN (
    'top10_films', 'top10_series', 'top10_novelinhas', 'releases',
    'featured', 'all_movies', 'all_series', 'category', 'manual'
  ));

-- 2. Permissão de funcionário pra criar novelinhas (igual can_add_movies/series).
ALTER TABLE employee_permissions
  ADD COLUMN IF NOT EXISTS can_add_novelinhas boolean DEFAULT false;

-- 3. Carrosséis novos na home:
--    - top10_novelinhas: auto-popula com content_type='novelinha' publicados
--    - novelinhas_maratona: manual, Igor cura os itens via /admin/homepage
INSERT INTO homepage_carousels (slug, type, title, content_ids, is_visible, display_order)
SELECT 'top10_novelinhas', 'top10_novelinhas', 'Brasil: Top Novelinhas Hoje 🔥',
       ARRAY[]::uuid[], true, 4
WHERE NOT EXISTS (SELECT 1 FROM homepage_carousels WHERE slug = 'top10_novelinhas');

INSERT INTO homepage_carousels (slug, type, title, content_ids, is_visible, display_order)
SELECT 'novelinhas_maratona', 'manual', 'Novelinhas pra Maratonar',
       ARRAY[]::uuid[], true, 7
WHERE NOT EXISTS (SELECT 1 FROM homepage_carousels WHERE slug = 'novelinhas_maratona');

-- 4. Reordena os carrosséis existentes pra acomodar os novos.
UPDATE homepage_carousels SET display_order = 5 WHERE slug = 'releases';
UPDATE homepage_carousels SET display_order = 6 WHERE slug = 'family';
UPDATE homepage_carousels SET display_order = 8 WHERE slug = 'all_movies';
UPDATE homepage_carousels SET display_order = 9 WHERE slug = 'all_series';
