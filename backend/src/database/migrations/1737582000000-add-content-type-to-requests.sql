-- Migration: Add content_type column to content_requests
-- Created: 2025-01-22
-- Description: Add content_type to track if request is for movie or series

-- Add content_type column with constraint
ALTER TABLE content_requests
ADD COLUMN IF NOT EXISTS content_type VARCHAR(20) CHECK (content_type IN ('movie', 'series'));

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_content_requests_type ON content_requests(content_type);

-- Set default value for existing records
UPDATE content_requests
SET content_type = 'movie'
WHERE content_type IS NULL;
