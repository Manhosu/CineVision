-- Igor (07/05): separar Chat ID numérico do link de convite t.me/+
-- pra suportar fallback automático quando o bot não é admin do grupo.
--
-- ANTES: coluna única `telegram_group_link` aceitava ambos formatos
-- (link cru `https://t.me/+...` OU Chat ID `-100xxxxxxxxx`). Quando
-- admin trocava o link pelo Chat ID e o bot não era admin do grupo,
-- o usuário tomava erro 400 "bot precisa ser admin" sem fallback.
--
-- AGORA: colunas separadas:
--   - telegram_chat_id: Chat ID numérico (opcional, pra invite single-use)
--   - telegram_group_link: link de convite regular (t.me/+, fallback)
--
-- Lógica do backend (getOrCreateAccessLinkForPurchasedContent):
--   1. Se telegram_chat_id set → tenta createChatInviteLink via Bot API.
--   2. Se sucesso → invite single-use 24h.
--   3. Se falha (bot não admin) OU sem chat_id → cai pra telegram_group_link.
--   4. Sem nenhum dos 2 → erro "conteúdo sem grupo configurado".
--
-- Migração de dados: NÃO automática. Rows existentes com Chat ID em
-- `telegram_group_link` continuam funcionando (frontend detecta o
-- formato e o backend trata como antes). Igor edita manualmente os 3
-- conteúdos com Chat ID atual via /admin/content/manage pra mover o
-- valor pro novo campo e cadastrar o link de convite regular.

ALTER TABLE content
ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;

COMMENT ON COLUMN content.telegram_chat_id IS
'Chat ID numérico do grupo do Telegram (ex: -1001234567890). Usado pelo bot pra gerar invite single-use de 24h via Bot API. Requer bot como admin do grupo. Opcional — se vazio, o sistema usa telegram_group_link como link direto.';

COMMENT ON COLUMN content.telegram_group_link IS
'Link de convite do grupo do Telegram (formato https://t.me/+AbCdEf). Usado como fallback quando telegram_chat_id está vazio OU quando o bot não consegue gerar invite single-use (não é admin). Pode também aceitar Chat ID legado pra compat — mas o caminho recomendado é separar Chat ID em telegram_chat_id.';
