'use client';

import { createContext, useContext, useCallback } from 'react';

// IMPORTANTE: Este contexto antes renderizava uma SEGUNDA splash com
// logo estático (1.5–5s) por cima da nova animação Framer Motion em
// CineVisionIntro.tsx. No mobile, com hidratação mais lenta, a antiga
// "comia" os primeiros segundos da nova — Igor reportou exatamente
// "uma animação antiga ou imagem estática interrompendo a nova". A
// splash agora vive 100% em CineVisionIntro; este contexto só sobra
// como compat shim (notifyContentReady) pra não quebrar consumidores
// existentes (page.tsx). Pode ser removido inteiro num próximo passo.

interface SplashContextType {
  isSplashActive: boolean;
  notifyContentReady: () => void;
}

const SplashContext = createContext<SplashContextType>({
  isSplashActive: false,
  notifyContentReady: () => {},
});

export function useSplash() {
  return useContext(SplashContext);
}

export function SplashProvider({ children }: { children: React.ReactNode }) {
  const notifyContentReady = useCallback(() => {
    // No-op — kept para compat com page.tsx, que ainda chama essa fn.
  }, []);

  return (
    <SplashContext.Provider value={{ isSplashActive: false, notifyContentReady }}>
      {children}
    </SplashContext.Provider>
  );
}
