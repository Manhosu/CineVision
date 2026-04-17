'use client';

import { useState, useEffect } from 'react';

export function SplashScreen({ onFinished }: { onFinished: () => void }) {
  const [phase, setPhase] = useState<'logo' | 'fadeout' | 'done'>('logo');

  useEffect(() => {
    // Show logo for 1.8s, then fade out over 0.5s
    const logoTimer = setTimeout(() => setPhase('fadeout'), 1800);
    const doneTimer = setTimeout(() => {
      setPhase('done');
      onFinished();
    }, 2300);

    return () => {
      clearTimeout(logoTimer);
      clearTimeout(doneTimer);
    };
  }, [onFinished]);

  if (phase === 'done') return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-black transition-opacity duration-500 ${
        phase === 'fadeout' ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div className="flex flex-col items-center gap-8 animate-splash-in">
        {/* Logo CineVision */}
        <img
          src="/CINEVT.png"
          alt="CineVision"
          className="w-64 md:w-80 lg:w-96 drop-shadow-[0_0_40px_rgba(220,38,38,0.4)]"
        />

        {/* Loading bar */}
        <div className="w-48 h-0.5 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full bg-red-600 rounded-full animate-splash-bar" />
        </div>
      </div>
    </div>
  );
}
