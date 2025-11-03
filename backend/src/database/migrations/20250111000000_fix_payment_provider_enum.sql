-- Migration: Fix payment_provider_enum to support Stripe and Mercado Pago
-- Date: 2025-01-11
-- Description:
--   1. Add 'stripe' and 'mercadopago' values to payment_provider_enum
--   2. Create composite index for faster webhook lookups
--   3. Add index on created_at for temporal queries

-- Step 1: Add new enum values (PostgreSQL 9.1+)
DO $$
BEGIN
    -- Add 'stripe' if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'stripe'
        AND enumtypid = (
            SELECT oid FROM pg_type WHERE typname = 'payment_provider_enum'
        )
    ) THEN
        ALTER TYPE payment_provider_enum ADD VALUE 'stripe';
        RAISE NOTICE 'Added "stripe" to payment_provider_enum';
    ELSE
        RAISE NOTICE '"stripe" already exists in payment_provider_enum';
    END IF;

    -- Add 'mercadopago' if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'mercadopago'
        AND enumtypid = (
            SELECT oid FROM pg_type WHERE typname = 'payment_provider_enum'
        )
    ) THEN
        ALTER TYPE payment_provider_enum ADD VALUE 'mercadopago';
        RAISE NOTICE 'Added "mercadopago" to payment_provider_enum';
    ELSE
        RAISE NOTICE '"mercadopago" already exists in payment_provider_enum';
    END IF;
END$$;

-- Step 2: Create composite index for webhook lookups
-- This index speeds up queries like:
-- SELECT * FROM payments WHERE provider = 'mercadopago' AND provider_payment_id = '12345'
CREATE INDEX IF NOT EXISTS idx_payments_provider_lookup
ON payments(provider, provider_payment_id);

COMMENT ON INDEX idx_payments_provider_lookup IS
'Composite index for fast webhook payment lookups by provider and external payment ID';

-- Step 3: Create index on created_at for temporal queries
CREATE INDEX IF NOT EXISTS idx_payments_created_at
ON payments(created_at DESC);

COMMENT ON INDEX idx_payments_created_at IS
'Index for temporal queries and payment history lookups';

-- Step 4: Create index on status for filtering
-- Already exists from initial migration, but ensure it's there
CREATE INDEX IF NOT EXISTS idx_payments_status
ON payments(status);

-- Step 5: Verify the changes
DO $$
DECLARE
    enum_values TEXT[];
BEGIN
    -- Get all enum values
    SELECT ARRAY_AGG(enumlabel ORDER BY enumlabel) INTO enum_values
    FROM pg_enum
    WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'payment_provider_enum');

    RAISE NOTICE 'Current payment_provider_enum values: %', enum_values;

    -- Verify required values exist
    IF 'stripe' = ANY(enum_values) AND 'mercadopago' = ANY(enum_values) THEN
        RAISE NOTICE '✅ All required enum values are present';
    ELSE
        RAISE WARNING '⚠️ Some enum values might be missing';
    END IF;
END$$;

-- Step 6: Output index information
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'payments'
ORDER BY indexname;
