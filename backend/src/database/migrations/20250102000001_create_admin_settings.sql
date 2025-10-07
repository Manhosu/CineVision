-- Create admin_settings table for storing system configuration
CREATE TABLE IF NOT EXISTS admin_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key VARCHAR(255) UNIQUE NOT NULL,
  setting_value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on setting_key for faster lookups
CREATE INDEX IF NOT EXISTS idx_admin_settings_key ON admin_settings(setting_key);

-- Insert default PIX settings
INSERT INTO admin_settings (setting_key, setting_value, updated_at)
VALUES
  ('pix_key', '', CURRENT_TIMESTAMP),
  ('pix_merchant_name', 'Cine Vision', CURRENT_TIMESTAMP),
  ('pix_merchant_city', 'SAO PAULO', CURRENT_TIMESTAMP)
ON CONFLICT (setting_key) DO NOTHING;
