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
          transition={{ opacity: { duration: 0.6 } }}
          // z-index has to outrank every other overlay (eg. the WhatsApp
          // community modal at z-9999) so the splash isn't covered.
          // The bg is a fixed radial gradient that mirrors the video's
          // own vignette: bright purple-navy in the center where the
          // logo lands, fading to dark navy at the screen corners. This
          // way the letterbox space on portrait reads as an extension of
          // the video's spotlight instead of a contrasting darker frame.
          // Stops chosen so the gradient color at the video's top edge
          // (~37% from top of screen on portrait) ≈ the video's edge
          // brightness sampled with ffmpeg (~#070024).
          style={{
            background:
              'radial-gradient(ellipse 65% 45% at 50% 50%, #1a0050 0%, #0a0030 22%, #050018 55%, #020010 100%)',
          }}
          className="fixed inset-0 z-[100000] flex items-center justify-center overflow-hidden"
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
          {/* Black overlay covering both the video and the gradient bg.
              Holds opaque for ~45% of the duration (matching the video's
              dark intro), then fades out to reveal the synced video +
              gradient. This avoids the previous "video brightening on
              dark bg" mismatch — at every moment the user either sees
              pure black or a fully-revealed scene. */}
          <motion.div
            className="pointer-events-none absolute inset-0 bg-black"
            initial={{ opacity: 1 }}
            animate={{ opacity: [1, 1, 0.4, 0] }}
            transition={{
              duration: 5.88,
              times: [0, 0.45, 0.75, 1],
              ease: 'linear',
            }}
          />
          <audio ref={audioRef} src="/intro.mp3" preload="auto" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
