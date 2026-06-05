-- Igor (07/06): sistema multi-bot Telegram.
--
-- Sem isso, o sistema só suporta 1 bot por env var. Quando ele cai por
-- DMCA, Igor perde 100% do atendimento brasileiro até cadastrar outro
-- manualmente. A tabela permite cadastro/rotação via painel admin, e a
-- coluna `content.delivery_bot_id` permite que cada filme aponte pra
-- qual bot é admin do grupo daquele filme (aproveitando os 300+ grupos
-- antigos onde bots banidos continuam admin e funcionais via API).

-- 1) Tabela de bots cadastrados.
CREATE TABLE IF NOT EXISTS telegram_bots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  token TEXT NOT NULL,
  display_name TEXT,
  -- Papéis: 'attendance' (recebe /start, atende DM), 'delivery' (gera
  -- invite link em grupo onde é admin). Bot pode ter os 2.
  roles TEXT[] NOT NULL DEFAULT '{attendance,delivery}',
  -- Status: 'active' (normal), 'banned_br' (caído pra novos /start no
  -- Brasil, mas API ainda funciona), 'disabled' (admin desligou).
  status TEXT NOT NULL DEFAULT 'active',
  -- Bot padrão de atendimento (só 1 pode ser true). Cliente que vier
  -- sem rotação cai nele.
  is_default_attendance BOOLEAN NOT NULL DEFAULT FALSE,
  -- Peso pro sorteio rotativo (admin pode aumentar p/ bot mais saudável).
  attendance_weight INTEGER NOT NULL DEFAULT 1,
  -- Cache da contagem de users vinculados (refresh por job).
  users_count INTEGER NOT NULL DEFAULT 0,
  -- Última vez que getMe retornou OK (healthcheck).
  last_seen_ok_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telegram_bots_status ON telegram_bots (status);
CREATE INDEX IF NOT EXISTS idx_telegram_bots_default ON telegram_bots (is_default_attendance) WHERE is_default_attendance = TRUE;

-- Garante que só 1 bot tem is_default_attendance=true.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_telegram_bots_one_default
  ON telegram_bots ((1)) WHERE is_default_attendance = TRUE;

COMMENT ON COLUMN telegram_bots.roles IS
  'Papéis do bot: attendance (atende /start), delivery (gera invite via API). Banido_br pode manter delivery.';
COMMENT ON COLUMN telegram_bots.status IS
  'active | banned_br (caído pra novos /start BR) | disabled (admin desligou)';

-- 2) Coluna em content apontando qual bot é admin daquele grupo.
ALTER TABLE content
  ADD COLUMN IF NOT EXISTS delivery_bot_id UUID REFERENCES telegram_bots(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_content_delivery_bot ON content (delivery_bot_id);

COMMENT ON COLUMN content.delivery_bot_id IS
  'Igor (07/06): bot Telegram admin do grupo desse filme. NULL = usa o default attendance bot.';

-- 3) Seed dos 2 bots existentes — atual ativo e antigo caído.
-- Atual ativo: @CineVisionBrasil_bot (novo, plugado em 07/06).
-- Antigo caído mas com 300+ grupos: @CineVisionApp_rbot.
--
-- Tokens são lidos do env aqui pra evitar gravar em texto plano na
-- migration. Vou injetar via SQL em outro passo após esta migration
-- ser aplicada. Por enquanto, registros placeholder com token vazio —
-- backend usa env var TELEGRAM_BOT_TOKEN como fallback enquanto o
-- token não foi importado pra cá.
INSERT INTO telegram_bots (username, token, display_name, roles, status, is_default_attendance, attendance_weight)
VALUES
  ('CineVisionBrasil_bot', '', 'Cine Vision App ¹', '{attendance,delivery}', 'active', TRUE, 1),
  ('CineVisionApp_rbot',   '', 'Cine Vision App (anterior)', '{delivery}',      'banned_br', FALSE, 0)
ON CONFLICT (username) DO NOTHING;

-- 4) Backfill: todo content existente aponta pro bot anterior como
-- delivery_bot_id, porque ele que é admin dos 300+ grupos antigos.
-- Filmes criados depois vão escolher o bot via dropdown no admin edit.
UPDATE content
SET delivery_bot_id = (SELECT id FROM telegram_bots WHERE username = 'CineVisionApp_rbot')
WHERE delivery_bot_id IS NULL;
