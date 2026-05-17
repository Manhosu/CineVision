import toast from 'react-hot-toast';

/**
 * Dispara o acesso a um conteúdo comprado (botão "Assistir").
 *
 * Igor (17/05) — BUG "tela branca about:blank" + "precisa tocar 3-4x":
 * o fix anterior abria `window.open('about:blank')` síncrono no clique e
 * depois apontava `win.location.href` pro link após o `await fetch`. Em
 * mobile (Safari iOS) a aba branca abria mas o redirecionamento posterior
 * não colava de forma confiável → tela branca travada. Cada toque extra
 * do usuário abria outra aba branca.
 *
 * Correção (Igor pediu): o "Assistir" não abre mais aba nenhuma. Ele chama
 * `POST /api/v1/telegrams/send-access/:contentId` e o BOT envia os links
 * de acesso (Acesso Único 24h + Acesso Fixo) direto no Telegram do cliente.
 * Sem `window.open` → sem tela branca, sem dependência de "user activation",
 * clique único funciona em qualquer celular.
 *
 * Fallback: cliente sem Telegram vinculado → o backend devolve
 * `{ sent: false, link }` e navegamos na MESMA aba (não sofre popup blocker,
 * não gera tela branca).
 *
 * @param contentId  id do conteúdo comprado
 * @param _groupRef  mantido por compatibilidade de assinatura — não usado
 * @param options    `fallbackToast` opcional pra mensagem de erro genérica
 * @returns true se o acesso foi enviado/aberto; false em erro.
 */
export async function openContentGroup(
  contentId: string,
  _groupRef?: string | null | undefined,
  options?: { fallbackToast?: string },
): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const token =
    localStorage.getItem('access_token') ||
    localStorage.getItem('auth_token') ||
    '';

  if (!token) {
    toast.error('Faça login para assistir ao conteúdo.', { duration: 6000 });
    return false;
  }

  if (!contentId) {
    toast.error(options?.fallbackToast || 'Conteúdo indisponível no momento', {
      duration: 7000,
    });
    return false;
  }

  const loadingId = toast.loading('Gerando seu acesso...');

  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
    const res = await fetch(
      `${apiUrl}/api/v1/telegrams/send-access/${contentId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(
        err.message || 'Não foi possível liberar o acesso ao conteúdo.',
        { id: loadingId, duration: 7000 },
      );
      return false;
    }

    const data = (await res.json()) as { sent?: boolean; link?: string };

    // Caminho principal: o bot mandou os links no Telegram do cliente.
    if (data.sent) {
      toast.success(
        '📲 Enviamos o acesso no seu Telegram! Abra o app pra entrar no grupo.',
        { id: loadingId, duration: 6000 },
      );
      return true;
    }

    // Cliente sem Telegram vinculado — navega na MESMA aba (sem popup
    // blocker, sem tela branca).
    if (data.link) {
      toast.dismiss(loadingId);
      window.location.href = data.link;
      return true;
    }

    toast.error('Link de acesso indisponível no momento.', {
      id: loadingId,
      duration: 7000,
    });
    return false;
  } catch {
    toast.error('Erro de conexão. Tente novamente.', {
      id: loadingId,
      duration: 7000,
    });
    return false;
  }
}
