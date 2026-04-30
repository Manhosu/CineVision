-- ============================================================================
-- Add business_connection_id to carts
-- ============================================================================
-- Quando o cliente clica num link da página de detalhes enviado pela IA via
-- Business DM (formato /movies/UUID?via=business&bid=BCID), o frontend lê o
-- bid e propaga pro backend ao adicionar item no carrinho. Salvamos aqui pra
-- transferir pra `orders.business_connection_id` quando o cliente fechar o
-- checkout. Isso permite que o webhook de pagamento despache a entrega via
-- Business DM (canal Igor → cliente) em vez do bot direto.
-- ============================================================================

ALTER TABLE carts
  ADD COLUMN IF NOT EXISTS business_connection_id TEXT;
