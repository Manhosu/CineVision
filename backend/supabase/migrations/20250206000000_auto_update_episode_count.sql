-- Trigger to automatically update total_episodes and total_seasons in content table
-- when episodes are inserted, updated, or deleted

-- Function to update episode and season counts
CREATE OR REPLACE FUNCTION update_content_episode_counts()
RETURNS TRIGGER AS $$
DECLARE
  v_series_id UUID;
  v_episode_count INTEGER;
  v_season_count INTEGER;
BEGIN
  -- Get the series_id (works for INSERT, UPDATE, DELETE)
  IF TG_OP = 'DELETE' THEN
    v_series_id := OLD.series_id;
  ELSE
    v_series_id := NEW.series_id;
  END IF;

  -- Count total episodes for this series
  SELECT COUNT(*)
  INTO v_episode_count
  FROM episodes
  WHERE series_id = v_series_id;

  -- Count total seasons for this series
  SELECT COUNT(DISTINCT season_number)
  INTO v_season_count
  FROM episodes
  WHERE series_id = v_series_id;

  -- Update the content table
  UPDATE content
  SET
    total_episodes = v_episode_count,
    total_seasons = v_season_count,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = v_series_id;

  -- Return the appropriate record
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for INSERT
DROP TRIGGER IF EXISTS trigger_update_episode_count_insert ON episodes;
CREATE TRIGGER trigger_update_episode_count_insert
  AFTER INSERT ON episodes
  FOR EACH ROW
  EXECUTE FUNCTION update_content_episode_counts();

-- Create trigger for UPDATE (when episode changes series)
DROP TRIGGER IF EXISTS trigger_update_episode_count_update ON episodes;
CREATE TRIGGER trigger_update_episode_count_update
  AFTER UPDATE OF series_id, season_number ON episodes
  FOR EACH ROW
  WHEN (OLD.series_id IS DISTINCT FROM NEW.series_id OR OLD.season_number IS DISTINCT FROM NEW.season_number)
  EXECUTE FUNCTION update_content_episode_counts();

-- Create trigger for DELETE
DROP TRIGGER IF EXISTS trigger_update_episode_count_delete ON episodes;
CREATE TRIGGER trigger_update_episode_count_delete
  AFTER DELETE ON episodes
  FOR EACH ROW
  EXECUTE FUNCTION update_content_episode_counts();

-- Update existing series with correct counts
UPDATE content
SET
  total_episodes = (
    SELECT COUNT(*)
    FROM episodes
    WHERE episodes.series_id = content.id
  ),
  total_seasons = (
    SELECT COUNT(DISTINCT season_number)
    FROM episodes
    WHERE episodes.series_id = content.id
  )
WHERE content_type = 'series';

-- Add comment for documentation
COMMENT ON FUNCTION update_content_episode_counts() IS 'Automatically updates total_episodes and total_seasons in content table when episodes are added, updated, or deleted';
