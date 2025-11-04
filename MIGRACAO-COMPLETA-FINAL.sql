-- ============================================================
-- MIGRAÇÃO COMPLETA FINAL: Payment System
-- Data: 2025-11-03
-- Descrição: Migração completa e segura que verifica e cria
--            tudo que é necessário para o sistema de pagamentos
-- ============================================================

-- PASSO 1: Criar ENUMs necessários
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

        -- Adicionar valores faltantes
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum
            WHERE enumlabel = 'stripe'
            AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'payment_provider_enum')
        ) THEN
            ALTER TYPE payment_provider_enum ADD VALUE 'stripe';
            RAISE NOTICE '✅ Adicionado "stripe"';
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_enum
            WHERE enumlabel = 'mercadopago'
            AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'payment_provider_enum')
        ) THEN
            ALTER TYPE payment_provider_enum ADD VALUE 'mercadopago';
            RAISE NOTICE '✅ Adicionado "mercadopago"';
        END IF;
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

-- PASSO 2: Verificar e criar tabela payments se não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'payments') THEN
        RAISE NOTICE '⚠️  Tabela payments não existe - criando...';

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

        RAISE NOTICE '✅ Tabela payments criada';
    ELSE
        RAISE NOTICE '✅ Tabela payments já existe';
    END IF;
END$$;

-- PASSO 3: Adicionar colunas faltantes (se a tabela já existia)
DO $$
BEGIN
    -- Adicionar coluna provider se não existir
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'payments' AND column_name = 'provider'
    ) THEN
        ALTER TABLE payments ADD COLUMN provider payment_provider_enum;
        RAISE NOTICE '✅ Coluna provider adicionada';
    ELSE
        RAISE NOTICE 'ℹ️  Coluna provider já existe';
    END IF;

    -- Adicionar coluna provider_payment_id se não existir
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'payments' AND column_name = 'provider_payment_id'
    ) THEN
        ALTER TABLE payments ADD COLUMN provider_payment_id VARCHAR;
        RAISE NOTICE '✅ Coluna provider_payment_id adicionada';
    ELSE
        RAISE NOTICE 'ℹ️  Coluna provider_payment_id já existe';
    END IF;

    -- Adicionar coluna status se não existir
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'payments' AND column_name = 'status'
    ) THEN
        ALTER TABLE payments ADD COLUMN status payment_status_enum NOT NULL DEFAULT 'pending';
        RAISE NOTICE '✅ Coluna status adicionada';
    ELSE
        RAISE NOTICE 'ℹ️  Coluna status já existe';
    END IF;

    -- Adicionar coluna amount_cents se não existir
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'payments' AND column_name = 'amount_cents'
    ) THEN
        ALTER TABLE payments ADD COLUMN amount_cents INTEGER;
        RAISE NOTICE '✅ Coluna amount_cents adicionada';
    ELSE
        RAISE NOTICE 'ℹ️  Coluna amount_cents já existe';
    END IF;

    -- Adicionar coluna currency se não existir
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'payments' AND column_name = 'currency'
    ) THEN
        ALTER TABLE payments ADD COLUMN currency VARCHAR(3) DEFAULT 'BRL';
        RAISE NOTICE '✅ Coluna currency adicionada';
    ELSE
        RAISE NOTICE 'ℹ️  Coluna currency já existe';
    END IF;

    -- Adicionar coluna payment_method se não existir
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'payments' AND column_name = 'payment_method'
    ) THEN
        ALTER TABLE payments ADD COLUMN payment_method VARCHAR;
        RAISE NOTICE '✅ Coluna payment_method adicionada';
    ELSE
        RAISE NOTICE 'ℹ️  Coluna payment_method já existe';
    END IF;

    -- Adicionar coluna provider_meta se não existir
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'payments' AND column_name = 'provider_meta'
    ) THEN
        ALTER TABLE payments ADD COLUMN provider_meta JSONB;
        RAISE NOTICE '✅ Coluna provider_meta adicionada';
    ELSE
        RAISE NOTICE 'ℹ️  Coluna provider_meta já existe';
    END IF;

    -- Adicionar coluna created_at se não existir
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'payments' AND column_name = 'created_at'
    ) THEN
        ALTER TABLE payments ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
        RAISE NOTICE '✅ Coluna created_at adicionada';
    ELSE
        RAISE NOTICE 'ℹ️  Coluna created_at já existe';
    END IF;

    -- Adicionar coluna updated_at se não existir
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'payments' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE payments ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
        RAISE NOTICE '✅ Coluna updated_at adicionada';
    ELSE
        RAISE NOTICE 'ℹ️  Coluna updated_at já existe';
    END IF;
