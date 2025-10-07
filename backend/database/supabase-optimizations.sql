-- Otimizações do banco de dados para o projeto Cine Vision
-- Este script aplica todas as melhorias solicitadas

-- 1. Adicionar colunas de auditoria onde aplicável
ALTER TABLE "content" 
ADD COLUMN IF NOT EXISTS "created_by" UUID,
ADD COLUMN IF NOT EXISTS "updated_by" UUID;

ALTER TABLE "categories" 
ADD COLUMN IF NOT EXISTS "created_by" UUID,
ADD COLUMN IF NOT EXISTS "updated_by" UUID;

-- 2. Adicionar constraints NOT NULL onde apropriado (apenas se a coluna não tiver dados nulos)
-- Verificar e atualizar constraints conforme necessário

-- 3. Adicionar índices para buscas otimizadas
-- Índice para busca por título (case-insensitive)
CREATE INDEX IF NOT EXISTS "idx_content_title_search" ON "content" 
USING gin(to_tsvector('portuguese', title));

-- Índice para busca em descrição (full-text)
CREATE INDEX IF NOT EXISTS "idx_content_description_search" ON "content" 
USING gin(to_tsvector('portuguese', COALESCE(description, '')));

-- Índice composto para filtros comuns
CREATE INDEX IF NOT EXISTS "idx_content_status_type_created" ON "content" 
(status, type, created_at DESC);

-- Índice para busca por categorias
CREATE INDEX IF NOT EXISTS "idx_content_categories_content_id" ON "content_categories" 
(content_id);

CREATE INDEX IF NOT EXISTS "idx_content_categories_category_id" ON "content_categories" 
(category_id);

-- Índice para ordenação por popularidade
CREATE INDEX IF NOT EXISTS "idx_content_popularity" ON "content" 
(is_featured DESC, views_count DESC, purchases_count DESC);

-- 4. Índices para performance em queries comuns
CREATE INDEX IF NOT EXISTS "idx_content_release_year" ON "content" 
(release_year DESC) WHERE release_year IS NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_content_imdb_rating" ON "content" 
(imdb_rating DESC) WHERE imdb_rating IS NOT NULL;

-- 5. Índices para auditoria e logs
CREATE INDEX IF NOT EXISTS "idx_system_logs_entity_created" ON "system_logs" 
(entity_id, created_at DESC) WHERE entity_id IS NOT NULL;

-- 6. Adicionar constraints de validação
ALTER TABLE "content" 
ADD CONSTRAINT IF NOT EXISTS "chk_content_price_positive" 
CHECK (price_cents >= 0);

ALTER TABLE "content" 
ADD CONSTRAINT IF NOT EXISTS "chk_content_duration_positive" 
CHECK (duration_minutes IS NULL OR duration_minutes > 0);

ALTER TABLE "content" 
ADD CONSTRAINT IF NOT EXISTS "chk_content_release_year_valid" 
CHECK (release_year IS NULL OR (release_year >= 1900 AND release_year <= EXTRACT(YEAR FROM CURRENT_DATE) + 5));

ALTER TABLE "content" 
ADD CONSTRAINT IF NOT EXISTS "chk_content_imdb_rating_valid" 
CHECK (imdb_rating IS NULL OR (imdb_rating >= 0 AND imdb_rating <= 10));

-- 7. Adicionar foreign keys para auditoria (apenas se as tabelas existirem)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        ALTER TABLE "content" 
        ADD CONSTRAINT IF NOT EXISTS "fk_content_created_by" 
        FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL;

        ALTER TABLE "content" 
        ADD CONSTRAINT IF NOT EXISTS "fk_content_updated_by" 
        FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL;

        ALTER TABLE "categories" 
        ADD CONSTRAINT IF NOT EXISTS "fk_categories_created_by" 
        FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL;

        ALTER TABLE "categories" 
        ADD CONSTRAINT IF NOT EXISTS "fk_categories_updated_by" 
        FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL;
    END IF;
END $$;

-- 8. Criar função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 9. Criar triggers para updated_at (apenas se não existirem)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_content_updated_at') THEN
        CREATE TRIGGER update_content_updated_at 
        BEFORE UPDATE ON "content"
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_categories_updated_at') THEN
        CREATE TRIGGER update_categories_updated_at 
        BEFORE UPDATE ON "categories"
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- 10. Atualizar estatísticas das tabelas
ANALYZE content;
ANALYZE categories;
ANALYZE content_categories;

-- Log da aplicação das otimizações
INSERT INTO system_logs (id, type, level, message, meta, created_at)
VALUES (
    gen_random_uuid(),
    'database',
    'info',
    'Database optimizations applied successfully',
    jsonb_build_object(
        'optimizations', ARRAY[
            'audit_columns_added',
            'fulltext_indexes_created',
            'performance_indexes_added',
            'validation_constraints_added',
            'triggers_created'
        ],
        'timestamp', NOW()
    ),
    NOW()
) ON CONFLICT DO NOTHING;