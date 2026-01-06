-- Migration: Add Woovi to payment_provider_enum
-- Date: 2026-01-05
-- Description:
--   1. Add 'woovi' value to payment_provider_enum for Woovi PIX payments
--   2. This replaces EFI Bank as the PIX payment provider

-- Step 1: Add 'woovi' enum value (PostgreSQL 9.1+)
DO $$
BEGIN
    -- Add 'woovi' if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'woovi'
        AND enumtypid = (
            SELECT oid FROM pg_type WHERE typname = 'payment_provider_enum'
        )
    ) THEN
        ALTER TYPE payment_provider_enum ADD VALUE 'woovi';
        RAISE NOTICE 'Added "woovi" to payment_provider_enum';
    ELSE
        RAISE NOTICE '"woovi" already exists in payment_provider_enum';
    END IF;
END$$;

-- Step 2: Verify the changes
DO $$
DECLARE
    enum_values TEXT[];
BEGIN
    -- Get all enum values
    SELECT ARRAY_AGG(enumlabel ORDER BY enumlabel) INTO enum_values
    FROM pg_enum
    WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'payment_provider_enum');

    RAISE NOTICE 'Current payment_provider_enum values: %', enum_values;

    -- Verify 'woovi' exists
    IF 'woovi' = ANY(enum_values) THEN
        RAISE NOTICE 'Woovi enum value is present';
    ELSE
        RAISE WARNING 'Woovi enum value might be missing';
    END IF;
END$$;
