-- ============================================================================
-- Add whatsapp to users
-- ============================================================================
-- Igor pediu: dashboard do usuário Telegram-logado tem que pedir o WhatsApp
-- pessoal de forma obrigatória. Vira fonte de contato secundária para
-- recuperação manual quando o Telegram falha (banido, perdeu acesso, não
-- abriu mensagem). Diferente de `whatsapp_joined` (boolean — entrou no
-- grupo) e de `phone` (campo genérico que pode estar usado para outras
-- coisas no projeto): coluna nova, dedicada, validada como número.
-- ============================================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS whatsapp VARCHAR(20);
