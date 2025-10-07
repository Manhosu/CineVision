-- Migration: Add Stripe and Storage fields to content table
-- Description: Adds Stripe product/price IDs, storage keys, and sales tracking fields
-- Date: 2025-01-01

-- Add Stripe integration fields
ALTER TABLE content
ADD COLUMN IF NOT EXISTS stripe_product_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS stripe_price_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'BRL';

-- Add Storage keys for S3
ALTER TABLE content
ADD COLUMN IF NOT EXISTS file_storage_key VARCHAR(500),
ADD COLUMN IF NOT EXISTS cover_storage_key VARCHAR(500),
ADD COLUMN IF NOT EXISTS trailer_storage_key VARCHAR(500);

-- Add Sales tracking fields
ALTER TABLE content
ADD COLUMN IF NOT EXISTS weekly_sales INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_sales INTEGER DEFAULT 0;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_content_stripe_product ON content(stripe_product_id);
CREATE INDEX IF NOT EXISTS idx_content_stripe_price ON content(stripe_price_id);
CREATE INDEX IF NOT EXISTS idx_content_sales ON content(weekly_sales DESC, total_sales DESC);
CREATE INDEX IF NOT EXISTS idx_content_file_storage ON content(file_storage_key);

-- Update existing records to have default values
UPDATE content SET weekly_sales = 0 WHERE weekly_sales IS NULL;
UPDATE content SET total_sales = 0 WHERE total_sales IS NULL;
UPDATE content SET currency = 'BRL' WHERE currency IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN content.stripe_product_id IS 'Stripe Product ID created automatically when content is added';
COMMENT ON COLUMN content.stripe_price_id IS 'Stripe Price ID for purchase integration';
COMMENT ON COLUMN content.currency IS 'Currency code (ISO 4217) - default BRL';
COMMENT ON COLUMN content.file_storage_key IS 'S3 key for the main video file';
COMMENT ON COLUMN content.cover_storage_key IS 'S3 key for cover/poster image';
COMMENT ON COLUMN content.trailer_storage_key IS 'S3 key for trailer video';
COMMENT ON COLUMN content.weekly_sales IS 'Number of sales in the current week (reset weekly)';
COMMENT ON COLUMN content.total_sales IS 'Total lifetime sales count';
