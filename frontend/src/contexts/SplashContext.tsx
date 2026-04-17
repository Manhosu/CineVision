'use client';

import { createContext, useContext, useState, useCallback, useEffect } from 'react';

interface SplashContextType {
  /** Whether splash is currently showing */
  isSplashActive: boolean;
  /** Call this when your content has finished loading */
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
  const [isSplashActive, setIsSplashActive] = useState(false);
  const [contentReady, setContentReady] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && !sessionStorage.getItem('splash_shown')) {
      setIsSplashActive(true);
    }
  }, []);

  const notifyContentReady = useCallback(() => {
    setContentReady(true);
  }, []);

  const handleSplashDone = useCallback(() => {
    setIsSplashActive(false);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('splash_shown', '1');
    }
  }, []);

  return (
    <SplashContext.Provider value={{ isSplashActive, notifyContentReady }}>
      {isSplashActive && (
        <SplashOverlay contentReady={contentReady} onDone={handleSplashDone} />
      )}
      {children}
    </SplashContext.Provider>
  );
}

/**
 * Splash overlay:
 * - Shows for minimum 1.5s (so animation looks good)
 * - Waits for contentReady signal
 * - Once BOTH conditions met, fades out
 */
function SplashOverlay({
  contentReady,
  onDone,
}: {
  contentReady: boolean;
  onDone: () => void;
}) {
  const [minTimePassed, setMinTimePassed] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  // Minimum display time
  useEffect(() => {
    const timer = setTimeout(() => setMinTimePassed(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  // When both ready, start fade out
  useEffect(() => {
    if (minTimePassed && contentReady && !fadeOut) {
      setFadeOut(true);
      const timer = setTimeout(onDone, 500); // fade duration
      return () => clearTimeout(timer);
    }
  }, [minTimePassed, contentReady, fadeOut, onDone]);

  // Safety: max 5s splash even if content never signals ready
  useEffect(() => {
    const maxTimer = setTimeout(() => {
      setFadeOut(true);
      setTimeout(onDone, 500);
    }, 5000);
    return () => clearTimeout(maxTimer);
  }, [onDone]);

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-black transition-opacity duration-500 ${
        fadeOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <div className="flex flex-col items-center gap-8 animate-splash-in">
        <img
          src="/CINEVT.png"
          alt="CineVision"
          className="w-64 md:w-80 lg:w-96 drop-shadow-[0_0_40px_rgba(220,38,38,0.4)]"
        />
      </div>
    </div>
  );
}
