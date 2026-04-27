'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const SESSION_KEY = 'cv_intro_played';
const INTRO_DURATION_MS = 2400;

export default function CineVisionIntro() {
  const [visible, setVisible] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (sessionStorage.getItem(SESSION_KEY)) return;

    setVisible(true);
    sessionStorage.setItem(SESSION_KEY, '1');

    const t = setTimeout(() => setVisible(false), INTRO_DURATION_MS);

    // Try playing audio; browsers may block unless muted
    const audio = audioRef.current;
    if (audio) {
      audio.volume = 0.6;
      audio.play().catch(() => {
        // Autoplay blocked — silent fallback is fine
      });
    }

    return () => clearTimeout(t);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black"
          aria-hidden="true"
        >
          <motion.div
            initial={{ scale: 0.25, opacity: 0 }}
            animate={{ scale: [0.25, 1.15, 1], opacity: [0, 1, 1] }}
            transition={{
              duration: 1.6,
              times: [0, 0.75, 1],
              ease: 'easeOut',
            }}
            className="relative flex flex-col items-center gap-4"
          >
            <img
              src="/CINEVT.png"
              alt="Cine Vision"
              className="h-28 w-auto md:h-40"
              style={{ filter: 'drop-shadow(0 0 24px rgba(239,68,68,0.55))' }}
            />
            <div
              className="text-4xl md:text-6xl font-black tracking-tight"
              style={{
                background: 'linear-gradient(135deg,#e11d48 0%,#dc2626 45%,#b91c1c 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                filter: 'drop-shadow(0 0 24px rgba(239,68,68,0.7))',
              }}
            >
              CINE VISION
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.6, 0] }}
            transition={{ duration: 2, delay: 0.3 }}
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(circle at center, rgba(239,68,68,0.25) 0%, transparent 60%)',
            }}
          />

          <audio ref={audioRef} src="/intro.mp3" preload="auto" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
