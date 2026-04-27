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
          initial={{ opacity: 1, backgroundColor: '#000000' }}
          exit={{ opacity: 0 }}
          // z-index has to outrank every other overlay (eg. the WhatsApp
          // community modal at z-9999) so the splash isn't covered.
          // Background tracks the video's actual edge brightness so the
          // letterbox space on portrait never looks like a darker frame
          // around the video. Edges sampled with ffmpeg (top+bottom 2-row
          // band of an 8x8 downscale) at 0.5/1.5/2.5/3.5/4.5/5/5.5s:
          //   #030003 → #040007 → #05000e → #05001a → #090332 → #060025 → #070024
          // The edge briefly peaks at #090332 around 4.5s before easing
          // back to #070024 — keep that bump in the curve.
          animate={{
            backgroundColor: ['#000000', '#040007', '#05001a', '#090332', '#070024'],
          }}
          // Per-property transitions: backgroundColor follows the
          // keyframes; opacity uses a quick 0.6s fade only on exit.
          // (Without splitting them, a single `transition` prop made the
          // exit fade take 5.88s — the splash hung on screen.)
          transition={{
            backgroundColor: {
              duration: 5.88,
              times: [0, 0.25, 0.6, 0.76, 1],
              ease: 'linear',
            },
            opacity: { duration: 0.6 },
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
            // landscape fills the screen edge-to-edge. The page bg
            // animates from black through the same navy curve as the
            // video edge, so the letterbox space above/below the video
            // on portrait blends into the video frame instead of looking
            // like a darker cutout.
            className="h-full w-full object-contain landscape:object-cover"
          />
          <audio ref={audioRef} src="/intro.mp3" preload="auto" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
