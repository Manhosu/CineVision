'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const SESSION_KEY = 'cv_intro_played';

// Splash duration depends on which animation is playing.
// Desktop video clip is 5.4s (reverse-trimmed) + 200ms tail.
// Mobile motion-driven animation is 4.6s + 200ms tail.
const DESKTOP_DURATION_MS = 5600;
const MOBILE_DURATION_MS = 4800;

// Audio (Netflix-style "tudum" jingle, ~4s) climaxes at the end. Start
// it slightly delayed so the climax lands on the logo reveal.
const AUDIO_OFFSET_DESKTOP_MS = 1400;
const AUDIO_OFFSET_MOBILE_MS = 600;

// Returns null until matchMedia has been read (we render desktop on
// the server to avoid an SSR/hydration mismatch).
function useIsMobile(): boolean | null {
  const [isMobile, setIsMobile] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    setIsMobile(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return isMobile;
}

export default function CineVisionIntro() {
  const [visible, setVisible] = useState(false);
  const isMobile = useIsMobile();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (sessionStorage.getItem(SESSION_KEY)) return;
    // Wait until matchMedia has resolved so we know which timing to use.
    if (isMobile === null) return;

    setVisible(true);
    sessionStorage.setItem(SESSION_KEY, '1');

    const duration = isMobile ? MOBILE_DURATION_MS : DESKTOP_DURATION_MS;
    const audioOffset = isMobile ? AUDIO_OFFSET_MOBILE_MS : AUDIO_OFFSET_DESKTOP_MS;

    const hideTimer = setTimeout(() => setVisible(false), duration);

    const video = videoRef.current;
    if (video) {
      video.play().catch(() => {
        /* autoplay blocked — splash still fades through */
      });
    }

    const audio = audioRef.current;
    let audioTimer: ReturnType<typeof setTimeout> | null = null;
    let interactionHandler: (() => void) | null = null;

    if (audio) {
      audio.volume = 0.7;
      audioTimer = setTimeout(() => {
        const playPromise = audio.play();
        // If autoplay is blocked (most first-time visits without prior
        // engagement on the site), arm a one-shot listener on the
        // document so the very first click/tap unlocks the jingle.
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(() => {
            interactionHandler = () => {
              audio.play().catch(() => {});
              cleanupInteractionHandler();
            };
            document.addEventListener('click', interactionHandler, { once: true });
            document.addEventListener('touchstart', interactionHandler, { once: true });
            document.addEventListener('keydown', interactionHandler, { once: true });
          });
        }
      }, audioOffset);
    }

    function cleanupInteractionHandler() {
      if (!interactionHandler) return;
      document.removeEventListener('click', interactionHandler);
      document.removeEventListener('touchstart', interactionHandler);
      document.removeEventListener('keydown', interactionHandler);
      interactionHandler = null;
    }

    return () => {
      clearTimeout(hideTimer);
      if (audioTimer) clearTimeout(audioTimer);
      cleanupInteractionHandler();
    };
  }, [isMobile]);

  // Lock body scroll while the splash is up. Without this, fixed
  // positioning still lets the underlying page scroll behind the
  // overlay, and on desktop the user could scroll the splash out of
  // alignment and see homepage content peek through the edges.
  useEffect(() => {
    if (!visible) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [visible]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ opacity: { duration: 0.6 } }}
          // z-index outranks every other overlay (eg. the WhatsApp
          // community modal at z-9999) so the splash isn't covered.
          // bg-black is always safe — both the desktop video and the
          // mobile motion-driven animation are designed against pure
          // black, so every pixel of letterbox is a perfect match.
          className="fixed inset-0 z-[100000] flex items-center justify-center overflow-hidden bg-black"
          aria-hidden="true"
        >
          {isMobile ? (
            <MobileLogoReveal />
          ) : (
            // Desktop: object-contain (NOT cover) so the 16:9 source
            // never zooms past its native size on tall/ultra-wide
            // viewports. Cap the video at 80vh so the logo stays a
            // tasteful proportion of the screen — without the cap,
            // object-cover stretched the video edge-to-edge and the
            // logo took ~70% of viewport height, which read as
            // "absurdly large" rather than as a splash.
            <video
              ref={videoRef}
              src="/intro.mp4"
              autoPlay
              muted
              playsInline
              preload="auto"
              className="max-h-[80vh] max-w-[90vw] object-contain"
            />
          )}
          <audio ref={audioRef} src="/intro.mp3" preload="auto" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Mobile-only motion-driven reveal. Built from scratch so the logo
 * never letterboxes against narrow portrait viewports the way the
 * landscape video did. The arc is:
 *   0–1.4s   anticipation glow grows from a single point
 *   1.4–3.0s logo slams in from depth (scale + de-blur + brighten)
 *   3.0–3.4s burst (radial flash + light streaks fan outward)
 *   3.4–4.6s logo holds with a gentle pulse, then fades on exit
 */
