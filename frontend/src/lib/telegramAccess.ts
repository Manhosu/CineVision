import toast from 'react-hot-toast';

/**
 * Abre o grupo do Telegram pra um conteúdo comprado.
 *
 * Igor (15/05): quando o cliente está logado, consulta o backend
 * `POST /api/v1/telegrams/access-link/:contentId`. O backend
 * (`getOrCreateAccessLinkForPurchasedContent`) valida a compra e
 * resolve sozinho: tenta o Chat ID (invite single-use 24h) e cai no
 * `telegram_group_link` como fallback.
 *
 * Igor (16/05) — BUG CRÍTICO "nada acontece ao clicar em Assistir":
 * o `window.open` rodava DEPOIS do `await fetch`. Navegadores bloqueiam
 * popups que não são abertos de forma síncrona dentro do handler de
 * clique (perde a "user activation"). Resultado: o popup era bloqueado
 * silenciosamente e nada acontecia.
 *
 * Correção: abrimos a aba IMEDIATAMENTE (síncrono, no clique), guardamos
 * a referência e só depois do fetch apontamos o `location.href` dela.
 *
 * @returns true se conseguiu abrir alguma janela; false em erro.
 */
export async function openContentGroup(
  contentId: string,
  groupRef: string | null | undefined,
  options?: { fallbackToast?: string },
): Promise<boolean> {
  // 1. Abre a aba JÁ — síncrono, dentro da user activation do clique.
  //    Sem isso, qualquer window.open após um await é bloqueado.
  const win =
    typeof window !== 'undefined' ? window.open('about:blank', '_blank') : null;

  // Helper: aponta a aba pré-aberta pro destino (ou fecha + toast no erro).
  const finish = (url?: string, errMsg?: string): boolean => {
    if (url) {
      if (win && !win.closed) {
        win.location.href = url;
      } else {
        // Aba pré-aberta foi bloqueada — tenta abrir de novo (pode falhar
        // se o usuário tiver popup blocker agressivo).
        window.open(url, '_blank', 'noopener,noreferrer');
      }
      return true;
    }
    if (win && !win.closed) win.close();
    toast.error(errMsg || 'Conteúdo indisponível no momento', { duration: 7000 });
    return false;
  };

  const token =
    typeof window !== 'undefined'
      ? localStorage.getItem('access_token') ||
        localStorage.getItem('auth_token') ||
        ''
      : '';

  // 2. Fluxo principal: logado → backend resolve tudo pelo contentId.
  if (token && contentId) {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(`${apiUrl}/api/v1/telegrams/access-link/${contentId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const data = (await res.json()) as { link?: string };
        if (data.link) return finish(data.link);
        // Resposta OK mas sem link — cai no fallback do groupRef.
        const refOk = groupRef?.trim();
        if (refOk && !/^-?\d{6,}$/.test(refOk)) return finish(refOk);
        return finish(undefined, 'Link de acesso indisponível');
      } else {
        const err = await res.json().catch(() => ({}));
        const msg = err.message || 'Não foi possível gerar acesso ao grupo';
        // Backend falhou mas há link cru no card — usa ele.
        const trimmedRef = groupRef?.trim();
        if (trimmedRef && !/^-?\d{6,}$/.test(trimmedRef)) return finish(trimmedRef);
        return finish(undefined, msg);
      }
    } catch {
      // network blip — cai pro fallback abaixo
    }
  }

  // 3. Fallback (sem login ou backend indisponível): abre o link cru.
  const trimmed = groupRef?.trim();
  if (trimmed && !/^-?\d{6,}$/.test(trimmed)) {
    return finish(trimmed);
  }

  return finish(undefined, options?.fallbackToast);
}
