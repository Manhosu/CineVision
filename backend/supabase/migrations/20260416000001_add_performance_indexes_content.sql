-- Performance indexes for content table at scale (5k-10k+ items)

-- Most common query: published content sorted by newest
CREATE INDEX IF NOT EXISTS idx_content_status_created
  ON content(status, created_at DESC);

-- Filtered by type (movies vs series)
CREATE INDEX IF NOT EXISTS idx_content_status_type_created
  ON content(status, content_type, created_at DESC);

-- Featured content lookup
CREATE INDEX IF NOT EXISTS idx_content_featured_status
  ON content(is_featured, status) WHERE is_featured = true;

-- Release content lookup
CREATE INDEX IF NOT EXISTS idx_content_release_status
  ON content(is_release, status) WHERE is_release = true;

-- Price lookups (for discount filtering)
CREATE INDEX IF NOT EXISTS idx_content_price
  ON content(price_cents) WHERE status = 'PUBLISHED';

-- Category filtering (join table)
CREATE INDEX IF NOT EXISTS idx_content_categories_content
  ON content_categories(content_id);
CREATE INDEX IF NOT EXISTS idx_content_categories_category
  ON content_categories(category_id);
