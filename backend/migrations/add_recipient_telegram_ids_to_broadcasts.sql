-- Add recipient_telegram_ids column to broadcasts table to store which users received the message
ALTER TABLE broadcasts
ADD COLUMN IF NOT EXISTS recipient_telegram_ids TEXT;

-- Add comment to explain the column
COMMENT ON COLUMN broadcasts.recipient_telegram_ids IS 'Comma-separated list of Telegram IDs that successfully received the broadcast message';
