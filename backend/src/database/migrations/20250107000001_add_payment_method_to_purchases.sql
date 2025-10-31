-- Add payment_method column to purchases table
-- This field tracks which payment method was used for the purchase (pix, card, etc.)

-- Create enum for payment methods if it doesn't exist
DO $$ BEGIN
  CREATE TYPE payment_method_enum AS ENUM('pix', 'card', 'credit_card', 'debit_card', 'boleto');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add payment_method column to purchases table
ALTER TABLE purchases
ADD COLUMN IF NOT EXISTS payment_method payment_method_enum;

-- Create index for filtering by payment method
CREATE INDEX IF NOT EXISTS idx_purchases_payment_method ON purchases(payment_method);

-- Update existing records with default value based on provider_meta or status
-- This is a best-effort migration - new purchases will have this set correctly
UPDATE purchases
SET payment_method =
  CASE
    WHEN provider_meta->>'payment_method' = 'pix' THEN 'pix'::payment_method_enum
    WHEN provider_meta->>'payment_method' = 'card' THEN 'card'::payment_method_enum
    WHEN provider_meta->>'payment_method' = 'credit_card' THEN 'credit_card'::payment_method_enum
    WHEN provider_meta->>'payment_method' IN ('stripe', 'checkout') THEN 'card'::payment_method_enum
    WHEN status = 'paid' THEN 'card'::payment_method_enum  -- Default to card for paid purchases without metadata
    ELSE NULL
  END
WHERE payment_method IS NULL;

-- Add comment to document the column
COMMENT ON COLUMN purchases.payment_method IS 'Payment method used for this purchase (pix, card, credit_card, debit_card, boleto)';
