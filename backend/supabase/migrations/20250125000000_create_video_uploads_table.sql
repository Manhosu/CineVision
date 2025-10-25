-- Create video_uploads table for tracking multipart uploads
-- This table stores metadata about ongoing and completed video uploads

CREATE TABLE IF NOT EXISTS video_uploads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL, -- S3 object key
  upload_id TEXT NOT NULL UNIQUE, -- S3 multipart upload ID
  content_id UUID REFERENCES content(id) ON DELETE CASCADE, -- Link to content (for movies)
  episode_id UUID REFERENCES episodes(id) ON DELETE CASCADE, -- Link to episode (for series)
  filename TEXT NOT NULL, -- Original filename
  size BIGINT NOT NULL, -- File size in bytes
  status TEXT NOT NULL DEFAULT 'uploading', -- uploading | processing | ready | failed
  parts_count INTEGER NOT NULL, -- Number of parts for multipart upload
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Ensure either content_id or episode_id is set, but not both
  CONSTRAINT video_uploads_content_or_episode_check
    CHECK (
      (content_id IS NOT NULL AND episode_id IS NULL) OR
      (content_id IS NULL AND episode_id IS NOT NULL)
    )
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_video_uploads_content_id ON video_uploads(content_id);
CREATE INDEX IF NOT EXISTS idx_video_uploads_episode_id ON video_uploads(episode_id);
CREATE INDEX IF NOT EXISTS idx_video_uploads_upload_id ON video_uploads(upload_id);
CREATE INDEX IF NOT EXISTS idx_video_uploads_status ON video_uploads(status);
CREATE INDEX IF NOT EXISTS idx_video_uploads_created_at ON video_uploads(created_at);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_video_uploads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER video_uploads_updated_at
  BEFORE UPDATE ON video_uploads
  FOR EACH ROW
  EXECUTE FUNCTION update_video_uploads_updated_at();

-- Comments for documentation
COMMENT ON TABLE video_uploads IS 'Tracks multipart video uploads to S3 for both movies and TV series episodes';
COMMENT ON COLUMN video_uploads.key IS 'S3 object key where the file is stored';
COMMENT ON COLUMN video_uploads.upload_id IS 'Unique S3 multipart upload identifier';
COMMENT ON COLUMN video_uploads.content_id IS 'Foreign key to content table for movie uploads';
COMMENT ON COLUMN video_uploads.episode_id IS 'Foreign key to episodes table for episode uploads';
COMMENT ON COLUMN video_uploads.status IS 'Upload processing status: uploading, processing, ready, or failed';
COMMENT ON COLUMN video_uploads.parts_count IS 'Number of parts in the multipart upload';
