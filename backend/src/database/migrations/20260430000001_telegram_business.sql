-- ============================================================================
-- Telegram Business: conexões + business_connection_id em orders
-- ============================================================================
-- Igor recebe 50-100 DMs/dia no Telegram pessoal (não no bot). Pra IA atender
-- automaticamente em nome dele, usamos Telegram Business — Igor (Premium)
-- conecta o @cinevisionv2bot via Settings → Business → Chatbots, autorizando
-- o bot a ler/responder os DMs.
--
-- Ao conectar/desconectar, Telegram envia o evento `business_connection` com
-- um `business_connection_id` único por conta. Esse ID é o que vamos usar
-- pra responder no canal certo via sendMessage(business_connection_id=...).
-- ============================================================================

CREATE TABLE IF NOT EXISTS telegram_business_connections (
  id TEXT PRIMARY KEY,                    -- business_connection_id do Telegram
  telegram_user_id BIGINT NOT NULL,       -- ID do dono da conta Business (Igor)
  can_reply BOOLEAN NOT NULL DEFAULT FALSE,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tbc_telegram_user
  ON telegram_business_connections(telegram_user_id);

CREATE INDEX IF NOT EXISTS idx_tbc_active
  ON telegram_business_connections(is_enabled, can_reply)
  WHERE is_enabled = TRUE AND can_reply = TRUE;

-- Coluna em `orders` pra rastrear que a venda nasceu de uma conversa via
-- Business DM. Populada quando o cliente clica num link da página de detalhes
-- enviado pela IA (via=business&bid=BCID) e segue até completar o checkout.
-- markOrderPaid usa esse campo pra entregar o filme via canal Business em
-- vez do bot direto.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS business_connection_id TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_business_conn
  ON orders(business_connection_id)
  WHERE business_connection_id IS NOT NULL;
