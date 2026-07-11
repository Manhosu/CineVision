-- Igor (04/07): bots promocionais / de captação. Feature paga fora da
-- mensalidade — estratégia de aproveitar busca orgânica do Telegram.
--
-- Bots criados no BotFather com nome de filme em alta (ex: "Todo Mundo
-- Em Pânico 6 FILME COMPLETO"). Cliente busca no Telegram, encontra
-- o bot, dá /start, recebe CTA pro site OU cai num fluxo especial de
-- compra cross-bot (Cenário 3: bot oficial → promo → outro oficial).
--
-- Arquitetura: reuso da tabela telegram_bots com flag is_promotional
-- + constraint SQL blindando isolamento operacional. Rollback trivial:
-- UPDATE telegram_bots SET is_promotional=FALSE.

-- 1) Flags em telegram_bots
ALTER TABLE telegram_bots
  ADD COLUMN IF NOT EXISTS is_promotional BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS promotional_content_id UUID REFERENCES content(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS promotional_target_url TEXT,
  ADD COLUMN IF NOT EXISTS promotional_start_count INTEGER NOT NULL DEFAULT 0,
  -- custom_display_name: Igor renomeia o bot no BotFather (ex: Superman
  -- → Todo Mundo em Pânico) e cadastra o novo nome aqui pra achar no
  -- painel. Independente do display_name original vindo do getMe.
  ADD COLUMN IF NOT EXISTS custom_display_name TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Constraint: bot promocional NÃO pode ter role attendance. Isolamento
-- operacional — atendimento humano fica só nos oficiais.
ALTER TABLE telegram_bots
  DROP CONSTRAINT IF EXISTS chk_promo_no_attendance;
ALTER TABLE telegram_bots
  ADD CONSTRAINT chk_promo_no_attendance CHECK (
    is_promotional = FALSE OR NOT (roles && ARRAY['attendance']::TEXT[])
  );

-- Índices parciais pra queries de rotação/listagem
CREATE INDEX IF NOT EXISTS idx_telegram_bots_non_promotional
  ON telegram_bots (status) WHERE is_promotional = FALSE;
CREATE INDEX IF NOT EXISTS idx_telegram_bots_promotional
  ON telegram_bots (status) WHERE is_promotional = TRUE;

COMMENT ON COLUMN telegram_bots.is_promotional IS
  'Igor (04/07): bot de captação/divulgação (nome de filme em alta pra busca orgânica do Telegram). Excluído da rotação de atendimento oficial.';
COMMENT ON COLUMN telegram_bots.promotional_content_id IS
  'Filme/série vinculado. Cliente que dá /start é levado pra esse conteúdo.';
COMMENT ON COLUMN telegram_bots.custom_display_name IS
  'Nome customizado pro painel (Igor renomeou o bot no BotFather pra outro filme, mantém rastreamento).';

-- 2) Vinculação content → bot promo (Cenário 3)
ALTER TABLE content
  ADD COLUMN IF NOT EXISTS promotional_bot_id UUID REFERENCES telegram_bots(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_content_promotional_bot
  ON content (promotional_bot_id) WHERE promotional_bot_id IS NOT NULL;

COMMENT ON COLUMN content.promotional_bot_id IS
  'Cenário 3: quando cliente clica Comprar no bot oficial, sistema desvia pra esse bot promocional pra gerar PIX (aumenta interação real no bot promo → melhor ranking na busca do Telegram). Só aplicado se is_release=true.';

-- 3) Purchase intents — token curto pra deep-link (limite 64 chars do /start)
CREATE TABLE IF NOT EXISTS purchase_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- nanoid 16 chars base62 → `pi_<16>` = 19 chars (bem dentro do limite)
  token TEXT NOT NULL UNIQUE,
  content_id UUID NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  promo_bot_id UUID NOT NULL REFERENCES telegram_bots(id) ON DELETE CASCADE,
  origin_bot_id UUID NOT NULL REFERENCES telegram_bots(id),
  origin_chat_id BIGINT NOT NULL,
  origin_telegram_user_id BIGINT NOT NULL,
  origin_user_id UUID REFERENCES users(id),
  -- Snapshot do preço no momento do intent (imutável mesmo se admin
  -- mudar preço no meio do fluxo)
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'consumed', 'expired')),
  order_id UUID REFERENCES orders(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Igor: 15min é confortável pra cliente clicar no botão pro promo e
  -- abrir o Telegram. TTL curto evita spam de intents pendentes.
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '15 minutes'),
  consumed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_purchase_intents_token
  ON purchase_intents (token);
