const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function createBroadcastsTable() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  console.log('Creating broadcasts table using admin service...');
  console.log('SUPABASE_URL:', process.env.SUPABASE_URL);

  // Since we can't execute DDL through the client directly,
  // we'll try to insert a test record which will fail if table doesn't exist
  // This is just to verify - actual table creation should be done via Supabase SQL Editor

  try {
    // Try to query the table
    const { data, error } = await supabase
      .from('broadcasts')
      .select('*')
      .limit(1);

    if (error) {
      if (error.code === 'PGRST205') {
        console.log('');
        console.log('⚠️  Table "broadcasts" does not exist yet.');
        console.log('');
        console.log('Please apply the migration manually:');
        console.log('');
        console.log('1. Go to your Supabase project dashboard');
        console.log('2. Navigate to SQL Editor');
        console.log('3. Execute the SQL from: backend/supabase/migrations/20250119000000_create_broadcasts_table.sql');
        console.log('');
        console.log('OR copy and paste this SQL:');
        console.log('');
        console.log('────────────────────────────────────────────────');
        console.log(`
-- Create broadcasts table for tracking sent notifications
CREATE TABLE IF NOT EXISTS broadcasts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_text TEXT NOT NULL,
  image_url TEXT,
  video_url TEXT,
  button_text VARCHAR(100),
  button_url TEXT,
  recipients_count INTEGER DEFAULT 0,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_broadcasts_admin_id ON broadcasts(admin_id);
CREATE INDEX IF NOT EXISTS idx_broadcasts_sent_at ON broadcasts(sent_at DESC);

-- Add RLS policies
ALTER TABLE broadcasts ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Admins can manage broadcasts" ON broadcasts;

-- Admins can do everything
CREATE POLICY "Admins can manage broadcasts" ON broadcasts
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Add comment
COMMENT ON TABLE broadcasts IS 'Stores broadcast messages sent to Telegram users';
        `);
        console.log('────────────────────────────────────────────────');
        console.log('');
      } else {
        console.error('Unexpected error:', error);
      }
    } else {
      console.log('✓ Table "broadcasts" already exists and is accessible');
      console.log('✓ Migration already applied');
    }
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

createBroadcastsTable();
