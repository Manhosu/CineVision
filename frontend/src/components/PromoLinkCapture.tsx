'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

/**
 * Igor (04/07): captura origem "bot promocional" na URL e grava em
 * sessionStorage. Depois, o botão "Comprar" no ContentHero consulta
 * esse storage — se veio de bot promocional, desvia pra bot oficial
 * via rotação (Cenário 1) em vez de gerar PIX no site.
 *
 * Query params esperados: ?promo_bot=<username>&promo_content=<uuid>.
 *
 * Session storage é usado (não localStorage) pra origem NÃO persistir
 * entre abas/dias — cliente que voltou uma semana depois é tratado como
 * origem direta (não queremos que a origem promocional "pegue" pra sempre).
 */
export default function PromoLinkCapture() {
  const searchParams = useSearchParams();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const promoBot = searchParams?.get('promo_bot');
    const promoContent = searchParams?.get('promo_content');
    if (promoBot) {
      try {
        sessionStorage.setItem('cv_promo_bot', promoBot);
        sessionStorage.setItem('cv_promo_at', String(Date.now()));
        if (promoContent) sessionStorage.setItem('cv_promo_content', promoContent);
      } catch {
        // sessionStorage bloqueado (browser incógnito antigo etc) — silencioso.
      }
    }
  }, [searchParams]);

  return null;
}
