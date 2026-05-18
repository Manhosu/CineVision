import toast from 'react-hot-toast';

/** Nome do CustomEvent disparado quando o acesso a um conteúdo está pronto. */
export const TELEGRAM_ACCESS_EVENT = 'cv:access-ready';

/** Payload do `TELEGRAM_ACCESS_EVENT`. */
export interface TelegramAccessDetail {
  /** Link de convite do grupo do filme/série no Telegram. */
  link: string;
  /** true = o bot também mandou o link no Telegram do cliente. */
  sentToTelegram: boolean;
}

/** Dispara o evento que abre o modal global de acesso (`TelegramAccessModal`). */
function emitTelegramAccess(detail: TelegramAccessDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<TelegramAccessDetail>(TELEGRAM_ACCESS_EVENT, { detail }),
  );
}

/**
 * Dispara o acesso a um conteúdo comprado (botão "Assistir").
 *
 * Igor (17/05) — "tela branca about:blank" + "precisa tocar 3-4x": o fix
 * anterior abria `window.open` cego e dependia de "user activation". Agora
 * chama `POST /api/v1/telegrams/send-access/:contentId` — o bot envia os
 * links no Telegram do cliente e o backend devolve o link do grupo.
 *
 * Igor (17/05, parte 2) — o leigo não percebia o toast de sucesso e ficava
 * clicando, achando que o site travou. Por isso, no sucesso, em vez de
 * toast/redirect, disparamos o evento `cv:access-ready` → o
 * `TelegramAccessModal` (montado no layout) abre um modal central com um
 * botão grande que leva direto ao grupo no Telegram.
 *
 * @param contentId  id do conteúdo comprado
 * @param _groupRef  mantido por compatibilidade de assinatura — não usado
 * @param options    `fallbackToast` opcional pra mensagem de erro genérica
 * @returns true se o acesso foi liberado; false em erro.
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

    // Sucesso: o backend devolve o link do grupo nos dois casos — quando o
    // bot já mandou no Telegram (`sent: true`) e quando o cliente não tem
    // Telegram vinculado. Abre o modal central com o botão direto pro grupo.
    if (data.link) {
      toast.dismiss(loadingId);
      emitTelegramAccess({ link: data.link, sentToTelegram: !!data.sent });
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
