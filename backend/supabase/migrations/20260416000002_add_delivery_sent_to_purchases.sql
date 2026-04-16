-- Idempotency flag to prevent duplicate Telegram delivery messages
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS delivery_sent boolean DEFAULT false;
