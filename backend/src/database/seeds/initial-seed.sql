-- =====================================================
-- CINE VISION - INITIAL DATA SEED
-- =====================================================

-- Insert admin user
INSERT INTO users (
  id,
  name,
  email,
  password,
  role,
  status,
  blocked,
  created_at,
  updated_at
) VALUES (
  'admin-user-uuid-0000-0000-000000000001',
  'Admin Cine Vision',
  'admin@cinevision.com',
  -- Password: admin123 (hashed with bcrypt)
  '$2b$10$MYNFRm0VZm9ChC2gT1qvG.SmJeTZo5HQD9nEP5NdnTKZG5StFiVjS',
  'admin',
  'active',
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
) ON CONFLICT (email) DO NOTHING;

-- Insert default categories
INSERT INTO categories (id, name, slug, description, sort_order, is_active, created_at, updated_at) VALUES
('category-uuid-0000-0000-000000000001', 'Ação', 'acao', 'Filmes de ação e aventura', 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('category-uuid-0000-0000-000000000002', 'Drama', 'drama', 'Filmes dramáticos e emocionantes', 2, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('category-uuid-0000-0000-000000000003', 'Comédia', 'comedia', 'Filmes cômicos e divertidos', 3, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('category-uuid-0000-0000-000000000004', 'Terror', 'terror', 'Filmes de terror e suspense', 4, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('category-uuid-0000-0000-000000000005', 'Documentário', 'documentario', 'Documentários e filmes educativos', 5, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (slug) DO NOTHING;

-- Insert sample content
INSERT INTO content (
  id,
  title,
  description,
  synopsis,
  price_cents,
  duration_minutes,
  release_year,
  director,
  cast,
  genres,
  imdb_rating,
  type,
  availability,
  status,
  is_featured,
  created_at,
  updated_at
) VALUES
(
  'content-uuid-0000-0000-000000000001',
  'Exemplo Ação Espetacular',
  'Um filme de ação cheio de aventura e adrenalina',
  'Quando o mundo está em perigo, apenas um herói pode salvá-lo. Uma jornada épica através de cenários incríveis e sequências de ação de tirar o fôlego.',
  899, -- R$ 8.99
  120,
  2023,
  'João Director',
  ARRAY['Ator Principal', 'Atriz Coadjuvante', 'Vilão Clássico'],
  ARRAY['Ação', 'Aventura'],
  8.5,
  'movie',
  'both',
  'published',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  'content-uuid-0000-0000-000000000002',
  'Drama Profundo',
  'Uma história tocante sobre família e superação',
  'Uma família enfrenta os desafios da vida moderna enquanto descobre os verdadeiros valores que os unem. Uma narrativa emocionante sobre amor, perda e esperança.',
  599, -- R$ 5.99
  105,
  2023,
  'Maria Diretora',
  ARRAY['Protagonista Dramático', 'Mãe de Família', 'Jovem Talento'],
  ARRAY['Drama', 'Família'],
  9.1,
  'movie',
  'site',
  'published',
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  'content-uuid-0000-0000-000000000003',
  'Comédia Hilária',
  'Diversão garantida para toda a família',
  'Situações cômicas e personagens carismáticos se encontram nesta comédia que promete arrancar gargalhadas do público. Uma história leve e divertida.',
  449, -- R$ 4.49
  95,
  2023,
  'Carlos Comédias',
  ARRAY['Comediante Principal', 'Parceiro Cômico', 'Atriz Hilária'],
  ARRAY['Comédia', 'Família'],
  7.8,
  'movie',
  'telegram',
  'published',
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT (id) DO NOTHING;

-- Link content with categories
INSERT INTO content_categories (content_id, category_id) VALUES
('content-uuid-0000-0000-000000000001', 'category-uuid-0000-0000-000000000001'), -- Ação
('content-uuid-0000-0000-000000000002', 'category-uuid-0000-0000-000000000002'), -- Drama
('content-uuid-0000-0000-000000000003', 'category-uuid-0000-0000-000000000003')  -- Comédia
ON CONFLICT (content_id, category_id) DO NOTHING;

-- Insert sample content request
INSERT INTO content_requests (
  id,
  user_id,
  requested_title,
  description,
  year,
  status,
  priority,
  vote_count,
  created_at,
  updated_at
) VALUES (
  'request-uuid-0000-0000-000000000001',
  NULL, -- Anonymous request
  'Filme Muito Aguardado 2024',
  'Muitos usuários estão pedindo este filme que foi lançado recentemente nos cinemas.',
  2024,
  'pending',
  'high',
  5,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
) ON CONFLICT (id) DO NOTHING;

-- Create system log entry for seed completion
INSERT INTO system_logs (
  type,
  level,
  message,
  meta,
  created_at
) VALUES (
  'system',
  'info',
  'Database seeded with initial data',
  '{"seed_version": "1.0.0", "tables_seeded": ["users", "categories", "content", "content_requests"]}'::jsonb,
  CURRENT_TIMESTAMP
);

-- Update sequences if needed (PostgreSQL specific)
SELECT setval(pg_get_serial_sequence('categories', 'sort_order'), (SELECT MAX(sort_order) FROM categories));

COMMIT;