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
CREATE INDEX idx_broadcasts_admin_id ON broadcasts(admin_id);
CREATE INDEX idx_broadcasts_sent_at ON broadcasts(sent_at DESC);

-- Add RLS policies
ALTER TABLE broadcasts ENABLE ROW LEVEL SECURITY;

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
