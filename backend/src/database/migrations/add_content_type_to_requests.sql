-- Add content_type column to content_requests table
ALTER TABLE content_requests
ADD COLUMN IF NOT EXISTS content_type VARCHAR(20) CHECK (content_type IN ('movie', 'series'));

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_content_requests_type ON content_requests(content_type);

-- Update existing records to have a default type
UPDATE content_requests
SET content_type = 'movie'
WHERE content_type IS NULL;
