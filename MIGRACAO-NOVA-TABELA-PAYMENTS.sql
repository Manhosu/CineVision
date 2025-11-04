-- ============================================================
-- MIGRAÇÃO: Nova Tabela Payments (Schema Atualizado)
-- Data: 2025-11-04
-- Descrição: Renomeia tabela antiga e cria nova com schema correto
-- ============================================================

-- Passo 1: Verificar se há dados na tabela antiga
DO $$
DECLARE
    row_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO row_count FROM payments;

    IF row_count > 0 THEN
        RAISE NOTICE '⚠️  Tabela payments tem % registros', row_count;
        RAISE NOTICE 'Renomeando para payments_old para backup...';

        -- Renomear tabela antiga para backup
        ALTER TABLE IF EXISTS payments RENAME TO payments_old;
        RAISE NOTICE '✅ Tabela antiga renomeada para payments_old';
    ELSE
        RAISE NOTICE 'Tabela payments está vazia, será dropada...';
        DROP TABLE IF EXISTS payments CASCADE;
        RAISE NOTICE '✅ Tabela vazia removida';
    END IF;
EXCEPTION
    WHEN undefined_table THEN
        RAISE NOTICE 'Tabela payments não existe, criando do zero...';
END$$;

-- Passo 2: Criar ENUMs necessários
DO $$
BEGIN
    -- Criar payment_provider_enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_provider_enum') THEN
        CREATE TYPE payment_provider_enum AS ENUM(
            'pix',
            'credit_card',
            'debit_card',
            'boleto',
            'telegram',
            'stripe',
            'mercadopago'
        );
        RAISE NOTICE '✅ Enum payment_provider_enum criado';
    ELSE
        RAISE NOTICE 'ℹ️  Enum payment_provider_enum já existe';
    END IF;

    -- Criar payment_status_enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status_enum') THEN
        CREATE TYPE payment_status_enum AS ENUM(
            'pending',
            'processing',
            'completed',
            'failed',
            'cancelled',
            'refunded'
        );
        RAISE NOTICE '✅ Enum payment_status_enum criado';
    ELSE
        RAISE NOTICE 'ℹ️  Enum payment_status_enum já existe';
    END IF;
END$$;

-- Passo 3: Criar nova tabela payments
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_id UUID NOT NULL,
    provider payment_provider_enum NOT NULL,
    provider_payment_id VARCHAR,
    status payment_status_enum NOT NULL DEFAULT 'pending',
    amount_cents INTEGER,
    currency VARCHAR(3) DEFAULT 'BRL',
    payment_method VARCHAR,
    provider_meta JSONB,
    webhook_payload JSONB,
    failure_reason TEXT,
    processed_at TIMESTAMP,
    expires_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Passo 4: Criar índices
CREATE INDEX IF NOT EXISTS idx_payments_provider_lookup ON payments(provider, provider_payment_id);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_purchase_id ON payments(purchase_id);

-- Passo 5: Mensagem de sucesso
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '================================================';
    RAISE NOTICE '🎉 TABELA PAYMENTS CRIADA COM SUCESSO!';
    RAISE NOTICE '================================================';
    RAISE NOTICE '';
    RAISE NOTICE '✅ Nova tabela payments criada';
    RAISE NOTICE '✅ ENUMs criados';
    RAISE NOTICE '✅ Índices criados';
    RAISE NOTICE '';
    RAISE NOTICE 'Sistema pronto para receber pagamentos!';
    RAISE NOTICE '';
END$$;

-- Passo 6: Mostrar estrutura
SELECT
    column_name as "Coluna",
    data_type as "Tipo",
    is_nullable as "NULL?",
    column_default as "Padrão"
FROM information_schema.columns
WHERE table_name = 'payments'
ORDER BY ordinal_position;