CREATE INDEX IF NOT EXISTS idx_purchase_intents_user_status
  ON purchase_intents (origin_telegram_user_id, status);
CREATE INDEX IF NOT EXISTS idx_purchase_intents_expires
  ON purchase_intents (expires_at) WHERE status = 'pending';

COMMENT ON TABLE purchase_intents IS
  'Igor (04/07): intent de compra Cenário 3. Cliente clica Comprar no bot oficial → cria intent aqui → deep-link curto (pi_<token>) pro bot promo → bot promo consome e gera order/PIX.';

-- 4) Rastreamento em orders
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS origin_promotional_bot_id UUID REFERENCES telegram_bots(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS origin_official_bot_id UUID REFERENCES telegram_bots(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delivery_bot_id UUID REFERENCES telegram_bots(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS purchase_intent_id UUID REFERENCES purchase_intents(id);

CREATE INDEX IF NOT EXISTS idx_orders_origin_promo
  ON orders (origin_promotional_bot_id)
  WHERE origin_promotional_bot_id IS NOT NULL;

COMMENT ON COLUMN orders.origin_promotional_bot_id IS
  'Cenário 3: bot promocional que gerou o PIX dessa order.';
COMMENT ON COLUMN orders.origin_official_bot_id IS
  'Cenário 3: bot oficial de onde o cliente veio antes do desvio.';
COMMENT ON COLUMN orders.delivery_bot_id IS
  'Cenário 3: bot oficial que entrega o conteúdo (sorteado na rotação, ≠ do promo).';

-- 5) RPC: contador atômico de /start no bot promocional
CREATE OR REPLACE FUNCTION increment_promotional_start_count(bot_id UUID)
RETURNS INTEGER
LANGUAGE SQL
AS $$
  UPDATE telegram_bots
  SET promotional_start_count = promotional_start_count + 1,
      updated_at = NOW()
  WHERE id = bot_id
  RETURNING promotional_start_count;
$$;

-- 6) RPC: analytics agregado por bot promocional
CREATE OR REPLACE FUNCTION promotional_bots_analytics(days INTEGER DEFAULT 30)
RETURNS TABLE(
  bot_id UUID,
  username TEXT,
  custom_display_name TEXT,
  starts_count INTEGER,
  orders_created BIGINT,
  orders_paid BIGINT,
  revenue_cents BIGINT
)
LANGUAGE SQL
STABLE
AS $$
  SELECT
    tb.id AS bot_id,
    tb.username,
    tb.custom_display_name,
    tb.promotional_start_count AS starts_count,
    COUNT(o.id) AS orders_created,
    COUNT(o.id) FILTER (WHERE o.status = 'paid') AS orders_paid,
    COALESCE(SUM(o.total_cents) FILTER (WHERE o.status = 'paid'), 0)::BIGINT AS revenue_cents
  FROM telegram_bots tb
  LEFT JOIN orders o
    ON o.origin_promotional_bot_id = tb.id
    AND o.created_at > NOW() - (days || ' days')::INTERVAL
  WHERE tb.is_promotional = TRUE
  GROUP BY tb.id, tb.username, tb.custom_display_name, tb.promotional_start_count
  ORDER BY starts_count DESC;
$$;

COMMENT ON FUNCTION promotional_bots_analytics IS
  'Dashboard admin: starts/orders/revenue por bot promocional nos últimos N dias.';
