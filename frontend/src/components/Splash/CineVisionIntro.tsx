'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const SESSION_KEY = 'cv_intro_played';

// Video runs 5.4s (reverse-trimmed clip ending on the static logo);
// hold the splash a touch longer so the final reveal frame doesn't
// snap away mid-jingle on slower decoders.
const INTRO_DURATION_MS = 5600;

// The Netflix-style jingle (4s) climaxes at the end. Audio starts
// ~1.4s into the splash so the "tudum" lands on the logo reveal at
// ~5.4s (the end of the video).
const AUDIO_OFFSET_MS = 1400;

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
          transition={{ opacity: { duration: 0.6 } }}
          // The intro video has a true OLED-black background and reveals
          // the logo from a fully black frame, so the splash bg is just
          // matching solid black — every pixel of letterbox area is
          // identical to the video edge. No gradient or overlay needed.
          // z-index outranks every other overlay (eg. the WhatsApp
          // community modal at z-9999) so the splash isn't covered.
          className="fixed inset-0 z-[100000] flex items-center justify-center overflow-hidden bg-black"
          aria-hidden="true"
        >
          <video
            ref={videoRef}
            src="/intro.mp4"
            autoPlay
            muted
            playsInline
            preload="auto"
            // contain on portrait keeps the whole logo (CINE VISION + the
            // triangle) visible without horizontal cropping. cover on
            // landscape fills the screen edge-to-edge.
            className="h-full w-full object-contain landscape:object-cover"
          />
          <audio ref={audioRef} src="/intro.mp3" preload="auto" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
