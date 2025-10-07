-- Create user_favorites table for storing user favorite content
CREATE TABLE IF NOT EXISTS user_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  content_id UUID NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Foreign keys
  CONSTRAINT fk_user_favorites_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_favorites_content FOREIGN KEY (content_id) REFERENCES content(id) ON DELETE CASCADE,

  -- Prevent duplicate favorites
  CONSTRAINT unique_user_content_favorite UNIQUE (user_id, content_id)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_favorites_user_id ON user_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_user_favorites_content_id ON user_favorites(content_id);
CREATE INDEX IF NOT EXISTS idx_user_favorites_created_at ON user_favorites(created_at DESC);

-- Comment on table
COMMENT ON TABLE user_favorites IS 'Stores user favorite movies/series for personalized lists';
COMMENT ON COLUMN user_favorites.user_id IS 'Reference to the user who favorited the content';
COMMENT ON COLUMN user_favorites.content_id IS 'Reference to the favorited content (movie/series)';
