const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function applyMigration() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  console.log('Applying broadcast migration...');

  const migrationSQL = `
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
  `;

  try {
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: migrationSQL
    });

    if (error) {
      console.error('Error applying migration:', error);

      // Try alternative method - execute each statement separately
      console.log('Trying alternative method...');

      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      for (const statement of statements) {
        console.log('Executing:', statement.substring(0, 50) + '...');
        const { error: stmtError } = await supabase.rpc('exec_sql', {
          sql_query: statement
        });

        if (stmtError) {
          console.error('Statement error:', stmtError);
        } else {
          console.log('✓ Success');
        }
      }
    } else {
      console.log('✓ Migration applied successfully');
    }

    // Verify table was created
    const { data: tables, error: verifyError } = await supabase
      .from('broadcasts')
      .select('*')
      .limit(1);

    if (verifyError) {
      console.error('Verification error:', verifyError);
    } else {
      console.log('✓ Table verified successfully');
    }

  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

applyMigration();
