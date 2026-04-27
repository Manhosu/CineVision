-- ============================================================================
-- Migration: Cart, Orders, PIX Recovery, AI Chat, Employees
-- Date: 2026-04-24
-- ============================================================================

-- ============================================================================
-- 1. CART SYSTEM
-- ============================================================================
CREATE TABLE IF NOT EXISTS carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  session_id VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_carts_user_id ON carts(user_id);
CREATE INDEX IF NOT EXISTS idx_carts_session_id ON carts(session_id);

CREATE TABLE IF NOT EXISTS cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  content_id UUID NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  price_cents_snapshot INTEGER NOT NULL,
  added_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_cart_content UNIQUE (cart_id, content_id)
);

CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_content_id ON cart_items(content_id);

-- ============================================================================
-- 2. ORDERS (groups multiple purchases into a single payment)
-- ============================================================================
-- Drop legacy empty orders table if schema is incompatible
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='orders' AND column_name='movie_id'
  ) THEN
    DROP TABLE orders CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  order_token UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  subtotal_cents INTEGER NOT NULL,
  discount_percent NUMERIC(5,2) DEFAULT 0,
  discount_cents INTEGER DEFAULT 0,
  total_cents INTEGER NOT NULL,
  total_items INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  payment_id UUID,
  is_recovery_order BOOLEAN DEFAULT FALSE,
  original_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  telegram_chat_id VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  paid_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_token ON orders(order_token);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_recovery ON orders(is_recovery_order, original_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_pending_recent ON orders(status, created_at);

-- Link purchases to orders (nullable — single-item purchases stay compatible)
ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_purchases_order_id ON purchases(order_id);

-- ============================================================================
-- 3. CART / RECOVERY / AI CONFIGS (via admin_settings key/value)
-- ============================================================================
INSERT INTO admin_settings (key, value, updated_at)
VALUES
  ('cart_discount_tiers', '[{"min_items":3,"percent":10},{"min_items":5,"percent":25}]', CURRENT_TIMESTAMP),
  ('cart_incentive_enabled', 'true', CURRENT_TIMESTAMP),
  ('pix_recovery_enabled', 'true', CURRENT_TIMESTAMP),
  ('pix_recovery_delay_minutes', '5', CURRENT_TIMESTAMP),
  ('pix_recovery_discount_percent', '10', CURRENT_TIMESTAMP),
  ('pix_recovery_cooldown_hours', '48', CURRENT_TIMESTAMP),
  ('pix_recovery_max_items', '2', CURRENT_TIMESTAMP),
  ('ai_chat_enabled_telegram', 'false', CURRENT_TIMESTAMP),
  ('ai_chat_enabled_whatsapp', 'false', CURRENT_TIMESTAMP),
  ('ai_model', 'claude-haiku-4-5-20251001', CURRENT_TIMESTAMP),
  ('whatsapp_provider', 'evolution', CURRENT_TIMESTAMP)
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- 4. PIX RECOVERY HISTORY (antiabuso tracking)
-- ============================================================================
CREATE TABLE IF NOT EXISTS pix_recovery_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  telegram_chat_id VARCHAR(50),
  original_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  recovery_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  discount_percent NUMERIC(5,2) NOT NULL,
  offered_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  converted BOOLEAN DEFAULT FALSE,
  converted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_recovery_user_date ON pix_recovery_history(user_id, offered_at DESC);
CREATE INDEX IF NOT EXISTS idx_recovery_chat_date ON pix_recovery_history(telegram_chat_id, offered_at DESC);

-- ============================================================================
-- 5. EMPLOYEE PERMISSIONS + DAILY STATS
-- ============================================================================
-- Add 'employee' to user_role enum (idempotent on Postgres 14+)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid
    WHERE t.typname='user_role' AND e.enumlabel='employee'
  ) THEN
    ALTER TYPE user_role ADD VALUE 'employee';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS employee_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  can_add_movies BOOLEAN DEFAULT FALSE,
  can_add_series BOOLEAN DEFAULT FALSE,
  can_edit_own_content BOOLEAN DEFAULT TRUE,
  can_edit_any_content BOOLEAN DEFAULT FALSE,
  can_view_users BOOLEAN DEFAULT FALSE,
  can_view_purchases BOOLEAN DEFAULT FALSE,
  can_view_top10 BOOLEAN DEFAULT FALSE,
  can_view_online_users BOOLEAN DEFAULT FALSE,
  can_manage_discounts BOOLEAN DEFAULT FALSE,
  edit_window_hours INTEGER DEFAULT 5,
  daily_content_limit INTEGER DEFAULT 50,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_employee_permissions_user_id ON employee_permissions(user_id);

