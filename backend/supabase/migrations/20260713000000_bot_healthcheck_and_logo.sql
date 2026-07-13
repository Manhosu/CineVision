-- Igor (13/07): 2 conjuntos de mudanças pra resolver problemas críticos.

-- =====================================================================
-- 1) Rastreio de webhook em telegram_bots
-- =====================================================================
--
-- Bug crítico: bots novos criados via /admin/bots não estavam respondendo
-- /start. Root cause: createBot só INSERTa no banco, o setupWebhook é
-- feito só se admin clica "OK" num confirm() do browser. Igor clicou
-- Cancelar (ou popup bloqueado) → webhook nunca configurado →
-- Telegram não envia updates → nenhum user cadastrado, contador zerado.
--
-- Fix: createBot passa a chamar setupWebhook automaticamente. Rastreamos:
--   - webhook_configured_at: última vez que setWebhook rodou com sucesso
--   - webhook_url_reported: URL retornada por getWebhookInfo (compara
--     com a esperada pra detectar mismatch)
--   - last_webhook_check_at: última vez que o cron rodou healthcheckDeep
--
-- Novo cron (a cada 5min) valida getMe + getWebhookInfo em TODOS os
-- bots ativos, atualiza os 3 campos e alimenta painel visual (indicador
-- verde/vermelho por bot).

ALTER TABLE telegram_bots
  ADD COLUMN IF NOT EXISTS webhook_configured_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS webhook_url_reported TEXT,
  ADD COLUMN IF NOT EXISTS last_webhook_check_at TIMESTAMPTZ;

COMMENT ON COLUMN telegram_bots.webhook_configured_at IS
  'Igor (13/07): última vez que setupWebhook rodou com sucesso. NULL = webhook nunca configurado. Preenchido automaticamente por createBot e pelo botão "Configurar TODOS os webhooks".';
COMMENT ON COLUMN telegram_bots.webhook_url_reported IS
  'Igor (13/07): URL retornada por getWebhookInfo no último healthcheck. Comparada com ${BACKEND}/api/v1/telegrams/webhook/${id} pra detectar mismatch (bot ativo mas webhook apontando pra outro lugar).';
COMMENT ON COLUMN telegram_bots.last_webhook_check_at IS
  'Igor (13/07): última vez que healthcheckDeep rodou (cron 5min). Alimenta indicador visual do painel.';

-- =====================================================================
-- 2) Logo PNG oficial do filme (opcional)
-- =====================================================================
--
-- Feature nova: Igor quer poder cadastrar uma imagem PNG oficial do
-- título do filme (fonte estilizada, ex: "Homem-Aranha: Um Novo Dia")
-- que substitua o <h1> texto no hero. Opcional — filmes antigos ficam
-- com o texto tradicional.
--
-- Suporte a posicionamento ajustável desktop/mobile (igual backdrop).
-- Fallback pro texto se logo_url NULL ou imagem falhar carregar.

ALTER TABLE content
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS logo_position VARCHAR(20) DEFAULT '50% 50%',
  ADD COLUMN IF NOT EXISTS logo_position_mobile VARCHAR(20) DEFAULT '50% 50%';

COMMENT ON COLUMN content.logo_url IS
  'Igor (13/07): PNG com nome estilizado (fonte oficial do filme). Nullable — quando NULL, hero renderiza <h1>{title}</h1> tradicional. Só filmes novos/importantes vão ter.';
COMMENT ON COLUMN content.logo_position IS
  'CSS object-position pro logo no hero (desktop). Ajustado via LogoEditor no admin.';
COMMENT ON COLUMN content.logo_position_mobile IS
  'CSS object-position pro logo no hero (mobile). Se NULL, herda de logo_position.';
