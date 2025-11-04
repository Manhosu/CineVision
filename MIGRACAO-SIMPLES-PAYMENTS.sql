-- ============================================================
-- MIGRAÇÃO SIMPLIFICADA: Tabela Payments
-- Data: 2025-11-04
-- Descrição: Cria tabela payments e ENUMs necessários
-- ============================================================

-- Criar ENUMs se não existirem
DO $$
BEGIN
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
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status_enum') THEN
        CREATE TYPE payment_status_enum AS ENUM(
            'pending',
            'processing',
            'completed',
            'failed',
            'cancelled',
            'refunded'
        );
    END IF;
END$$;

-- Criar tabela payments se não existir
CREATE TABLE IF NOT EXISTS payments (
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

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_payments_provider_lookup ON payments(provider, provider_payment_id);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_purchase_id ON payments(purchase_id);

-- Verificar resultado
SELECT
    'Tabela payments criada com ' || COUNT(*) || ' colunas' AS resultado
FROM information_schema.columns
WHERE table_name = 'payments';