function MobileLogoReveal() {
  // Eight light streaks fanning out at 45° increments. Each starts at
  // the logo center, scales to ~70% of the viewport diagonal, and
  // fades out. Staggering by index makes the burst feel like a sweep.
  const streakAngles = [0, 45, 90, 135, 180, 225, 270, 315];

  return (
    <div className="relative flex h-full w-full items-center justify-center">
      {/* Anticipation glow — a deep red bloom that pulses upward and
          peaks just before the logo slam-in. Heavy blur softens it. */}
      <motion.div
        className="pointer-events-none absolute"
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{
          scale: [0.4, 1.1, 1.6, 1.4, 1.5],
          opacity: [0, 0.55, 0.85, 0.45, 0.55],
        }}
        transition={{ duration: 4.6, times: [0, 0.3, 0.65, 0.85, 1], ease: 'easeOut' }}
        style={{
          width: '95vmin',
          height: '95vmin',
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(255,30,40,0.55) 0%, rgba(180,10,20,0.25) 35%, transparent 65%)',
          filter: 'blur(60px)',
        }}
      />

      {/* Burst flash — a tight white-hot core that lights up at the
          slam-in moment and then dims. Provides the camera-flash beat. */}
      <motion.div
        className="pointer-events-none absolute"
        initial={{ scale: 0, opacity: 0 }}
        animate={{
          scale: [0, 0.5, 1.6, 1.9, 2.2],
          opacity: [0, 0, 0.95, 0.4, 0],
        }}
        transition={{ duration: 4.6, times: [0, 0.55, 0.7, 0.8, 1], ease: 'easeOut' }}
        style={{
          width: '60vmin',
          height: '60vmin',
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(255,255,255,0.85) 0%, rgba(255,80,80,0.5) 35%, transparent 70%)',
          filter: 'blur(30px)',
          mixBlendMode: 'screen',
        }}
      />

      {/* Light streaks — eight thin red→white→transparent slashes
          fanning outward from the logo at the burst moment. */}
      {streakAngles.map((angle, i) => (
        <motion.div
          key={angle}
          className="pointer-events-none absolute"
          style={{
            width: '120vmax',
            height: '3px',
            transformOrigin: '50% 50%',
            rotate: `${angle}deg`,
          }}
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: [0, 0, 1, 1.05], opacity: [0, 0, 0.85, 0] }}
          transition={{
            duration: 4.6,
            times: [0, 0.62, 0.78, 0.95],
            ease: [0.16, 1, 0.3, 1],
            delay: i * 0.012,
          }}
        >
          <div
            style={{
              width: '100%',
              height: '100%',
              background:
                'linear-gradient(90deg, transparent 0%, rgba(255,80,80,0.0) 35%, rgba(255,255,255,0.95) 50%, rgba(255,80,80,0.0) 65%, transparent 100%)',
              filter: 'blur(1px)',
            }}
          />
        </motion.div>
      ))}

      {/* The logo itself. Comes in from depth (small + blurred +
          over-bright) then resolves to its natural size with a
          slight overshoot for the cinematic punch. */}
      <motion.img
        src="/cinevision-logo.png"
        alt=""
        draggable={false}
        className="relative z-10 select-none"
        style={{
          width: 'min(82vw, 480px)',
          height: 'auto',
          willChange: 'transform, opacity, filter',
        }}
        initial={{ scale: 0.18, opacity: 0, filter: 'blur(28px) brightness(2.4)' }}
        animate={{
          scale: [0.18, 0.32, 1.18, 1.0, 1.04, 1.0],
          opacity: [0, 0.25, 1, 1, 1, 1],
          filter: [
            'blur(28px) brightness(2.4)',
            'blur(18px) brightness(1.9)',
            'blur(0px) brightness(1.45)',
            'blur(0px) brightness(1.05)',
            'blur(0px) brightness(1.15)',
            'blur(0px) brightness(1.0)',
          ],
        }}
        transition={{
          duration: 4.6,
          times: [0, 0.45, 0.7, 0.78, 0.9, 1],
          ease: [0.16, 1, 0.3, 1],
        }}
      />

      {/* A second pulsing glow layer that lives behind the logo for the
          entire hold phase. Keeps the logo from feeling static. */}
      <motion.div
        className="pointer-events-none absolute"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{
          opacity: [0, 0, 0.6, 0.3, 0.5, 0.2],
          scale: [0.8, 0.8, 1.1, 1.0, 1.08, 1.0],
        }}
        transition={{ duration: 4.6, times: [0, 0.7, 0.78, 0.85, 0.92, 1], ease: 'easeOut' }}
        style={{
          width: '70vmin',
          height: '70vmin',
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(255,40,60,0.45) 0%, rgba(120,0,20,0.2) 40%, transparent 70%)',
          filter: 'blur(40px)',
          zIndex: 5,
        }}
      />
    </div>
  );
}
