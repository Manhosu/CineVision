-- Igor (12/07): permitir criação de purchase_intents originadas no SITE
-- (não em bot oficial). Isso resolve o LOOP INFINITO no bot promo:
--
-- Antes: site montava t.me/<promo>?start=buy_<id> e o bot promo não sabia
-- processar `buy_` (só `pi_`), caía em handlePromoWelcome que mandava
-- cliente de volta pro site → loop.
--
-- Agora: site chama POST /telegrams/create-site-intent, backend cria
-- intent + retorna deeplink pi_<token>. Bot promo processa via
-- handlePurchaseIntent → gera PIX. Fim do loop.

-- 1) Aceitar origin_bot_id NULL (intent vinda do site não tem bot origem)
ALTER TABLE purchase_intents
  ALTER COLUMN origin_bot_id DROP NOT NULL;

-- 2) Aceitar origin_chat_id 0 (site não tem chat_id — usamos 0 como marca)
--    origin_chat_id era BIGINT NOT NULL DEFAULT nada, aceita 0

-- 3) Marca de procedência pra analytics distinguir bot vs site
ALTER TABLE purchase_intents
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'bot'
  CHECK (source IN ('bot', 'site'));

COMMENT ON COLUMN purchase_intents.source IS
  'Igor (12/07): origem do intent — bot (Cenário 3, cliente veio do bot oficial) ou site (cliente logado clicou Comprar no site num filme com promo vinculado).';

-- 4) Backfill: todos os intents existentes são bot (Cenário 3 legítimo)
UPDATE purchase_intents SET source = 'bot' WHERE source IS NULL;
