-- ========================================
-- APPLY IS_RELEASE MIGRATION MANUALLY
-- ========================================
-- Este script adiciona a coluna is_release e registra as migrations
-- Execute no Supabase SQL Editor

-- 1. Verificar se a tabela migrations existe
CREATE TABLE IF NOT EXISTS migrations (
    id SERIAL PRIMARY KEY,
    timestamp bigint NOT NULL,
    name character varying NOT NULL
);

-- 2. Registrar migrations antigas como executadas (para evitar conflitos)
INSERT INTO migrations (timestamp, name) VALUES
    (1694000000001, 'CreateInitialTables1694000000001'),
    (1694000000002, 'AddTelegramFieldsToUser1694000000002'),
    (1700000000000, 'AddAdminFullAccessTrigger1700000000000'),
    (1735000000000, 'UpdatePurchasesAndPayments1735000000000'),
    (1736000000000, 'AddIsAdminAndTelegramChatIdToUser1736000000000'),
    (1760000000000, 'CreateContentRequestsTable1760000000000')
ON CONFLICT DO NOTHING;

-- 3. Adicionar coluna is_release se não existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'content' AND column_name = 'is_release'
    ) THEN
        ALTER TABLE content ADD COLUMN is_release BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Coluna is_release adicionada com sucesso!';
    ELSE
        RAISE NOTICE 'Coluna is_release já existe.';
    END IF;
END $$;

-- 4. Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_content_is_release
ON content(is_release)
WHERE is_release = TRUE AND status = 'PUBLISHED';

-- 5. Registrar a migration AddIsReleaseToContent como executada
INSERT INTO migrations (timestamp, name) VALUES
    (1762000000000, 'AddIsReleaseToContent1762000000000')
ON CONFLICT DO NOTHING;

-- 6. Verificar que tudo está correto
SELECT
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'content' AND column_name = 'is_release') as has_is_release_column,
    (SELECT COUNT(*) FROM migrations) as total_migrations;

-- 7. Listar todas as migrations registradas
SELECT * FROM migrations ORDER BY timestamp;
