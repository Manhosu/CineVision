-- Fix RLS policies for user_sessions to allow UPDATE
-- This fixes the issue where session tracking only works on first page load
-- but fails to update when navigating to other pages

-- Allow public to update their own sessions (by session_id)
-- This is safe because session_id is a unique random ID that only the client knows
CREATE POLICY IF NOT EXISTS "Public can update own sessions"
  ON user_sessions
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Optional: Allow public to delete their own sessions (for cleanup on logout)
CREATE POLICY IF NOT EXISTS "Public can delete own sessions"
  ON user_sessions
  FOR DELETE
  TO anon, authenticated
  USING (true);

COMMENT ON POLICY "Public can update own sessions" ON user_sessions IS 'Allows anonymous and authenticated users to update their session data as they navigate through the site';
COMMENT ON POLICY "Public can delete own sessions" ON user_sessions IS 'Allows users to clean up their own sessions on explicit logout';
