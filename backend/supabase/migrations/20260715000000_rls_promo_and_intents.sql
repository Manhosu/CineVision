-- ============================================================================
-- CRITICAL SECURITY FIX (Eduardo 15/07/2026)
-- Habilita RLS em promotional_bot_starts e purchase_intents.
--
-- Ambas as tabelas são 100% backend-only:
--   * frontend NUNCA faz .from() nelas (grep zero matches)
--   * backend acessa exclusivamente via service_role (bypassa RLS)
--   * RPCs SECURITY DEFINER (promotional_bot_metrics,
--     count_distinct_promo_users_active) continuam funcionando por definição
--
-- Sem RLS, qualquer um com NEXT_PUBLIC_SUPABASE_ANON_KEY (pública, no
-- bundle do site) conseguia rodar `supabase.from('purchase_intents').select('*')`
-- e puxar:
--   - Tokens de deeplink (pi_<token>) que geram PIX daquele valor
--   - Snapshots de preço (amount_cents)
--   - telegram_user_id (PII) de todos os clientes que iniciaram compra
--
-- E promotional_bot_starts expunha log completo de qual telegram_user_id
-- iniciou qual bot — mapa de audiência inteiro.
--
-- Advisor flagou 3 CRITICAL:
--   1) RLS Disabled — public.promotional_bot_starts
--   2) RLS Disabled — public.purchase_intents
--   3) Sensitive Columns Exposed — public.purchase_intents (cai junto com #2)
-- ============================================================================

-- CRITICAL 1: promotional_bot_starts ----------------------------------------
ALTER TABLE public.promotional_bot_starts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deny_all_anon_promo_starts" ON public.promotional_bot_starts;

CREATE POLICY "deny_all_anon_promo_starts"
  ON public.promotional_bot_starts
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

COMMENT ON POLICY "deny_all_anon_promo_starts" ON public.promotional_bot_starts IS
  'Backend-only (service_role bypassa). Anon/authenticated não devem enxergar log de starts (PII: telegram_user_id).';

-- CRITICAL 2 + 3: purchase_intents ------------------------------------------
ALTER TABLE public.purchase_intents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deny_all_anon_purchase_intents" ON public.purchase_intents;

CREATE POLICY "deny_all_anon_purchase_intents"
  ON public.purchase_intents
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

COMMENT ON POLICY "deny_all_anon_purchase_intents" ON public.purchase_intents IS
  'Backend-only (service_role bypassa). Anon/authenticated não devem enxergar tokens de PIX, snapshots de preço, nem PII de origem (Advisor: Sensitive Columns).';