END$$;

-- PASSO 4: Criar índices para performance
DO $$
BEGIN
    -- Índice composto para lookups de webhook
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'payments'
        AND indexname = 'idx_payments_provider_lookup'
    ) THEN
        CREATE INDEX idx_payments_provider_lookup
        ON payments(provider, provider_payment_id);
        RAISE NOTICE '✅ Índice idx_payments_provider_lookup criado';
    ELSE
        RAISE NOTICE 'ℹ️  Índice idx_payments_provider_lookup já existe';
    END IF;

    -- Índice em created_at
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'payments'
        AND indexname = 'idx_payments_created_at'
    ) THEN
        CREATE INDEX idx_payments_created_at
        ON payments(created_at DESC);
        RAISE NOTICE '✅ Índice idx_payments_created_at criado';
    ELSE
        RAISE NOTICE 'ℹ️  Índice idx_payments_created_at já existe';
    END IF;

    -- Índice em status
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'payments'
        AND indexname = 'idx_payments_status'
    ) THEN
        CREATE INDEX idx_payments_status
        ON payments(status);
        RAISE NOTICE '✅ Índice idx_payments_status criado';
    ELSE
        RAISE NOTICE 'ℹ️  Índice idx_payments_status já existe';
    END IF;

    -- Índice em purchase_id
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'payments'
        AND indexname = 'idx_payments_purchase_id'
    ) THEN
        CREATE INDEX idx_payments_purchase_id
        ON payments(purchase_id);
        RAISE NOTICE '✅ Índice idx_payments_purchase_id criado';
    ELSE
        RAISE NOTICE 'ℹ️  Índice idx_payments_purchase_id já existe';
    END IF;
END$$;

-- PASSO 5: Verificação e Resumo Final
DO $$
DECLARE
    enum_values TEXT[];
    column_count INTEGER;
    index_count INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '================================================';
    RAISE NOTICE '📊 RESUMO DA MIGRAÇÃO';
    RAISE NOTICE '================================================';
    RAISE NOTICE '';

    -- Verificar enum
    SELECT ARRAY_AGG(enumlabel ORDER BY enumlabel) INTO enum_values
    FROM pg_enum
    WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'payment_provider_enum');

    RAISE NOTICE '✅ payment_provider_enum: %', enum_values;

    IF 'stripe' = ANY(enum_values) AND 'mercadopago' = ANY(enum_values) THEN
        RAISE NOTICE '✅ Stripe e Mercado Pago presentes';
    ELSE
        RAISE WARNING '⚠️  Valores faltando no enum';
    END IF;

    -- Contar colunas
    SELECT COUNT(*) INTO column_count
    FROM information_schema.columns
    WHERE table_name = 'payments';

    RAISE NOTICE '✅ Tabela payments tem % colunas', column_count;

    -- Verificar colunas essenciais
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'payments'
        AND column_name IN ('provider', 'provider_payment_id', 'status', 'created_at')
        GROUP BY table_name
        HAVING COUNT(*) = 4
    ) THEN
        RAISE NOTICE '✅ Colunas essenciais presentes';
    ELSE
        RAISE WARNING '⚠️  Algumas colunas essenciais podem estar faltando';
    END IF;

    -- Contar índices
    SELECT COUNT(*) INTO index_count
    FROM pg_indexes
    WHERE tablename = 'payments'
    AND indexname LIKE 'idx_payments_%';

    RAISE NOTICE '✅ Índices criados: %', index_count;

    RAISE NOTICE '';
    RAISE NOTICE '================================================';
    RAISE NOTICE '🎉 MIGRAÇÃO CONCLUÍDA COM SUCESSO!';
    RAISE NOTICE '================================================';
    RAISE NOTICE '';
    RAISE NOTICE '📝 Sistema pronto para:';
    RAISE NOTICE '   - Aceitar pagamentos PIX (Mercado Pago)';
    RAISE NOTICE '   - Aceitar pagamentos com Cartão (Stripe)';
    RAISE NOTICE '   - Processar webhooks';
    RAISE NOTICE '   - Entregar conteúdo automaticamente';
    RAISE NOTICE '';
END$$;

-- PASSO 6: Listar estrutura da tabela
SELECT
    column_name AS "Coluna",
    data_type AS "Tipo",
    is_nullable AS "Null?",
    column_default AS "Padrão"
FROM information_schema.columns
WHERE table_name = 'payments'
ORDER BY ordinal_position;
