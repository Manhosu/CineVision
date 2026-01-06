-- Migration: Add EFI Bank to payment_provider_enum
-- Date: 2025-12-30
-- Description:
--   1. Add 'efi' value to payment_provider_enum for EFI Bank PIX payments
--   2. This replaces Mercado Pago as the PIX payment provider

-- Step 1: Add 'efi' enum value (PostgreSQL 9.1+)
DO $$
BEGIN
    -- Add 'efi' if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'efi'
        AND enumtypid = (
            SELECT oid FROM pg_type WHERE typname = 'payment_provider_enum'
        )
    ) THEN
        ALTER TYPE payment_provider_enum ADD VALUE 'efi';
        RAISE NOTICE 'Added "efi" to payment_provider_enum';
    ELSE
        RAISE NOTICE '"efi" already exists in payment_provider_enum';
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

    -- Verify 'efi' exists
    IF 'efi' = ANY(enum_values) THEN
        RAISE NOTICE '✅ EFI Bank enum value is present';
    ELSE
        RAISE WARNING '⚠️ EFI Bank enum value might be missing';
    END IF;
END$$;
