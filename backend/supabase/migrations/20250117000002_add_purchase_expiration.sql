-- Add expiration tracking to purchases table
-- This helps prevent accumulation of pending purchases

-- Add expires_at column to purchases
ALTER TABLE purchases
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Create index for efficient queries on expired purchases
CREATE INDEX IF NOT EXISTS idx_purchases_expires_at
ON purchases(expires_at)
WHERE status IN ('pending', 'pendente');

-- Create index for pending purchases cleanup
CREATE INDEX IF NOT EXISTS idx_purchases_status_expires
ON purchases(status, expires_at);

-- Update existing pending purchases to have expiration (24 hours from creation)
UPDATE purchases
SET expires_at = created_at + INTERVAL '24 hours'
WHERE status IN ('pending', 'pendente')
  AND expires_at IS NULL;

-- Add comment
COMMENT ON COLUMN purchases.expires_at IS 'Timestamp when a pending purchase expires and should be marked as failed';
