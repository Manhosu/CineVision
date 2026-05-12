CREATE TABLE IF NOT EXISTS homepage_carousels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug varchar(100) UNIQUE NOT NULL,
  title varchar(200) NOT NULL,
  type varchar(50) NOT NULL CHECK (type IN ('top10_films','top10_series','releases','featured','all_movies','all_series','category','manual')),
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  content_ids uuid[] DEFAULT '{}',
  is_visible boolean NOT NULL DEFAULT true,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_homepage_carousels_order ON homepage_carousels(display_order);

INSERT INTO homepage_carousels (slug, title, type, display_order, is_visible) VALUES
  ('top10_films',  'Brasil: Top 10 em Filmes Hoje', 'top10_films',  1, true),
  ('top10_series', 'Brasil: Top 10 em Séries Hoje', 'top10_series', 2, true),
  ('releases',     'Lançamentos',                   'releases',     3, true),
  ('all_movies',   'Filmes',                        'all_movies',   4, true),
  ('all_series',   'Séries',                        'all_series',   5, true)
ON CONFLICT (slug) DO NOTHING;
