'use client';

import { Fragment, useEffect, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, CheckCircleIcon, ClipboardDocumentIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import {
  TELEGRAM_ACCESS_EVENT,
  type TelegramAccessDetail,
} from '@/lib/telegramAccess';

/**
 * Igor (14/07): converte invite link https:// pra deep link tg:// que
 * abre direto no app do Telegram sem passar pelo DNS de t.me.
 *
 * Alguns clientes têm t.me bloqueado (ISP, extensão, antivírus, região)
 * e nunca conseguem entrar via link web. O botão tg:// contorna isso:
 * abre o app instalado diretamente com o convite.
 *
 * Formatos aceitos:
 *   - https://t.me/+HASH          → tg://join?invite=HASH
 *   - https://t.me/joinchat/HASH  → tg://join?invite=HASH
 *   - https://t.me/USERNAME       → tg://resolve?domain=USERNAME
 * Retorna null se não conseguir extrair (mostra só o link web).
 */
function toTgDeepLink(link: string): string | null {
  if (!link) return null;
  // t.me/+HASH ou telegram.me/+HASH
  const plusMatch = link.match(/(?:https?:\/\/)?(?:t|telegram)\.me\/\+([A-Za-z0-9_-]+)/i);
  if (plusMatch) return `tg://join?invite=${plusMatch[1]}`;
  // t.me/joinchat/HASH (formato legado)
  const joinChatMatch = link.match(/(?:https?:\/\/)?(?:t|telegram)\.me\/joinchat\/([A-Za-z0-9_-]+)/i);
  if (joinChatMatch) return `tg://join?invite=${joinChatMatch[1]}`;
  // t.me/USERNAME (canal/grupo público)
  const userMatch = link.match(/(?:https?:\/\/)?(?:t|telegram)\.me\/([A-Za-z0-9_]+)$/i);
  if (userMatch) return `tg://resolve?domain=${userMatch[1]}`;
  return null;
}

/**
 * Modal global de acesso ao conteúdo (Igor 17/05).
 *
 * Antes, ao clicar "Assistir" num filme comprado, o site só mostrava um
 * toast — o usuário leigo não percebia, ficava clicando e abria chamado
 * dizendo que o site "não atualiza". Agora o `openContentGroup` dispara o
 * evento `cv:access-ready` e este modal (montado uma única vez no layout)
 * abre no centro da tela com um botão grande que leva direto ao grupo do
 * filme no Telegram — entregando o acesso "de mão beijada".
 *
 * O clique no botão acontece dentro de um gesto do usuário (não é popup
 * pós-`await`), então abre de forma confiável, sem tela branca.
 */
/**
 * Igor (14/07): normaliza o link do grupo pra sempre ter https://.
 *
 * Bug reportado: Igor cadastrou `telegram_group_link = "t.me/+QzRJMwb9tZM..."`
 * no admin sem o `https://`. O <a href="t.me/+xxx"> do modal era tratado
 * pelo Chrome como URL relativa E — em alguns casos — tentava resolver
 * "t.me/+xxx" como hostname → DNS_PROBE_FINISHED_NXDOMAIN. Cliente que
 * comprou não conseguia entrar no grupo.
 *
 * Sanitização defensiva: se falta protocolo, prefixa https://. Trim
 * remove whitespace/newline que podem ter vindo colados no admin.
 */
function normalizeTelegramLink(raw: string): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  // Já tem protocolo válido
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  // tg:// (protocolo do app Telegram Desktop) — mantém
  if (/^tg:\/\//i.test(trimmed)) return trimmed;
  // Prefixa https:// pra qualquer outra coisa (t.me/+xxx, telegram.me/xxx, etc.)
  return `https://${trimmed}`;
}

export function TelegramAccessModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [link, setLink] = useState('');
  const [sentToTelegram, setSentToTelegram] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<TelegramAccessDetail>).detail;
      if (!detail?.link) return;
      setLink(normalizeTelegramLink(detail.link));
      setSentToTelegram(!!detail.sentToTelegram);
      setIsOpen(true);
    };
    window.addEventListener(TELEGRAM_ACCESS_EVENT, handler);
    return () => window.removeEventListener(TELEGRAM_ACCESS_EVENT, handler);
  }, []);

  const close = () => setIsOpen(false);
  const tgDeepLink = toTgDeepLink(link);

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-[60]" onClose={close}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-dark-900 border border-white/10 p-6 text-left align-middle shadow-2xl transition-all">
                {/* Close button */}
                <button
                  onClick={close}
                  className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
                  aria-label="Fechar"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>

                {/* Icon */}
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/30">
                  <CheckCircleIcon className="h-9 w-9 text-emerald-400" />
                </div>

                {/* Title */}
                <Dialog.Title
                  as="h3"
                  className="text-xl font-bold text-white text-center mt-4 mb-2"
                >
                  Acesso liberado!
                </Dialog.Title>

                {/* Description */}
                <Dialog.Description className="text-sm text-gray-400 text-center mb-5">
                  Seu acesso ao conteúdo está pronto. Escolha uma das opções abaixo:
                  {sentToTelegram && (
                    <span className="block mt-2 text-gray-500">
                      Também enviamos o link no seu Telegram.
                    </span>
                  )}
                </Dialog.Description>

                {/* CTA principal — link web (t.me/+xxx). Abre no navegador,
                    que redireciona pro app se instalado. */}
                <a
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={close}
                  className="w-full flex items-center justify-center gap-2 bg-[#229ED9] hover:bg-[#1c87bb] text-white font-semibold text-base py-3.5 rounded-xl transition-colors"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.18 13.402l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.968.957z" />
                  </svg>
                  Entrar no Grupo no Telegram
                </a>

                {/* Igor (14/07): fallbacks pra clientes com t.me bloqueado
                    (ISP, extensão, antivírus). tg:// não passa por DNS de
                    t.me — vai direto pro app instalado. */}
                {tgDeepLink && (
                  <a
                    href={tgDeepLink}
                    onClick={close}
                    className="w-full mt-2 flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 text-white font-medium text-sm py-3 rounded-xl transition-colors border border-white/10"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.18 13.402l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.968.957z" />
                    </svg>
                    Abrir no App do Telegram
                  </a>
                )}

                {/* Copiar link — último recurso: colar manualmente no
                    Telegram (busca ou navegador embutido). */}
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(link);
                      toast.success('Link copiado! Cole no Telegram.', { duration: 4000 });
                    } catch {
                      toast.error('Não foi possível copiar. Selecione o link manualmente.');
                    }
                  }}
                  className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 text-sm text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <ClipboardDocumentIcon className="w-4 h-4" />
                  Copiar link
                </button>

                {/* Aviso pequeno pra ajudar quem tá com problema */}
                <p className="mt-3 text-[11px] text-gray-500 text-center leading-relaxed">
                  Se o primeiro botão não abrir, tente <strong>&quot;Abrir no App&quot;</strong> ou copie o link e cole no Telegram.
                </p>

                {/* Fechar */}
                <button
                  onClick={close}
                  className="w-full mt-3 py-2 text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                  Fechar
                </button>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
