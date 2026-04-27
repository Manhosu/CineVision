'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const SESSION_KEY = 'cv_intro_played';

// Video runs ~5.88s; we hold the splash a touch longer so the final reveal
// frame doesn't snap away mid-jingle on slower decoders.
const INTRO_DURATION_MS = 6000;

// The Netflix-style jingle (4s) climaxes at the end. The video reveals the
// full logo around 5s. Starting audio ~1.7s into the video lines the
// "tudum" up with the logo reveal — the sync the user actually perceives.
const AUDIO_OFFSET_MS = 1700;

export default function CineVisionIntro() {
  const [visible, setVisible] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (sessionStorage.getItem(SESSION_KEY)) return;

    setVisible(true);
    sessionStorage.setItem(SESSION_KEY, '1');

    const hideTimer = setTimeout(() => setVisible(false), INTRO_DURATION_MS);

    // Video plays muted (browsers require muted for autoplay without
    // a user gesture). Audio is a separate <audio> element we trigger
    // delayed so the jingle's climax lands on the visual reveal.
    const video = videoRef.current;
    if (video) {
      video.play().catch(() => {
        // Autoplay blocked — splash still fades through correctly
      });
    }

    const audio = audioRef.current;
    let audioTimer: ReturnType<typeof setTimeout> | null = null;
    if (audio) {
      audio.volume = 0.7;
      audioTimer = setTimeout(() => {
        audio.play().catch(() => {
          // Autoplay blocked — silent fallback is fine
        });
      }, AUDIO_OFFSET_MS);
    }

    return () => {
      clearTimeout(hideTimer);
      if (audioTimer) clearTimeout(audioTimer);
    };
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black"
          aria-hidden="true"
        >
          <video
            ref={videoRef}
            src="/intro.mp4"
            muted
            playsInline
            preload="auto"
            className="h-full w-full object-cover"
          />
          <audio ref={audioRef} src="/intro.mp3" preload="auto" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
