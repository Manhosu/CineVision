import toast from 'react-hot-toast';

/**
 * Abre o grupo do Telegram pra um conteúdo comprado, escolhendo
 * automaticamente entre dois fluxos:
 *
 * - Se `groupRef` for um link (`https://t.me/...`, `@username`),
 *   abre direto. Comportamento legado, mantido pros conteúdos do
 *   catálogo que ainda não foram migrados pra Chat ID numérico.
 *
 * - Se `groupRef` for um Chat ID numérico (`-1001234567890`), chama
 *   o backend que valida ownership e gera invite single-use de 24h
 *   via Bot API. Cliente entra uma vez, link queima.
 *
 * Igor pediu (04/05) que a migração de link → Chat ID seja gradual,
 * conteúdo por conteúdo. Esse helper faz a detecção pra cada item
 * sem exigir flag global.
 *
 * @returns true se conseguiu abrir alguma janela; false em erro.
 */
export async function openContentGroup(
  contentId: string,
  groupRef: string | null | undefined,
  options?: { fallbackToast?: string },
): Promise<boolean> {
  const trimmed = groupRef?.trim();
  if (!trimmed) {
    toast.error(options?.fallbackToast || 'Conteúdo indisponível no momento');
    return false;
  }

  const isChatId = /^-?\d{6,}$/.test(trimmed);

  if (!isChatId) {
    // Link cru — abre direto (comportamento legado).
    window.open(trimmed, '_blank');
    return true;
  }

  // Chat ID — backend gera invite single-use 24h.
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
    const token =
      typeof window !== 'undefined'
        ? localStorage.getItem('access_token') ||
          localStorage.getItem('auth_token') ||
          ''
        : '';

    if (!token) {
      toast.error('Faça login pra acessar o grupo');
      return false;
    }

    const res = await fetch(`${apiUrl}/api/v1/telegrams/access-link/${contentId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      // N5 — backend devolve mensagem específica quando bot não foi
      // adicionado ao grupo (Chat ID válido mas createChatInviteLink
      // falhou). Toast longa pra Igor ler até o fim.
      const msg = err.message || 'Não foi possível gerar acesso ao grupo';
      toast.error(msg, { duration: 7000 });
      return false;
    }

    const data = (await res.json()) as { link: string };
    if (!data.link) {
      toast.error('Link indisponível');
      return false;
    }

    window.open(data.link, '_blank');
    return true;
  } catch (err: any) {
    toast.error(err?.message || 'Erro ao gerar acesso ao grupo');
    return false;
  }
}
