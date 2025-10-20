-- Add missing Telegram fields to users table
-- This migration adds fields required for Telegram authentication and activity tracking

-- Add telegram_chat_id field (stores the Telegram chat ID for sending messages)
ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_chat_id VARCHAR(255);

-- Add telegram_username field (stores the Telegram username)
ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_username VARCHAR(255);

-- Add name field if it doesn't exist (for user's display name)
ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255);

-- Add status field if it doesn't exist (active, inactive, banned)
ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active';

-- Add activity tracking fields
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_users_telegram_chat_id ON users(telegram_chat_id);
CREATE INDEX IF NOT EXISTS idx_users_telegram_username ON users(telegram_username);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_last_active_at ON users(last_active_at DESC);

-- Add comments for documentation
COMMENT ON COLUMN users.telegram_chat_id IS 'Telegram chat ID for sending messages to the user';
COMMENT ON COLUMN users.telegram_username IS 'Telegram username (@username)';
COMMENT ON COLUMN users.name IS 'User display name';
COMMENT ON COLUMN users.status IS 'User account status: active, inactive, banned';
COMMENT ON COLUMN users.last_active_at IS 'Last time user performed any action';
COMMENT ON COLUMN users.last_login_at IS 'Last time user logged in';
