'use client';

import { useState, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface WhatsAppNumberGateProps {
  userId: string;
  hasWhatsapp: boolean;
  onSaved: (digits: string) => void;
  children: ReactNode;
  /**
   * Quando true, mostra um botão "Pular por enquanto" e um X.
   * Por default true porque Igor reportou que o gate sem fechar bloqueava
   * usuários quando a request falhava silenciosamente.
   */
  dismissible?: boolean;
}

// Gate que pede o WhatsApp pessoal antes de liberar o dashboard. Vira
// canal de recuperação se o Telegram falhar (banido, perdeu acesso).
// Pode ser dispensado (Igor 06/05): user fica sem o canal de
// recuperação, mas não fica preso no popup se a request bugar.
export function WhatsAppNumberGate({
  userId,
  hasWhatsapp,
  onSaved,
  children,
  dismissible = true,
}: WhatsAppNumberGateProps) {
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  // Self-managed close state. O gate se fecha sozinho quando o save
  // dá certo OU quando o user clica em "pular", sem depender do
  // parent re-renderizar com hasWhatsapp atualizado.
  const [dismissed, setDismissed] = useState(false);

  if (hasWhatsapp || dismissed) {
    return <>{children}</>;
  }

  const handleSave = async () => {
    const digits = value.replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 13) {
      toast.error('Informe um WhatsApp válido (ex: 21 99828-0890)');
      return;
    }
    setSaving(true);
    try {
      const token =
        localStorage.getItem('access_token') || localStorage.getItem('auth_token');
      const response = await fetch(`${API_URL}/api/v1/users/${userId}/whatsapp`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ whatsapp: digits }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.message || 'Falha ao salvar WhatsApp');
      }

      // Atualiza o blob `user` no localStorage pra evitar mostrar
      // o gate de novo na próxima visita até o servidor confirmar.
      const userStr = localStorage.getItem('user');
      if (userStr) {
        try {
          const userData = JSON.parse(userStr);
          userData.whatsapp = digits;
          localStorage.setItem('user', JSON.stringify(userData));
        } catch {
          // ignora parse errors — o backend é a fonte da verdade
        }
      }

      toast.success('WhatsApp salvo!');
      // Self-close — não depende do parent atualizar hasWhatsapp.
      // Igor (06/05): "ao cadastrar o whatsapp nada acontece" —
      // bug era exatamente o gate não se fechar após save.
      setDismissed(true);
      onSaved(digits);
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao salvar WhatsApp');
    } finally {
      setSaving(false);
    }
  };

  // Igor (06/05): "não tem opção de fechar". Pular guarda flag
  // local na sessão pra não reabrir nesta sessão; servidor continua
  // sem WhatsApp e o gate volta a aparecer no próximo login.
  const handleSkip = () => {
    try {
      sessionStorage.setItem('whatsapp_gate_skipped', '1');
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  return (
    <>
      {/* Renderiza children por baixo desfocado pra não dar tela
          em branco enquanto o gate está aberto. */}
      <div className="pointer-events-none opacity-20 blur-sm select-none" aria-hidden="true">
        {children}
      </div>

      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-[9999] overflow-y-auto bg-black/85 backdrop-blur-sm p-2 sm:p-4 flex items-start sm:items-center justify-center"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300, delay: 0.1 }}
            className="bg-[#1a1a2e] border border-gray-700/50 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden my-2 sm:my-auto relative"
          >
            <div className="h-2 bg-gradient-to-r from-[#25D366] to-[#128C7E]" />

            {/* Botão X de fechar — Igor (06/05): "não tem opção de fechar". */}
            {dismissible && (
              <button
                onClick={handleSkip}
                disabled={saving}
                aria-label="Fechar"
                className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 text-zinc-300 hover:text-white flex items-center justify-center transition-colors disabled:opacity-40"
              >
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            )}

            <div className="p-4 sm:p-8">
              <div className="flex flex-col items-center text-center mb-4 sm:mb-6">
                <div className="w-12 h-12 sm:w-20 sm:h-20 bg-[#25D366] rounded-full flex items-center justify-center shadow-xl shadow-[#25D366]/30 mb-2 sm:mb-4">
                  <svg className="w-7 h-7 sm:w-11 sm:h-11 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                </div>
                <h2 className="text-lg sm:text-2xl font-bold text-white mb-1 sm:mb-2 px-6 sm:px-0">
                  Cadastre seu WhatsApp
                </h2>
                <p className="text-gray-300 text-xs sm:text-sm leading-relaxed max-w-sm">
                  Pra finalizar seu cadastro e liberar o acesso, precisamos do seu número de
                  WhatsApp. Usamos só para te avisar de pedidos e dar suporte caso o Telegram
                  falhe.
                </p>
              </div>

              <div className="bg-[#12122a] rounded-xl p-3 sm:p-5 mb-3 sm:mb-6">
                <label htmlFor="user-whatsapp" className="mb-1.5 sm:mb-2 block text-xs sm:text-sm font-semibold text-white">
                  Seu WhatsApp
                </label>
                <input
                  id="user-whatsapp"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder="(21) 99828-0890"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  disabled={saving}
                  className="w-full rounded-lg border border-white/10 bg-black px-3 py-2.5 sm:py-3 text-sm sm:text-base text-white placeholder-zinc-600 focus:border-[#25D366] focus:outline-none disabled:opacity-50"
                />
                <p className="mt-1.5 sm:mt-2 text-[11px] sm:text-xs text-zinc-400">
                  Inclua DDD. Não compartilhamos com ninguém.
                </p>
              </div>

              <button
                onClick={handleSave}
                disabled={saving || !value.trim()}
                className="w-full py-3 sm:py-3.5 px-4 bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-[#25D366]/25 text-sm sm:text-base disabled:cursor-wait disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Salvando...
                  </>
                ) : (
                  'Salvar e continuar'
                )}
              </button>

              {dismissible && (
                <button
                  onClick={handleSkip}
                  disabled={saving}
                  className="w-full mt-2 sm:mt-3 py-2 px-4 text-xs sm:text-sm text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-40"
                >
                  Pular por enquanto
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </>
  );
}
