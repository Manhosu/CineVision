-- =====================================================
-- CINE VISION - PRODUCTION SEED (NO MOCK DATA)
-- =====================================================
-- Este arquivo contém apenas dados essenciais para produção
-- Sem filmes de exemplo ou dados mockados
-- =====================================================

-- Insert default categories
INSERT INTO categories (id, name, slug, description, sort_order, is_active, created_at, updated_at) VALUES
('category-uuid-0000-0000-000000000001', 'Ação', 'acao', 'Filmes de ação e aventura', 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('category-uuid-0000-0000-000000000002', 'Drama', 'drama', 'Filmes dramáticos e emocionantes', 2, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('category-uuid-0000-0000-000000000003', 'Comédia', 'comedia', 'Filmes cômicos e divertidos', 3, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('category-uuid-0000-0000-000000000004', 'Terror', 'terror', 'Filmes de terror e suspense', 4, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('category-uuid-0000-0000-000000000005', 'Ficção Científica', 'ficcao-cientifica', 'Filmes de ficção científica e futurismo', 5, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('category-uuid-0000-0000-000000000006', 'Romance', 'romance', 'Filmes românticos', 6, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('category-uuid-0000-0000-000000000007', 'Aventura', 'aventura', 'Filmes de aventura', 7, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('category-uuid-0000-0000-000000000008', 'Animação', 'animacao', 'Filmes de animação', 8, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('category-uuid-0000-0000-000000000009', 'Documentário', 'documentario', 'Documentários e filmes educativos', 9, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('category-uuid-0000-0000-000000000010', 'Suspense', 'suspense', 'Filmes de suspense e mistério', 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (slug) DO NOTHING;

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
  'Production database seeded with essential data (no mock content)',
  '{"seed_version": "2.0.0", "tables_seeded": ["categories"], "mock_data": false}'::jsonb,
  CURRENT_TIMESTAMP
);

-- Update sequences if needed (PostgreSQL specific)
SELECT setval(pg_get_serial_sequence('categories', 'sort_order'), (SELECT MAX(sort_order) FROM categories));

COMMIT;
