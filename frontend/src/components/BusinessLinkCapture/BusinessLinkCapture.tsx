'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

/**
 * Quando o cliente clica num link enviado pela IA via Telegram Business
 * (formato /movies/UUID?via=business&bid=BCID&chat=CHATID), esse componente
 * lê os query params e salva em sessionStorage. O cart store lê de lá ao
 * adicionar item, propagando bid+chat pro backend pra que a order resultante
 * tenha business_connection_id e telegram_chat_id populados — assim o
 * webhook de pagamento entrega o filme via canal Business em vez do bot direto.
 *
 * Renderiza nada — só side effect.
 */
export default function BusinessLinkCapture() {
  const params = useSearchParams();

  useEffect(() => {
    if (!params) return;
    const via = params.get('via');
    const bid = params.get('bid');
    const chat = params.get('chat');

    if (via === 'business' && bid) {
      try {
        sessionStorage.setItem('cv_business_connection_id', bid);
        if (chat) sessionStorage.setItem('cv_business_chat_id', chat);
      } catch {
        // sessionStorage pode não estar disponível em alguns embeds; ignora.
      }
    }
  }, [params]);

  return null;
}
