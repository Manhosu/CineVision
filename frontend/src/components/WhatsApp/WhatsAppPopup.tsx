'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const WHATSAPP_LINK = 'https://chat.whatsapp.com/CK5DVQUWQqG3WRrDgjTbgy';
const DISMISS_KEY = 'whatsapp_popup_dismissed';
const SHOW_DELAY_MS = 3000;

export function WhatsAppPopup() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Usar sessionStorage para mostrar uma vez por sessao (aparece toda vez que abrir o site)
    const dismissed = sessionStorage.getItem(DISMISS_KEY);
    if (dismissed) return;

    // Wait for splash screen to finish before showing popup
    const checkSplash = () => {
      const splashDone = sessionStorage.getItem('splash_shown');
      if (splashDone) {
        const timer = setTimeout(() => setIsVisible(true), SHOW_DELAY_MS);
        return () => clearTimeout(timer);
      }
      // Splash still showing — check again shortly
      const retry = setTimeout(checkSplash, 500);
      return () => clearTimeout(retry);
    };

    const cleanup = checkSplash();
    return () => { if (cleanup) cleanup(); };
  }, []);

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, 'true');
    setIsVisible(false);
  };

  const handleJoinGroup = () => {
    window.open(WHATSAPP_LINK, '_blank');
    handleDismiss();
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-[9998]"
            onClick={handleDismiss}
          />

          {/* Popup */}
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 40 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="bg-[#1a1a2e] border border-gray-700/50 rounded-2xl shadow-2xl max-w-md w-full pointer-events-auto relative overflow-hidden">
              {/* Green accent bar */}
              <div className="h-1.5 bg-gradient-to-r from-[#25D366] to-[#128C7E]" />

              {/* Close button */}
              <button
                onClick={handleDismiss}
                className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors z-10"
                aria-label="Fechar"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <div className="p-6 pt-5">
                {/* WhatsApp Icon */}
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-14 h-14 bg-[#25D366] rounded-full flex items-center justify-center shadow-lg shadow-[#25D366]/20">
                    <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Não perca nenhuma novidade!</h2>
                    <p className="text-[#25D366] text-sm font-medium">Comunidade Cine Vision</p>
                  </div>
                </div>

                {/* Description */}
                <p className="text-gray-300 text-sm mb-5 leading-relaxed">
                  Entre na nossa comunidade do WhatsApp e receba promoções relâmpago, lançamentos exclusivos e descontos especiais direto no seu celular!
                </p>

                {/* Benefits */}
                <div className="space-y-3 mb-6">
                  {[
                    { icon: '⚡', text: 'Promoções relâmpago antes de todo mundo' },
                    { icon: '🎬', text: 'Novos filmes e séries em primeira mão' },
                    { icon: '💰', text: 'Descontos exclusivos para membros' },
                    { icon: '🎁', text: 'Sorteios e conteúdos gratuitos' },
                  ].map((benefit, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-lg">{benefit.icon}</span>
                      <span className="text-gray-200 text-sm">{benefit.text}</span>
                    </div>
                  ))}
                </div>

                {/* Buttons */}
                <div className="space-y-3">
                  <button
                    onClick={handleJoinGroup}
                    className="w-full py-3 px-4 bg-[#25D366] hover:bg-[#20bd5a] text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-[#25D366]/20"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                    Entrar na comunidade
                  </button>
                  <button
                    onClick={handleDismiss}
                    className="w-full py-2.5 px-4 text-gray-400 hover:text-gray-200 text-sm font-medium transition-colors"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
