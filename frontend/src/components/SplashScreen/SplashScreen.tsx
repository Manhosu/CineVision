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
      <div className="flex flex-col items-center gap-6 animate-splash-in">
        {/* Logo icon */}
        <div className="relative w-20 h-20 md:w-28 md:h-28">
          <img
            src="/icons/icon.svg"
            alt="CineVision"
            className="w-full h-full drop-shadow-[0_0_30px_rgba(220,38,38,0.5)]"
          />
        </div>

        {/* Brand name */}
        <h1 className="text-3xl md:text-4xl font-bold tracking-wider text-white">
          CINE<span className="text-red-600">VISION</span>
        </h1>

        {/* Loading bar */}
        <div className="w-40 h-0.5 bg-white/10 rounded-full overflow-hidden mt-2">
          <div className="h-full bg-red-600 rounded-full animate-splash-bar" />
        </div>
      </div>
    </div>
  );
}
