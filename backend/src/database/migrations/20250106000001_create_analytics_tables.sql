-- Create analytics tables for realtime user tracking

-- User sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  user_email TEXT,
  ip_address TEXT,
  user_agent TEXT,
  current_page TEXT,
  is_watching BOOLEAN DEFAULT FALSE,
  watching_content_id UUID,
  watching_content_title TEXT,
  last_activity TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'online' CHECK (status IN ('online', 'offline', 'idle')),
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  disconnected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activity events table
CREATE TABLE IF NOT EXISTS activity_events (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('page_view', 'video_start', 'video_pause', 'video_resume', 'video_end', 'purchase', 'search')),
  content_id UUID,
  content_title TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_id ON user_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_status ON user_sessions(status);
CREATE INDEX IF NOT EXISTS idx_user_sessions_is_watching ON user_sessions(is_watching);
CREATE INDEX IF NOT EXISTS idx_user_sessions_last_activity ON user_sessions(last_activity DESC);

CREATE INDEX IF NOT EXISTS idx_activity_events_session_id ON activity_events(session_id);
CREATE INDEX IF NOT EXISTS idx_activity_events_user_id ON activity_events(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_events_event_type ON activity_events(event_type);
CREATE INDEX IF NOT EXISTS idx_activity_events_created_at ON activity_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_events_content_id ON activity_events(content_id);

-- Function to cleanup inactive sessions (sessions inactive for more than 2 HOURS)
-- Increased from 5/15 minutes to 2 hours to properly track users watching movies/series
CREATE OR REPLACE FUNCTION cleanup_inactive_sessions()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE user_sessions
  SET status = 'offline',
      disconnected_at = NOW()
  WHERE status = 'online'
    AND last_activity < NOW() - INTERVAL '2 hours';
END;
$$;

-- Trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_sessions_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_user_sessions_updated_at
  BEFORE UPDATE ON user_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_user_sessions_updated_at();

-- Grant permissions
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_events ENABLE ROW LEVEL SECURITY;

-- Policy to allow service role full access
CREATE POLICY "Service role can manage user sessions"
  ON user_sessions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage activity events"
  ON activity_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to read their own sessions
CREATE POLICY "Users can read their own sessions"
  ON user_sessions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Allow authenticated users to read their own activities
CREATE POLICY "Users can read their own activities"
  ON activity_events
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Allow public insert for sessions (for tracking anonymous users)
CREATE POLICY "Public can create sessions"
  ON user_sessions
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Allow public insert for activities
CREATE POLICY "Public can create activities"
  ON activity_events
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

COMMENT ON TABLE user_sessions IS 'Tracks active user sessions for realtime analytics';
COMMENT ON TABLE activity_events IS 'Logs user activity events for analytics and insights';
COMMENT ON FUNCTION cleanup_inactive_sessions() IS 'Marks sessions as offline if inactive for more than 5 minutes';
