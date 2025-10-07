-- Script de teste de performance para verificar índices e otimizações
-- Execute este script após inserir os dados de teste

-- Habilitar timing para medir performance
\timing on

-- 1. Teste de busca por título (deve usar índice full-text)
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) 
SELECT id, title, price_cents, status 
FROM content 
WHERE title ILIKE '%movie%'
LIMIT 20;

-- 2. Teste de busca full-text em português
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT id, title, description, ts_rank(to_tsvector('portuguese', title), to_tsquery('portuguese', 'movie')) as rank
FROM content 
WHERE to_tsvector('portuguese', title) @@ to_tsquery('portuguese', 'movie')
ORDER BY rank DESC
LIMIT 20;

-- 3. Teste de filtro por status e tipo com ordenação (deve usar índice composto)
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT id, title, status, type, created_at
FROM content 
WHERE status = 'published' AND type = 'movie'
ORDER BY created_at DESC
LIMIT 20;

-- 4. Teste de busca por popularidade (deve usar índice de popularidade)
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT id, title, is_featured, views_count, purchases_count
FROM content 
WHERE is_featured = true
ORDER BY views_count DESC, purchases_count DESC
LIMIT 10;

-- 5. Teste de join com categorias (deve usar índices das foreign keys)
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT c.id, c.title, cat.name as category_name
FROM content c
JOIN content_categories cc ON c.id = cc.content_id
JOIN categories cat ON cc.category_id = cat.id
WHERE cat.is_active = true
LIMIT 50;

-- 6. Teste de busca por ano de lançamento (deve usar índice parcial)
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT id, title, release_year, imdb_rating
FROM content 
WHERE release_year BETWEEN 2020 AND 2024
ORDER BY imdb_rating DESC NULLS LAST
LIMIT 20;

-- 7. Teste de busca por rating IMDB (deve usar índice parcial)
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT id, title, imdb_rating, views_count
FROM content 
WHERE imdb_rating >= 8.0
ORDER BY imdb_rating DESC
LIMIT 15;

-- 8. Teste de busca em descrição (deve usar índice full-text)
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT id, title, description
FROM content 
WHERE to_tsvector('portuguese', COALESCE(description, '')) @@ to_tsquery('portuguese', 'test & movie')
LIMIT 20;

-- 9. Teste de contagem por status (deve ser rápido com índice)
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT status, COUNT(*) as total
FROM content 
GROUP BY status;

-- 10. Teste de busca complexa combinando múltiplos filtros
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT c.id, c.title, c.price_cents, c.imdb_rating, c.views_count
FROM content c
WHERE c.status = 'published' 
  AND c.type = 'movie'
  AND c.price_cents BETWEEN 1000 AND 3000
  AND c.imdb_rating >= 7.0
ORDER BY c.views_count DESC, c.imdb_rating DESC
LIMIT 25;

-- Estatísticas das tabelas
SELECT 
    schemaname,
    tablename,
    attname,
    n_distinct,
    correlation
FROM pg_stats 
WHERE tablename IN ('content', 'categories', 'content_categories')
ORDER BY tablename, attname;

-- Informações sobre índices
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename IN ('content', 'categories', 'content_categories')
ORDER BY tablename, indexname;

-- Tamanho das tabelas e índices
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) as index_size
FROM pg_tables 
WHERE tablename IN ('content', 'categories', 'content_categories')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Verificar uso dos índices
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_tup_read,
    idx_tup_fetch,
    idx_scan
FROM pg_stat_user_indexes 
WHERE schemaname = 'public' 
  AND tablename IN ('content', 'categories', 'content_categories')
ORDER BY idx_scan DESC;

-- Benchmark simples - medir tempo de queries comuns
DO $$
DECLARE
    start_time TIMESTAMP;
    end_time TIMESTAMP;
    duration INTERVAL;
BEGIN
    -- Teste 1: Busca simples por título
    start_time := clock_timestamp();
    PERFORM COUNT(*) FROM content WHERE title ILIKE '%movie%';
    end_time := clock_timestamp();
    duration := end_time - start_time;
    RAISE NOTICE 'Busca por título: %', duration;
    
    -- Teste 2: Filtro por status e ordenação
    start_time := clock_timestamp();
    PERFORM COUNT(*) FROM content WHERE status = 'published' ORDER BY created_at DESC LIMIT 100;
    end_time := clock_timestamp();
    duration := end_time - start_time;
    RAISE NOTICE 'Filtro por status com ordenação: %', duration;
    
    -- Teste 3: Join com categorias
    start_time := clock_timestamp();
    PERFORM COUNT(*) FROM content c JOIN content_categories cc ON c.id = cc.content_id LIMIT 100;
    end_time := clock_timestamp();
    duration := end_time - start_time;
    RAISE NOTICE 'Join com categorias: %', duration;
    
    -- Teste 4: Busca por popularidade
    start_time := clock_timestamp();
    PERFORM COUNT(*) FROM content WHERE is_featured = true ORDER BY views_count DESC LIMIT 50;
    end_time := clock_timestamp();
    duration := end_time - start_time;
    RAISE NOTICE 'Busca por popularidade: %', duration;
END $$;

-- Desabilitar timing
\timing off

-- Resumo final
SELECT 
    'Performance Test Completed' as status,
    NOW() as completed_at,
    (SELECT COUNT(*) FROM content) as total_content_records,
    (SELECT COUNT(*) FROM content_categories) as total_content_category_relations;