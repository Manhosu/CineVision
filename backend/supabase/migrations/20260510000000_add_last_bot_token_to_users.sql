-- Migration: Add last_bot_token column to users table
-- Tracks which bot token the user last interacted with
-- Allows filtering broadcast users by new bot vs old bot

ALTER TABLE users ADD COLUMN IF NOT EXISTS last_bot_token TEXT;

COMMENT ON COLUMN users.last_bot_token IS 'Token do bot Telegram com o qual o usuário interagiu pela última vez. Usado para filtrar usuários do novo bot no broadcast.';
