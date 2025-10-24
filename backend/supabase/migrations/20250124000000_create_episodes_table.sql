-- Create episodes table for TV series
CREATE TABLE IF NOT EXISTS episodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id UUID NOT NULL,
  season_number INTEGER NOT NULL,
  episode_number INTEGER NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  video_url TEXT,
  duration_minutes INTEGER,
  storage_path TEXT,
  file_storage_key TEXT,
  file_size_bytes BIGINT,
  processing_status VARCHAR(50) DEFAULT 'pending',
  available_qualities JSONB DEFAULT '[]'::jsonb,
  views_count INTEGER DEFAULT 0,
  created_by_id UUID,
  updated_by_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  -- Foreign key to content table
  CONSTRAINT fk_episodes_series
    FOREIGN KEY (series_id)
    REFERENCES content(id)
    ON DELETE CASCADE,

  -- Foreign keys to users table
  CONSTRAINT fk_episodes_created_by
    FOREIGN KEY (created_by_id)
    REFERENCES users(id)
    ON DELETE SET NULL,

  CONSTRAINT fk_episodes_updated_by
    FOREIGN KEY (updated_by_id)
    REFERENCES users(id)
    ON DELETE SET NULL,

  -- Unique constraint to prevent duplicate episodes
  CONSTRAINT unique_episode_per_season
    UNIQUE (series_id, season_number, episode_number)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_episodes_series_id ON episodes(series_id);
CREATE INDEX IF NOT EXISTS idx_episodes_season ON episodes(series_id, season_number);
CREATE INDEX IF NOT EXISTS idx_episodes_processing_status ON episodes(processing_status);
CREATE INDEX IF NOT EXISTS idx_episodes_created_at ON episodes(created_at DESC);

-- Add comments for documentation
COMMENT ON TABLE episodes IS 'Stores individual episodes for TV series content';
COMMENT ON COLUMN episodes.series_id IS 'References the parent series in the content table';
COMMENT ON COLUMN episodes.season_number IS 'Season number (1-based)';
COMMENT ON COLUMN episodes.episode_number IS 'Episode number within the season (1-based)';
COMMENT ON COLUMN episodes.processing_status IS 'Video processing status: pending, processing, ready, failed';
COMMENT ON COLUMN episodes.available_qualities IS 'Array of available video qualities (e.g., ["720p", "1080p"])';

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_episodes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER trigger_episodes_updated_at
  BEFORE UPDATE ON episodes
  FOR EACH ROW
  EXECUTE FUNCTION update_episodes_updated_at();

-- Grant permissions (adjust based on your RLS policies)
-- This assumes you have roles set up for admin and regular users
-- ALTER TABLE episodes ENABLE ROW LEVEL SECURITY;

-- Example RLS policies (uncomment and adjust as needed):
-- CREATE POLICY "Anyone can view published episodes"
--   ON episodes FOR SELECT
--   USING (
--     EXISTS (
--       SELECT 1 FROM content
--       WHERE content.id = episodes.series_id
--       AND content.status = 'published'
--     )
--   );

-- CREATE POLICY "Admins can insert episodes"
--   ON episodes FOR INSERT
--   WITH CHECK (
--     auth.jwt() ->> 'role' = 'admin'
--   );

-- CREATE POLICY "Admins can update episodes"
--   ON episodes FOR UPDATE
--   USING (
--     auth.jwt() ->> 'role' = 'admin'
--   );

-- CREATE POLICY "Admins can delete episodes"
--   ON episodes FOR DELETE
--   USING (
--     auth.jwt() ->> 'role' = 'admin'
--   );
