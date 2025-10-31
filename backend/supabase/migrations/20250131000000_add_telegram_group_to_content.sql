-- Migration: Add telegram_group_link to content table
-- This allows admins to associate a Telegram group with each piece of content
-- Users who purchase the content will receive an invite link to the group

-- Add telegram_group_link column to content table
ALTER TABLE content
ADD COLUMN telegram_group_link TEXT;

-- Add comment to explain the column
COMMENT ON COLUMN content.telegram_group_link IS
'Link de convite do grupo do Telegram onde o conteúdo está disponível para download. O bot DEVE ser admin deste grupo com permissão para criar links de convite. Formato: https://t.me/+AbCdEfGhIjK';

-- Create index for faster lookups (optional but recommended)
CREATE INDEX idx_content_telegram_group_link ON content(telegram_group_link)
WHERE telegram_group_link IS NOT NULL;

-- Log the migration
DO $$
BEGIN
  RAISE NOTICE 'Migration completed: Added telegram_group_link column to content table';
END $$;
