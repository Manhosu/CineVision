-- Igor (13/06): tabela de auditoria de gasto Claude API por chamada.
-- Cada resposta da IA grava 1 row com breakdown de tokens (input full,
-- cache read 10%, cache write +25%, output) e custo USD estimado pela
-- tabela de preços do modelo. Permite dashboard `/admin/ai-usage` mostrar
-- quem está queimando saldo e identificar abuso/spam.

CREATE TABLE IF NOT EXISTS ai_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES ai_conversations(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  external_chat_id TEXT,
  platform TEXT,
  bot_username TEXT,
  model TEXT NOT NULL,
  input_tokens INT NOT NULL DEFAULT 0,
  output_tokens INT NOT NULL DEFAULT 0,
  cache_read_tokens INT NOT NULL DEFAULT 0,
  cache_creation_tokens INT NOT NULL DEFAULT 0,
  cost_usd NUMERIC(10, 6) NOT NULL DEFAULT 0,
  latency_ms INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Queries do dashboard são por janela temporal + agregação por user.
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_created_at ON ai_usage_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_user_id ON ai_usage_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_external_chat ON ai_usage_log(external_chat_id, created_at DESC);

ALTER TABLE ai_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access_ai_usage" ON ai_usage_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);
