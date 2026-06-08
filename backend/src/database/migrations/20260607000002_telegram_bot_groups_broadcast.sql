-- N31 (Igor 07/06): Broadcast para grupos Telegram onde os bots são admins.
-- Igor fazia manual (2-3h de trabalho). Agora: cadastra grupos, envia
-- mensagem para todos, e pode apagar de todos com 1 clique.

-- Tabela de grupos cadastrados por bot
CREATE TABLE IF NOT EXISTS telegram_bot_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES telegram_bots(id) ON DELETE CASCADE,
  chat_id TEXT NOT NULL,
  title TEXT,
  member_count INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(bot_id, chat_id)
);

CREATE INDEX IF NOT EXISTS idx_bot_groups_bot_id ON telegram_bot_groups (bot_id);
CREATE INDEX IF NOT EXISTS idx_bot_groups_active ON telegram_bot_groups (is_active) WHERE is_active = TRUE;

-- Tabela de histórico de broadcasts para grupos
CREATE TABLE IF NOT EXISTS group_broadcast_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Texto da mensagem enviada (para referência)
  message_text TEXT NOT NULL,
  image_url TEXT,
  -- Campos de controle
  total_groups INTEGER NOT NULL DEFAULT 0,
  successful_sends INTEGER NOT NULL DEFAULT 0,
  failed_sends INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'sending',  -- sending | completed | partial
  -- Quem enviou
  admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Mapeamento: qual message_id do Telegram foi enviado em qual grupo
-- Necessário para poder apagar depois
CREATE TABLE IF NOT EXISTS group_broadcast_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id UUID NOT NULL REFERENCES group_broadcast_messages(id) ON DELETE CASCADE,
  bot_group_id UUID NOT NULL REFERENCES telegram_bot_groups(id) ON DELETE CASCADE,
  telegram_message_id TEXT,  -- ID retornado pelo Telegram após sendMessage
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_group_broadcast_entries_broadcast ON group_broadcast_entries (broadcast_id);
CREATE INDEX IF NOT EXISTS idx_group_broadcast_entries_group ON group_broadcast_entries (bot_group_id);

-- RLS: só service_role pode escrever (backend usa service_role key)
ALTER TABLE telegram_bot_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_broadcast_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_broadcast_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON telegram_bot_groups FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON group_broadcast_messages FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON group_broadcast_entries FOR ALL TO service_role USING (true) WITH CHECK (true);
