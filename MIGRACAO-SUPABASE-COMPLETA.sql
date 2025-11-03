-- ============================================================
-- MIGRAÇÃO COMPLETA: Payment Provider Enum + Índices
-- Data: 2025-11-03
-- Descrição: Cria ou atualiza payment_provider_enum para
--            suportar Stripe e Mercado Pago
-- ============================================================

-- PASSO 1: Criar o enum se não existir
DO $$
BEGIN
    -- Verificar se o tipo já existe
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_provider_enum') THEN
        -- Criar enum com TODOS os valores necessários
        CREATE TYPE payment_provider_enum AS ENUM(
            'pix',
            'credit_card',
            'debit_card',
            'boleto',
            'telegram',
            'stripe',
            'mercadopago'
        );
        RAISE NOTICE '✅ Enum payment_provider_enum criado com todos os valores';
    ELSE
        RAISE NOTICE 'ℹ️  Enum payment_provider_enum já existe';
    END IF;
END$$;

-- PASSO 2: Adicionar valores faltantes se o enum já existia
DO $$
BEGIN
    -- Adicionar 'stripe' se não existir
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'stripe'
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'payment_provider_enum')
    ) THEN
        ALTER TYPE payment_provider_enum ADD VALUE 'stripe';
        RAISE NOTICE '✅ Adicionado "stripe" ao payment_provider_enum';
    ELSE
        RAISE NOTICE 'ℹ️  "stripe" já existe no payment_provider_enum';
    END IF;

    -- Adicionar 'mercadopago' se não existir
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'mercadopago'
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'payment_provider_enum')
    ) THEN
        ALTER TYPE payment_provider_enum ADD VALUE 'mercadopago';
        RAISE NOTICE '✅ Adicionado "mercadopago" ao payment_provider_enum';
    ELSE
        RAISE NOTICE 'ℹ️  "mercadopago" já existe no payment_provider_enum';
    END IF;
END$$;

-- PASSO 3: Verificar se a tabela payments existe
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'payments') THEN
        RAISE WARNING '⚠️  ATENÇÃO: Tabela "payments" não existe!';
        RAISE WARNING 'Você precisará criar a tabela payments antes de usar os pagamentos.';
    ELSE
        RAISE NOTICE '✅ Tabela payments existe';
    END IF;
END$$;

-- PASSO 4: Criar índices para performance (somente se a tabela existir)
DO $$
BEGIN
    -- Verificar se a tabela payments existe antes de criar índices
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'payments') THEN

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

        -- Índice em created_at para queries temporais
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

        -- Índice em status para filtros
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

    END IF;
END$$;

-- PASSO 5: Verificação final
DO $$
DECLARE
    enum_values TEXT[];
    table_count INTEGER;
    index_count INTEGER;
BEGIN
    -- Contar valores do enum
    SELECT ARRAY_AGG(enumlabel ORDER BY enumlabel) INTO enum_values
    FROM pg_enum
    WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'payment_provider_enum');

    RAISE NOTICE '';
    RAISE NOTICE '================================================';
    RAISE NOTICE '📊 RESUMO DA MIGRAÇÃO';
    RAISE NOTICE '================================================';
    RAISE NOTICE '';
    RAISE NOTICE '✅ Valores do payment_provider_enum: %', enum_values;

    -- Verificar se tem stripe e mercadopago
    IF 'stripe' = ANY(enum_values) AND 'mercadopago' = ANY(enum_values) THEN
        RAISE NOTICE '✅ Valores "stripe" e "mercadopago" estão presentes';
    ELSE
        RAISE WARNING '⚠️  Algum valor esperado não foi encontrado';
    END IF;

    -- Contar tabelas
    SELECT COUNT(*) INTO table_count
    FROM pg_tables
    WHERE tablename = 'payments';

    IF table_count > 0 THEN
        RAISE NOTICE '✅ Tabela payments: EXISTE';

        -- Contar índices
        SELECT COUNT(*) INTO index_count
        FROM pg_indexes
        WHERE tablename = 'payments'
        AND indexname IN ('idx_payments_provider_lookup', 'idx_payments_created_at', 'idx_payments_status');

        RAISE NOTICE '✅ Índices criados: %/3', index_count;
    ELSE
        RAISE NOTICE '⚠️  Tabela payments: NÃO EXISTE';
        RAISE NOTICE 'ℹ️  Índices serão criados quando a tabela for criada';
    END IF;

    RAISE NOTICE '';
    RAISE NOTICE '================================================';
    RAISE NOTICE '🎉 MIGRAÇÃO CONCLUÍDA!';
    RAISE NOTICE '================================================';
END$$;

-- PASSO 6: Listar todos os índices da tabela payments (se existir)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'payments') THEN
        RAISE NOTICE '';
        RAISE NOTICE '📋 Índices na tabela payments:';
    END IF;
END$$;

SELECT
    indexname AS "Nome do Índice",
    indexdef AS "Definição"
FROM pg_indexes
WHERE tablename = 'payments'
ORDER BY indexname;
