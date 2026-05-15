import toast from 'react-hot-toast';

/**
 * Abre o grupo do Telegram pra um conteúdo comprado.
 *
 * Igor (15/05): bug crítico — antes esse helper decidia o fluxo pelo
 * `groupRef` que o card passava (`movie.telegram_group_link`). Filmes
 * cadastrados com ID do bot (`telegram_chat_id` preenchido, sem
 * `telegram_group_link`) chegavam aqui com `groupRef` vazio → caía em
 * "Conteúdo indisponível" e o cliente não conseguia assistir.
 *
 * Correção: quando o cliente está logado, SEMPRE consulta o backend
 * `POST /api/v1/telegrams/access-link/:contentId`. O backend
 * (`getOrCreateAccessLinkForPurchasedContent`) valida a compra e
 * resolve sozinho: tenta o Chat ID (invite single-use 24h) e cai no
 * `telegram_group_link` como fallback. O `groupRef` do frontend deixa
 * de ser decisivo — vira só fallback pra quem não está logado.
 *
 * @returns true se conseguiu abrir alguma janela; false em erro.
 */
export async function openContentGroup(
  contentId: string,
  groupRef: string | null | undefined,
  options?: { fallbackToast?: string },
): Promise<boolean> {
  const token =
    typeof window !== 'undefined'
      ? localStorage.getItem('access_token') ||
        localStorage.getItem('auth_token') ||
        ''
      : '';

  // Fluxo principal: logado → backend resolve tudo pelo contentId.
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
        if (data.link) {
          window.open(data.link, '_blank');
          return true;
        }
      } else {
        const err = await res.json().catch(() => ({}));
        const msg = err.message || 'Não foi possível gerar acesso ao grupo';
        // Se o backend falhou mas temos um link cru no card, tenta ele.
        const trimmedRef = groupRef?.trim();
        if (trimmedRef && !/^-?\d{6,}$/.test(trimmedRef)) {
          window.open(trimmedRef, '_blank');
          return true;
        }
        toast.error(msg, { duration: 7000 });
        return false;
      }
    } catch {
      // network blip — cai pro fallback abaixo
    }
  }

  // Fallback (sem login ou backend indisponível): abre o link cru.
  const trimmed = groupRef?.trim();
  if (trimmed && !/^-?\d{6,}$/.test(trimmed)) {
    window.open(trimmed, '_blank');
    return true;
  }

  toast.error(options?.fallbackToast || 'Conteúdo indisponível no momento');
  return false;
}
