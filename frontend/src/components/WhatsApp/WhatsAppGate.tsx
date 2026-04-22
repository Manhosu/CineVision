'use client';

import { useState, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface WhatsAppGateProps {
  userId: string;
  whatsappJoined: boolean;
  whatsappLink: string;
  onConfirmJoined: () => void;
  children: ReactNode;
}

export function WhatsAppGate({
  userId,
  whatsappJoined,
  whatsappLink,
  onConfirmJoined,
  children,
}: WhatsAppGateProps) {
  const [isConfirming, setIsConfirming] = useState(false);

  if (whatsappJoined) {
    return <>{children}</>;
  }

  const handleOpenGroup = () => {
    window.open(whatsappLink || 'https://chat.whatsapp.com/CK5DVQUWQqG3WRrDgjTbgy', '_blank');
  };

  const handleConfirmJoined = async () => {
    setIsConfirming(true);
    try {
      const token = localStorage.getItem('auth_token') || localStorage.getItem('access_token');
      const response = await fetch(`${API_URL}/api/v1/users/${userId}/whatsapp-joined`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ joined: true }),
      });

      if (response.ok) {
        // Update user data in localStorage
        const userStr = localStorage.getItem('user');
        if (userStr) {
          try {
            const userData = JSON.parse(userStr);
            userData.whatsapp_joined = true;
            localStorage.setItem('user', JSON.stringify(userData));
          } catch {
            // ignore parse errors
          }
        }
        onConfirmJoined();
      } else {
        console.error('Failed to update whatsapp_joined status');
      }
    } catch (error) {
      console.error('Error confirming WhatsApp join:', error);
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <>
      {/* Render children behind the overlay (invisible) so the page layout loads */}
      <div className="pointer-events-none opacity-20 blur-sm select-none" aria-hidden="true">
        {children}
      </div>

      {/* Blocking overlay */}
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-[9999] overflow-y-auto bg-black/85 backdrop-blur-sm p-4 flex items-start sm:items-center justify-center"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300, delay: 0.1 }}
            className="bg-[#1a1a2e] border border-gray-700/50 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden my-4 sm:my-auto"
          >
            {/* Green header bar */}
            <div className="h-2 bg-gradient-to-r from-[#25D366] to-[#128C7E]" />

            <div className="p-5 sm:p-8">
              {/* WhatsApp Icon */}
              <div className="flex flex-col items-center text-center mb-6">
                <div className="w-14 h-14 sm:w-20 sm:h-20 bg-[#25D366] rounded-full flex items-center justify-center shadow-xl shadow-[#25D366]/30 mb-3 sm:mb-4">
                  <svg className="w-8 h-8 sm:w-11 sm:h-11 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-white mb-1 sm:mb-2">
                  Bem-vindo à comunidade Cine Vision!
                </h2>
                <p className="text-gray-300 text-sm leading-relaxed max-w-sm">
                  Entre no nosso grupo do WhatsApp para receber promoções exclusivas, lançamentos em primeira mão e novidades!
                </p>
              </div>

              {/* Benefits */}
              <div className="bg-[#12122a] rounded-xl p-4 sm:p-5 mb-4 sm:mb-6 space-y-2 sm:space-y-3">
                <h3 className="text-[#25D366] font-semibold text-xs sm:text-sm uppercase tracking-wide mb-2 sm:mb-3">
                  Beneficios do grupo
                </h3>
                {[
                  { icon: '🔥', text: 'Promoções relâmpago direto no seu WhatsApp' },
                  { icon: '🎬', text: 'Lançamentos antes de todo mundo' },
                  { icon: '💰', text: 'Descontos exclusivos para membros' },
                ].map((benefit, i) => (
                  <div key={i} className="flex items-center gap-2 sm:gap-3">
                    <span className="text-sm sm:text-base">{benefit.icon}</span>
                    <span className="text-gray-200 text-xs sm:text-sm">{benefit.text}</span>
                  </div>
                ))}
              </div>

              {/* Action buttons */}
              <div className="space-y-3">
                <button
                  onClick={handleOpenGroup}
                  className="w-full py-3.5 px-4 bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-[#25D366]/25 text-base"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  Entrar no grupo do WhatsApp
                </button>

                <button
                  onClick={handleConfirmJoined}
                  disabled={isConfirming}
                  className="w-full py-3 px-4 bg-gray-700/50 hover:bg-gray-600/50 text-white font-semibold rounded-xl transition-colors border border-gray-600/50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isConfirming ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Confirmando...
                    </span>
                  ) : (
                    'Ja entrei no grupo'
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </>
  );
}
