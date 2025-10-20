-- Migration: Add provider_meta column to payments table
-- This column is required for storing PIX payment metadata

-- Add the provider_meta column if it doesn't exist
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS provider_meta JSONB;

-- Verify the column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'payments'
  AND column_name = 'provider_meta';

-- Show sample of payments table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'payments'
ORDER BY ordinal_position;
