-- ========================================
-- ADD IS_RELEASE FIELD TO CONTENT TABLE
-- ========================================
-- This allows manual control of what appears in "Lançamentos" section

-- 1. Add is_release column (default false for existing content)
ALTER TABLE content
ADD COLUMN IF NOT EXISTS is_release BOOLEAN DEFAULT FALSE;

-- 2. Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_content_is_release
ON content(is_release)
WHERE is_release = TRUE AND status = 'PUBLISHED';

-- 3. Optionally mark recent content as releases (last 30 days)
-- Uncomment the lines below if you want to auto-mark recent content
-- UPDATE content
-- SET is_release = TRUE
-- WHERE status = 'PUBLISHED'
--   AND created_at >= NOW() - INTERVAL '30 days';

-- Verification query
SELECT
  COUNT(*) FILTER (WHERE is_release = TRUE) as total_releases,
  COUNT(*) FILTER (WHERE is_release = FALSE) as total_non_releases,
  COUNT(*) as total_content
FROM content
WHERE status = 'PUBLISHED';

SELECT 'Migration complete! Column is_release added to content table.' as status;
