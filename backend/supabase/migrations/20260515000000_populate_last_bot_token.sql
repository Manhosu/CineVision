-- Igor (15/05): popular last_bot_token nos usuários elegíveis para broadcast.
-- Antes, o código nunca setava esse campo no /start, então o filtro do
-- broadcast (eq.last_bot_token=botAtual) excluía a maioria. Aplicado em
-- produção via script Node antes do commit; arquivo aqui é histórico.
--
-- Substituir <BOT_TOKEN> pelo valor real ao reaplicar localmente.

-- UPDATE users
--   SET last_bot_token = '<BOT_TOKEN>'
--   WHERE telegram_chat_id IS NOT NULL
--     AND blocked = false
--     AND (last_bot_token IS NULL OR last_bot_token != '<BOT_TOKEN>');

-- Migração foi aplicada em 2026-05-15 com bot atual (sufixo ...hHlf74).
-- Resultado: 105168 linhas atualizadas. Total elegíveis agora: 105782.
SELECT 'Migration applied via Node script — see git history.' AS note;
