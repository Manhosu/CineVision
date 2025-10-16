-- Migration: Add upload_status to content_languages table
-- This field tracks the processing status of uploaded videos

ALTER TABLE content_languages
ADD COLUMN IF NOT EXISTS upload_status VARCHAR(50) DEFAULT 'pending';

-- Add comment for documentation
COMMENT ON COLUMN content_languages.upload_status IS 'Video processing status: pending, processing, completed, failed';

-- Update existing records to 'completed' if they have a video_url
UPDATE content_languages
SET upload_status = 'completed'
WHERE video_url IS NOT NULL AND upload_status IS NULL;

-- Create index for filtering by upload status
CREATE INDEX IF NOT EXISTS idx_content_languages_upload_status
ON content_languages(upload_status);
