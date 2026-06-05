/**
 * Igor (07/06): substitui o `t.me/CineVisionApp_rbot?start=...` hardcoded.
 * O backend sorteia entre os bots ATIVOS de atendimento (com peso) e
 * retorna o deeplink correto. Distribui carga entre múltiplos bots
 * paralelos — quando um cai, o sorteio para de mandar pra ele e clientes
 * novos vão pros outros sem precisar mexer no código.
 *
 * Fallback resiliente: se o endpoint falhar ou demorar muito, devolve
 * o bot do env var legado pra UX não travar.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

const FALLBACK_USERNAME =
  process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'CineVisionBrasil_bot';

function fallbackDeeplink(startParam?: string): string {
  const base = `https://t.me/${FALLBACK_USERNAME}`;
  return startParam ? `${base}?start=${encodeURIComponent(startParam)}` : base;
}

/**
 * Resolve o deeplink t.me/<botSorteado>?start=... via backend.
 * Aceita `startParam` opcional (ex: `buy_<contentId>`, `order_<token>`).
 */
export async function getBotDeeplink(startParam?: string): Promise<string> {
  try {
    const url = startParam
      ? `${API_URL}/api/v1/telegrams/start-deeplink?start=${encodeURIComponent(startParam)}`
      : `${API_URL}/api/v1/telegrams/start-deeplink`;
    const res = await fetch(url, {
      method: 'GET',
      // Sem credenciais — endpoint público; sem cache (pra refletir
      // mudança em telegram_bots em tempo real).
      cache: 'no-store',
    });
    if (!res.ok) return fallbackDeeplink(startParam);
    const data = (await res.json()) as { url?: string };
    return data?.url || fallbackDeeplink(startParam);
  } catch {
    return fallbackDeeplink(startParam);
  }
}

/**
 * Variante "abrir em nova aba": gera deeplink e abre via window.open.
 * Conveniência para handlers onClick.
 */
export async function openBotDeeplink(startParam?: string): Promise<void> {
  const url = await getBotDeeplink(startParam);
  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