CREATE TABLE IF NOT EXISTS employee_daily_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stat_date DATE NOT NULL,
  content_added_count INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_employee_daily UNIQUE (user_id, stat_date)
);

CREATE INDEX IF NOT EXISTS idx_employee_daily_user_date ON employee_daily_stats(user_id, stat_date DESC);

-- ============================================================================
-- 6. AI CHAT
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform VARCHAR(20) NOT NULL,
  external_chat_id VARCHAR(100) NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ai_enabled BOOLEAN DEFAULT TRUE,
  paused_reason VARCHAR(50),
  paused_at TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ,
  last_bot_message_id BIGINT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_platform_chat UNIQUE (platform, external_chat_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_conv_platform_chat ON ai_conversations(platform, external_chat_id);
CREATE INDEX IF NOT EXISTS idx_ai_conv_paused ON ai_conversations(ai_enabled, paused_reason);

CREATE TABLE IF NOT EXISTS ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  tokens_used INTEGER,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_messages_conv ON ai_messages(conversation_id, created_at);

CREATE TABLE IF NOT EXISTS ai_training_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system_prompt TEXT NOT NULL,
  faq_pairs JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Seed default training row
INSERT INTO ai_training_config (system_prompt, faq_pairs, updated_at)
SELECT
  'Você é o atendente virtual do Cine Vision. Responda de forma humanizada, amigável e objetiva, como se fosse o Igor (dono do sistema). Foque em ajudar o cliente a encontrar filmes e séries, apresentar valores e finalizar a compra via PIX. Sempre seja educado, use linguagem informal mas respeitosa, e use emojis com moderação. Quando o cliente pedir um filme, busque no catálogo e apresente: nome, ano (se disponível) e preço. Envie o link de pagamento. Se o cliente pedir algo que não está no catálogo, diga que vai verificar a disponibilidade e retornar em breve.',
  '[]'::jsonb,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM ai_training_config);

-- ============================================================================
-- 7. BOT EPHEMERAL MESSAGES (for chat cleanup)
-- ============================================================================
CREATE TABLE IF NOT EXISTS bot_ephemeral_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id VARCHAR(100) NOT NULL,
  message_id BIGINT NOT NULL,
  step VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bot_ephemeral_chat ON bot_ephemeral_messages(chat_id, created_at);

-- ============================================================================
-- Comments
-- ============================================================================
COMMENT ON TABLE carts IS 'Shopping cart: one per user (or session for guests).';
COMMENT ON TABLE cart_items IS 'Items added to a cart with price snapshot.';
COMMENT ON TABLE orders IS 'Order groups one or more purchases paid in a single PIX transaction.';
COMMENT ON TABLE pix_recovery_history IS 'Records PIX recovery offers sent for abuse prevention.';
COMMENT ON TABLE employee_permissions IS 'Granular permissions per employee user.';
COMMENT ON TABLE employee_daily_stats IS 'Counts employee content additions per day for rate limiting.';
COMMENT ON TABLE ai_conversations IS 'AI assistant conversations across Telegram/WhatsApp.';
COMMENT ON TABLE ai_messages IS 'Individual messages in AI conversations.';
COMMENT ON TABLE ai_training_config IS 'Singleton row with AI system prompt and FAQ pairs.';
COMMENT ON TABLE bot_ephemeral_messages IS 'Tracks bot messages to be deleted on the next step for a clean chat UX.';
