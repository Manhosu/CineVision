-- ============================================================================
-- Add customer_whatsapp to orders
-- ============================================================================
-- Igor pediu: pra clientes que pagam via web sem login (compra órfã), na
-- tela de sucesso o site captura o WhatsApp deles. Aí no painel de
-- "Compras órfãs", o admin clica num botão wa.me e vai direto na conversa
-- com a mensagem pronta — sem precisar salvar contato. Tráfego do Igor
-- vem majoritariamente do WhatsApp, então é o canal de recuperação ideal.
-- ============================================================================

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS customer_whatsapp VARCHAR(20);

CREATE INDEX IF NOT EXISTS idx_orders_orphan_whatsapp
  ON orders(paid_at DESC)
  WHERE status = 'paid' AND telegram_chat_id IS NULL;
